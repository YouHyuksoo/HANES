/**
 * @file src/modules/material/services/scrap.service.ts
 * @description 자재폐기 비즈니스 로직 - StockTransaction(SCRAP) 생성 + LOT 수량 차감
 */

import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateScrapDto, ScrapQueryDto } from '../dto/scrap.dto';

@Injectable()
export class ScrapService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: ScrapQueryDto) {
    const { page = 1, limit = 10, search, fromDate, toDate } = query;
    const skip = (page - 1) * limit;

    const where = {
      transType: 'SCRAP',
      status: 'DONE',
      ...(search && {
        OR: [
          { transNo: { contains: search, mode: 'insensitive' as const } },
          { remark: { contains: search, mode: 'insensitive' as const } },
        ],
      }),
      ...(fromDate && { transDate: { gte: new Date(fromDate) } }),
      ...(toDate && { transDate: { ...((fromDate && { gte: new Date(fromDate) }) || {}), lte: new Date(toDate) } }),
    };

    const [data, total] = await Promise.all([
      this.prisma.stockTransaction.findMany({
        where,
        skip,
        take: limit,
        include: {
          part: { select: { id: true, partCode: true, partName: true, unit: true } },
          lot: { select: { id: true, lotNo: true } },
          fromWarehouse: { select: { id: true, warehouseName: true } },
        },
        orderBy: { transDate: 'desc' },
      }),
      this.prisma.stockTransaction.count({ where }),
    ]);

    const flattened = data.map((trans) => ({
      ...trans,
      partCode: trans.part?.partCode,
      partName: trans.part?.partName,
      unit: trans.part?.unit,
      lotNo: trans.lot?.lotNo,
      warehouseName: trans.fromWarehouse?.warehouseName,
      part: undefined,
      lot: undefined,
      fromWarehouse: undefined,
    }));

    return { data: flattened, total, page, limit };
  }

  async create(dto: CreateScrapDto) {
    const lot = await this.prisma.lot.findFirst({ where: { id: dto.lotId, deletedAt: null } });
    if (!lot) throw new NotFoundException(`LOT을 찾을 수 없습니다: ${dto.lotId}`);
    if (lot.currentQty < dto.qty) {
      throw new BadRequestException(`폐기 수량(${dto.qty})이 현재 수량(${lot.currentQty})을 초과합니다.`);
    }

    const transNo = `SCR-${Date.now().toString(36).toUpperCase()}`;

    return this.prisma.$transaction(async (tx) => {
      await tx.lot.update({
        where: { id: dto.lotId },
        data: { currentQty: lot.currentQty - dto.qty },
      });

      return tx.stockTransaction.create({
        data: {
          transNo,
          transType: 'SCRAP',
          fromWarehouseId: dto.warehouseId,
          partId: lot.partId,
          lotId: dto.lotId,
          qty: -dto.qty,
          remark: dto.reason,
          workerId: dto.workerId,
        },
        include: { part: true, lot: true },
      });
    });
  }
}
