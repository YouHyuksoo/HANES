/**
 * @file src/modules/material/services/mat-issue.service.ts
 * @description 자재출고 비즈니스 로직 서비스
 *
 * 초보자 가이드:
 * 1. **MatIssue 테이블**: 작업지시/외주처로의 자재 불출 이력
 * 2. **주요 필드**: jobOrderId, lotId, issueQty, issueType
 * 3. **출고 유형**: PROD(생산), SUBCON(외주), SAMPLE(샘플), ADJ(조정)
 */

import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateMatIssueDto, MatIssueQueryDto } from '../dto/mat-issue.dto';

@Injectable()
export class MatIssueService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: MatIssueQueryDto) {
    const { page = 1, limit = 10, jobOrderId, lotId, issueType, issueDateFrom, issueDateTo, status } = query;
    const skip = (page - 1) * limit;

    const where: any = {
      ...(jobOrderId && { jobOrderId }),
      ...(lotId && { lotId }),
      ...(issueType && { issueType }),
      ...(status && { status }),
    };

    if (issueDateFrom || issueDateTo) {
      where.issueDate = {};
      if (issueDateFrom) where.issueDate.gte = new Date(issueDateFrom);
      if (issueDateTo) where.issueDate.lte = new Date(issueDateTo);
    }

    const [data, total] = await Promise.all([
      this.prisma.matIssue.findMany({
        where,
        skip,
        take: limit,
        include: {
          lot: {
            include: {
              part: { select: { id: true, partCode: true, partName: true, unit: true } },
            },
          },
          jobOrder: { select: { id: true, orderNo: true } },
        },
        orderBy: { issueDate: 'desc' },
      }),
      this.prisma.matIssue.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  async findById(id: string) {
    const issue = await this.prisma.matIssue.findUnique({
      where: { id },
      include: {
        lot: { include: { part: true } },
        jobOrder: true,
      },
    });

    if (!issue) throw new NotFoundException(`출고 이력을 찾을 수 없습니다: ${id}`);
    return issue;
  }

  async create(dto: CreateMatIssueDto) {
    const { jobOrderId, warehouseCode, issueType, items, remark, workerId } = dto;

    return this.prisma.$transaction(async (tx) => {
      const results = [];

      for (const item of items) {
        // LOT 유효성 확인
        const lot = await tx.matLot.findFirst({
          where: { id: item.lotId, deletedAt: null },
        });

        if (!lot) {
          throw new BadRequestException(`LOT을 찾을 수 없습니다: ${item.lotId}`);
        }

        if (lot.iqcStatus !== 'PASS') {
          throw new BadRequestException(`IQC 합격되지 않은 LOT입니다: ${lot.lotNo}`);
        }

        if (lot.currentQty < item.issueQty) {
          throw new BadRequestException(`LOT 재고 부족: ${lot.lotNo} (현재: ${lot.currentQty}, 요청: ${item.issueQty})`);
        }

        // LOT 재고 차감
        await tx.matLot.update({
          where: { id: lot.id },
          data: {
            currentQty: lot.currentQty - item.issueQty,
            status: lot.currentQty - item.issueQty === 0 ? 'DEPLETED' : lot.status,
          },
        });

        // 창고 재고 차감 (warehouseCode가 있는 경우)
        if (warehouseCode) {
          const stock = await tx.matStock.findFirst({
            where: { partId: lot.partId, warehouseCode, lotId: lot.id },
          });

          if (stock) {
            await tx.matStock.update({
              where: { id: stock.id },
              data: {
                qty: Math.max(0, stock.qty - item.issueQty),
                availableQty: Math.max(0, stock.availableQty - item.issueQty),
              },
            });
          }
        }

        // 출고 이력 생성
        const issue = await tx.matIssue.create({
          data: {
            jobOrderId,
            lotId: item.lotId,
            issueQty: item.issueQty,
            issueType: issueType ?? 'PROD',
            workerId,
            remark,
            status: 'DONE',
          },
          include: {
            lot: { include: { part: true } },
          },
        });

        results.push(issue);
      }

      return results;
    });
  }

  async cancel(id: string, reason?: string) {
    const issue = await this.findById(id);

    if (issue.status !== 'DONE') {
      throw new BadRequestException('이미 취소된 출고입니다.');
    }

    return this.prisma.$transaction(async (tx) => {
      // 출고 상태 변경
      const updated = await tx.matIssue.update({
        where: { id },
        data: { status: 'CANCELED', remark: reason },
      });

      // LOT 재고 복구
      await tx.matLot.update({
        where: { id: issue.lotId },
        data: {
          currentQty: { increment: issue.issueQty },
          status: 'NORMAL',
        },
      });

      // 창고 재고 복구 (stock이 있는 경우)
      const stock = await tx.matStock.findFirst({
        where: { lotId: issue.lotId },
      });

      if (stock) {
        await tx.matStock.update({
          where: { id: stock.id },
          data: {
            qty: stock.qty + issue.issueQty,
            availableQty: stock.availableQty + issue.issueQty,
          },
        });
      }

      return updated;
    });
  }
}
