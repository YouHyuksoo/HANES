/**
 * @file src/modules/material/services/hold.service.ts
 * @description 재고홀드 비즈니스 로직 - LOT 상태를 HOLD로 변경/해제
 */

import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { HoldActionDto, ReleaseHoldDto, HoldQueryDto } from '../dto/hold.dto';

@Injectable()
export class HoldService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: HoldQueryDto) {
    const { page = 1, limit = 10, search, status } = query;
    const skip = (page - 1) * limit;

    const where = {
      deletedAt: null,
      currentQty: { gt: 0 },
      ...(status ? { status } : { status: { in: ['HOLD', 'NORMAL'] } }),
      ...(search && {
        OR: [
          { lotNo: { contains: search, mode: 'insensitive' as const } },
        ],
      }),
    };

    const [data, total] = await Promise.all([
      this.prisma.lot.findMany({
        where,
        skip,
        take: limit,
        include: { part: { select: { id: true, partCode: true, partName: true, unit: true } } },
        orderBy: { updatedAt: 'desc' },
      }),
      this.prisma.lot.count({ where }),
    ]);

    const flattened = data.map((lot) => ({
      ...lot,
      partCode: lot.part?.partCode,
      partName: lot.part?.partName,
      unit: lot.part?.unit,
      part: undefined,
    }));

    return { data: flattened, total, page, limit };
  }

  async hold(dto: HoldActionDto) {
    const lot = await this.prisma.lot.findFirst({ where: { id: dto.lotId, deletedAt: null } });
    if (!lot) throw new NotFoundException(`LOT을 찾을 수 없습니다: ${dto.lotId}`);
    if (lot.status === 'HOLD') throw new BadRequestException('이미 HOLD 상태입니다.');

    return this.prisma.lot.update({
      where: { id: dto.lotId },
      data: { status: 'HOLD' },
      include: { part: true },
    });
  }

  async release(dto: ReleaseHoldDto) {
    const lot = await this.prisma.lot.findFirst({ where: { id: dto.lotId, deletedAt: null } });
    if (!lot) throw new NotFoundException(`LOT을 찾을 수 없습니다: ${dto.lotId}`);
    if (lot.status !== 'HOLD') throw new BadRequestException('HOLD 상태가 아닙니다.');

    return this.prisma.lot.update({
      where: { id: dto.lotId },
      data: { status: 'NORMAL' },
      include: { part: true },
    });
  }
}
