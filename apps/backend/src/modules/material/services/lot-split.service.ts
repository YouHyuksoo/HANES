/**
 * @file src/modules/material/services/lot-split.service.ts
 * @description 자재 LOT 분할 비즈니스 로직
 *
 * 초보자 가이드:
 * 1. **분할**: 하나의 LOT에서 일부 수량을 분리하여 새 LOT 생성
 * 2. **추적성**: parentLotId로 분할 이력 추적 가능
 */

import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { LotSplitDto, LotSplitQueryDto } from '../dto/lot-split.dto';

@Injectable()
export class LotSplitService {
  constructor(private readonly prisma: PrismaService) {}

  /** 분할 가능한 LOT 목록 조회 (currentQty > 0) */
  async findSplittableLots(query: LotSplitQueryDto) {
    const { page = 1, limit = 10, search } = query;
    const skip = (page - 1) * limit;

    const where = {
      deletedAt: null,
      currentQty: { gt: 0 },
      status: 'NORMAL',
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
        orderBy: { createdAt: 'desc' },
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

  /** LOT 분할 실행 */
  async split(dto: LotSplitDto) {
    const sourceLot = await this.prisma.lot.findFirst({
      where: { id: dto.sourceLotId, deletedAt: null },
      include: { part: true },
    });
    if (!sourceLot) throw new NotFoundException(`LOT을 찾을 수 없습니다: ${dto.sourceLotId}`);
    if (sourceLot.currentQty < dto.splitQty) {
      throw new BadRequestException(`분할 수량(${dto.splitQty})이 현재 수량(${sourceLot.currentQty})을 초과합니다.`);
    }

    const newLotNo = dto.newLotNo || `${sourceLot.lotNo}-S${Date.now().toString(36).toUpperCase()}`;

    return this.prisma.$transaction(async (tx) => {
      await tx.lot.update({
        where: { id: sourceLot.id },
        data: { currentQty: sourceLot.currentQty - dto.splitQty },
      });

      const newLot = await tx.lot.create({
        data: {
          lotNo: newLotNo,
          partId: sourceLot.partId,
          partType: sourceLot.partType,
          initQty: dto.splitQty,
          currentQty: dto.splitQty,
          recvDate: sourceLot.recvDate,
          expireDate: sourceLot.expireDate,
          origin: sourceLot.origin,
          vendor: sourceLot.vendor,
          parentLotId: sourceLot.id,
          iqcStatus: sourceLot.iqcStatus,
          status: 'NORMAL',
        },
        include: { part: true },
      });

      return newLot;
    });
  }
}
