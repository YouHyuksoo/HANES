/**
 * @file src/modules/master/services/equip-inspect.service.ts
 * @description 설비점검항목마스터 비즈니스 로직 서비스
 *
 * 초보자 가이드:
 * 1. **findAll**: equipId, inspectType 기반 점검항목 조회
 * 2. **include**: 설비명 조회를 위해 equip relation 포함
 */

import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateEquipInspectItemDto, UpdateEquipInspectItemDto, EquipInspectItemQueryDto } from '../dto/equip-inspect.dto';

@Injectable()
export class EquipInspectService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: EquipInspectItemQueryDto) {
    const { page = 1, limit = 10, equipId, inspectType, search, useYn } = query;
    const skip = (page - 1) * limit;

    const where = {
      deletedAt: null,
      ...(equipId && { equipId }),
      ...(inspectType && { inspectType }),
      ...(useYn && { useYn }),
      ...(search && {
        OR: [
          { itemName: { contains: search, mode: 'insensitive' as const } },
          { criteria: { contains: search, mode: 'insensitive' as const } },
        ],
      }),
    };

    const [data, total] = await Promise.all([
      this.prisma.equipInspectItemMaster.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ equipId: 'asc' }, { seq: 'asc' }],
        include: { equip: { select: { equipCode: true, equipName: true } } },
      }),
      this.prisma.equipInspectItemMaster.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  async findById(id: string) {
    const item = await this.prisma.equipInspectItemMaster.findFirst({
      where: { id, deletedAt: null },
      include: { equip: { select: { equipCode: true, equipName: true } } },
    });
    if (!item) throw new NotFoundException(`설비점검항목을 찾을 수 없습니다: ${id}`);
    return item;
  }

  async create(dto: CreateEquipInspectItemDto) {
    return this.prisma.equipInspectItemMaster.create({
      data: {
        equipId: dto.equipId,
        inspectType: dto.inspectType,
        seq: dto.seq,
        itemName: dto.itemName,
        criteria: dto.criteria,
        cycle: dto.cycle,
        useYn: dto.useYn ?? 'Y',
      },
    });
  }

  async update(id: string, dto: UpdateEquipInspectItemDto) {
    await this.findById(id);
    return this.prisma.equipInspectItemMaster.update({ where: { id }, data: dto });
  }

  async delete(id: string) {
    await this.findById(id);
    return this.prisma.equipInspectItemMaster.update({ where: { id }, data: { deletedAt: new Date() } });
  }
}
