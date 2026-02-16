/**
 * @file src/modules/material/services/mat-issue.service.ts
 * @description 자재출고 비즈니스 로직 서비스 (TypeORM)
 *
 * 초보자 가이드:
 * 1. **MatIssue 테이블**: 작업지시/외주처로의 자재 불출 이력
 * 2. **주요 필드**: jobOrderId, lotId, issueQty, issueType
 * 3. **출고 유형**: PROD(생산), SUBCON(외주), SAMPLE(샘플), ADJ(조정)
 */

import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, IsNull, DataSource } from 'typeorm';
import { MatIssue } from '../../../entities/mat-issue.entity';
import { MatLot } from '../../../entities/mat-lot.entity';
import { MatStock } from '../../../entities/mat-stock.entity';
import { PartMaster } from '../../../entities/part-master.entity';
import { JobOrder } from '../../../entities/job-order.entity';
import { CreateMatIssueDto, MatIssueQueryDto } from '../dto/mat-issue.dto';

@Injectable()
export class MatIssueService {
  constructor(
    @InjectRepository(MatIssue)
    private readonly matIssueRepository: Repository<MatIssue>,
    @InjectRepository(MatLot)
    private readonly matLotRepository: Repository<MatLot>,
    @InjectRepository(MatStock)
    private readonly matStockRepository: Repository<MatStock>,
    @InjectRepository(PartMaster)
    private readonly partMasterRepository: Repository<PartMaster>,
    @InjectRepository(JobOrder)
    private readonly jobOrderRepository: Repository<JobOrder>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * 출고 이력 데이터를 평면화하여 반환
   * lot, part 중첩 구조를 평면화된 필드로 변환
   */
  private async flattenIssue(issue: MatIssue) {
    if (!issue) return null;

    const lot = issue.lotId ? await this.matLotRepository.findOne({ where: { id: issue.lotId } }) : null;
    const part = lot?.partId ? await this.partMasterRepository.findOne({ where: { id: lot.partId } }) : null;
    const jobOrder = issue.jobOrderId ? await this.jobOrderRepository.findOne({ where: { id: issue.jobOrderId } }) : null;

    return {
      ...issue,
      lotId: lot?.id ?? null,
      lotNo: lot?.lotNo ?? null,
      partId: part?.id ?? null,
      partCode: part?.partCode ?? null,
      partName: part?.partName ?? null,
      unit: part?.unit ?? null,
      jobOrderNo: jobOrder?.orderNo ?? null,
    };
  }

  async findAll(query: MatIssueQueryDto) {
    const { page = 1, limit = 10, jobOrderId, lotId, issueType, issueDateFrom, issueDateTo, status } = query;
    const skip = (page - 1) * limit;

    const where: any = {
      ...(jobOrderId && { jobOrderId }),
      ...(lotId && { lotId }),
      ...(issueType && { issueType }),
      ...(status && { status }),
    };

    if (issueDateFrom && issueDateTo) {
      where.issueDate = Between(new Date(issueDateFrom), new Date(issueDateTo));
    } else if (issueDateFrom) {
      where.issueDate = Between(new Date(issueDateFrom), new Date());
    } else if (issueDateTo) {
      where.issueDate = Between(new Date('1900-01-01'), new Date(issueDateTo));
    }

    const [data, total] = await Promise.all([
      this.matIssueRepository.find({
        where,
        skip,
        take: limit,
        order: { issueDate: 'DESC' },
      }),
      this.matIssueRepository.count({ where }),
    ]);

    const flattenedData = await Promise.all(data.map((issue) => this.flattenIssue(issue)));

    return { data: flattenedData, total, page, limit };
  }

  async findById(id: string) {
    const issue = await this.matIssueRepository.findOne({ where: { id } });

    if (!issue) throw new NotFoundException(`출고 이력을 찾을 수 없습니다: ${id}`);
    return this.flattenIssue(issue);
  }

  async create(dto: CreateMatIssueDto) {
    const { jobOrderId, warehouseCode, issueType, items, remark, workerId } = dto;

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const results = [];

      for (const item of items) {
        // LOT 유효성 확인
        const lot = await queryRunner.manager.findOne(MatLot, {
          where: { id: item.lotId, deletedAt: IsNull() },
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
        await queryRunner.manager.update(MatLot, lot.id, {
          currentQty: lot.currentQty - item.issueQty,
          status: lot.currentQty - item.issueQty === 0 ? 'DEPLETED' : lot.status,
        });

        // 창고 재고 차감 (warehouseCode가 있는 경우)
        if (warehouseCode) {
          const stock = await queryRunner.manager.findOne(MatStock, {
            where: { partId: lot.partId, warehouseCode, lotId: lot.id },
          });

          if (stock) {
            await queryRunner.manager.update(MatStock, stock.id, {
              qty: Math.max(0, stock.qty - item.issueQty),
              availableQty: Math.max(0, stock.availableQty - item.issueQty),
            });
          }
        }

        // 출고 이력 생성
        const issue = queryRunner.manager.create(MatIssue, {
          jobOrderId,
          lotId: item.lotId,
          issueQty: item.issueQty,
          issueType: issueType ?? 'PROD',
          workerId,
          remark,
          status: 'DONE',
        });

        const saved = await queryRunner.manager.save(issue);
        results.push(await this.flattenIssue(saved));
      }

      await queryRunner.commitTransaction();
      return results;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async cancel(id: string, reason?: string) {
    const issue = await this.findById(id);

    if (issue.status !== 'DONE') {
      throw new BadRequestException('이미 취소된 출고입니다.');
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 출고 상태 변경
      await queryRunner.manager.update(MatIssue, id, { status: 'CANCELED', remark: reason });

      // LOT 재고 복구
      if (issue.lotId) {
        const lot = await queryRunner.manager.findOne(MatLot, { where: { id: issue.lotId } });
        if (lot) {
          await queryRunner.manager.update(MatLot, lot.id, {
            currentQty: lot.currentQty + issue.issueQty,
            status: 'NORMAL',
          });
        }
      }

      // 창고 재고 복구 (stock이 있는 경우)
      const stock = await queryRunner.manager.findOne(MatStock, {
        where: { lotId: issue.lotId },
      });

      if (stock) {
        await queryRunner.manager.update(MatStock, stock.id, {
          qty: stock.qty + issue.issueQty,
          availableQty: stock.availableQty + issue.issueQty,
        });
      }

      await queryRunner.commitTransaction();
      return { id, status: 'CANCELED' };
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }
}
