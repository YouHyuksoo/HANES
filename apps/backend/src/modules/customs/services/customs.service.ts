/**
 * @file src/modules/customs/services/customs.service.ts
 * @description 보세관리 비즈니스 로직 서비스
 */

import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  CreateCustomsEntryDto,
  UpdateCustomsEntryDto,
  CustomsEntryQueryDto,
  CreateCustomsLotDto,
  UpdateCustomsLotDto,
  CreateUsageReportDto,
  UpdateUsageReportDto,
  UsageReportQueryDto,
} from '../dto/customs.dto';

@Injectable()
export class CustomsService {
  private readonly logger = new Logger(CustomsService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ============================================================================
  // 수입신고 (Customs Entry)
  // ============================================================================

  async findAllEntries(query: CustomsEntryQueryDto) {
    const { page = 1, limit = 10, status, search, startDate, endDate } = query;
    const skip = (page - 1) * limit;

    const where = {
      deletedAt: null,
      ...(status && { status }),
      ...(search && {
        OR: [
          { entryNo: { contains: search, mode: 'insensitive' as const } },
          { invoiceNo: { contains: search, mode: 'insensitive' as const } },
          { blNo: { contains: search, mode: 'insensitive' as const } },
        ],
      }),
      ...(startDate && endDate && {
        declarationDate: {
          gte: new Date(startDate),
          lte: new Date(endDate),
        },
      }),
    };

    const [data, total] = await Promise.all([
      this.prisma.customsEntry.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          customsLots: {
            select: {
              id: true,
              lotNo: true,
              partCode: true,
              qty: true,
              usedQty: true,
              remainQty: true,
              status: true,
            },
          },
        },
      }),
      this.prisma.customsEntry.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  async findEntryById(id: string) {
    const entry = await this.prisma.customsEntry.findUnique({
      where: { id },
      include: {
        customsLots: {
          include: {
            usageReports: true,
          },
        },
      },
    });

    if (!entry) {
      throw new NotFoundException(`수입신고를 찾을 수 없습니다: ${id}`);
    }

    return entry;
  }

  async createEntry(dto: CreateCustomsEntryDto) {
    const existing = await this.prisma.customsEntry.findUnique({
      where: { entryNo: dto.entryNo },
    });

    if (existing) {
      throw new ConflictException(`이미 존재하는 수입신고번호입니다: ${dto.entryNo}`);
    }

    return this.prisma.customsEntry.create({
      data: {
        entryNo: dto.entryNo,
        blNo: dto.blNo,
        invoiceNo: dto.invoiceNo,
        declarationDate: dto.declarationDate ? new Date(dto.declarationDate) : null,
        clearanceDate: dto.clearanceDate ? new Date(dto.clearanceDate) : null,
        origin: dto.origin,
        hsCode: dto.hsCode,
        totalAmount: dto.totalAmount,
        currency: dto.currency,
        remark: dto.remark,
      },
    });
  }

  async updateEntry(id: string, dto: UpdateCustomsEntryDto) {
    await this.findEntryById(id);

    return this.prisma.customsEntry.update({
      where: { id },
      data: {
        ...(dto.blNo !== undefined && { blNo: dto.blNo }),
        ...(dto.invoiceNo !== undefined && { invoiceNo: dto.invoiceNo }),
        ...(dto.declarationDate !== undefined && { declarationDate: new Date(dto.declarationDate) }),
        ...(dto.clearanceDate !== undefined && { clearanceDate: new Date(dto.clearanceDate) }),
        ...(dto.origin !== undefined && { origin: dto.origin }),
        ...(dto.hsCode !== undefined && { hsCode: dto.hsCode }),
        ...(dto.totalAmount !== undefined && { totalAmount: dto.totalAmount }),
        ...(dto.currency !== undefined && { currency: dto.currency }),
        ...(dto.status !== undefined && { status: dto.status }),
        ...(dto.remark !== undefined && { remark: dto.remark }),
      },
    });
  }

  async deleteEntry(id: string) {
    await this.findEntryById(id);

    return this.prisma.customsEntry.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  // ============================================================================
  // 보세자재 LOT (Customs Lot)
  // ============================================================================

  async findLotsByEntryId(entryId: string) {
    return this.prisma.customsLot.findMany({
      where: { entryId },
      include: {
        usageReports: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findLotById(id: string) {
    const lot = await this.prisma.customsLot.findUnique({
      where: { id },
      include: {
        entry: true,
        usageReports: true,
      },
    });

    if (!lot) {
      throw new NotFoundException(`보세자재 LOT을 찾을 수 없습니다: ${id}`);
    }

    return lot;
  }

  async createLot(dto: CreateCustomsLotDto) {
    return this.prisma.customsLot.create({
      data: {
        entryId: dto.entryId,
        lotNo: dto.lotNo,
        partCode: dto.partCode,
        qty: dto.qty,
        remainQty: dto.qty,
        unitPrice: dto.unitPrice,
      },
    });
  }

  async updateLot(id: string, dto: UpdateCustomsLotDto) {
    await this.findLotById(id);

    return this.prisma.customsLot.update({
      where: { id },
      data: {
        ...(dto.status !== undefined && { status: dto.status }),
      },
    });
  }

  // ============================================================================
  // 사용신고 (Usage Report)
  // ============================================================================

  async findAllUsageReports(query: UsageReportQueryDto) {
    const { page = 1, limit = 10, status, startDate, endDate } = query;
    const skip = (page - 1) * limit;

    const where = {
      ...(status && { status }),
      ...(startDate && endDate && {
        usageDate: {
          gte: new Date(startDate),
          lte: new Date(endDate),
        },
      }),
    };

    const [data, total] = await Promise.all([
      this.prisma.customsUsageReport.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          customsLot: {
            include: {
              entry: true,
            },
          },
        },
      }),
      this.prisma.customsUsageReport.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  async createUsageReport(dto: CreateUsageReportDto) {
    const lot = await this.findLotById(dto.customsLotId);

    if (lot.remainQty < dto.usageQty) {
      throw new BadRequestException(
        `사용 가능 수량(${lot.remainQty})을 초과했습니다.`
      );
    }

    // 시퀀스 생성
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const count = await this.prisma.customsUsageReport.count({
      where: {
        reportNo: { startsWith: `USG${today}` },
      },
    });
    const reportNo = `USG${today}${String(count + 1).padStart(4, '0')}`;

    // 트랜잭션으로 사용신고 생성 및 LOT 업데이트
    return this.prisma.$transaction(async (tx) => {
      const report = await tx.customsUsageReport.create({
        data: {
          reportNo,
          customsLotId: dto.customsLotId,
          jobOrderId: dto.jobOrderId,
          usageQty: dto.usageQty,
          workerId: dto.workerId,
          remark: dto.remark,
        },
      });

      // LOT 잔여수량 업데이트
      const newUsedQty = lot.usedQty + dto.usageQty;
      const newRemainQty = lot.qty - newUsedQty;
      const newStatus = newRemainQty === 0 ? 'RELEASED' : 'PARTIAL';

      await tx.customsLot.update({
        where: { id: dto.customsLotId },
        data: {
          usedQty: newUsedQty,
          remainQty: newRemainQty,
          status: newStatus,
        },
      });

      return report;
    });
  }

  async updateUsageReport(id: string, dto: UpdateUsageReportDto) {
    const report = await this.prisma.customsUsageReport.findUnique({
      where: { id },
    });

    if (!report) {
      throw new NotFoundException(`사용신고를 찾을 수 없습니다: ${id}`);
    }

    return this.prisma.customsUsageReport.update({
      where: { id },
      data: {
        ...(dto.status !== undefined && { status: dto.status }),
        ...(dto.status === 'REPORTED' && { reportDate: new Date() }),
        ...(dto.remark !== undefined && { remark: dto.remark }),
      },
    });
  }

  // ============================================================================
  // 통계 및 대시보드
  // ============================================================================

  async getCustomsSummary() {
    const [totalEntries, pendingEntries, bondedLots, totalBondedQty] = await Promise.all([
      this.prisma.customsEntry.count({ where: { deletedAt: null } }),
      this.prisma.customsEntry.count({ where: { status: 'PENDING', deletedAt: null } }),
      this.prisma.customsLot.count({ where: { status: 'BONDED' } }),
      this.prisma.customsLot.aggregate({
        where: { status: { in: ['BONDED', 'PARTIAL'] } },
        _sum: { remainQty: true },
      }),
    ]);

    return {
      totalEntries,
      pendingEntries,
      bondedLots,
      totalBondedQty: totalBondedQty._sum.remainQty || 0,
    };
  }
}
