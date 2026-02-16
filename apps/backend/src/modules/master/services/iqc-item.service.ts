/**
 * @file src/modules/master/services/iqc-item.service.ts
 * @description IQC 검사항목마스터 비즈니스 로직 서비스
 *
 * 초보자 가이드:
 * 1. **findAll**: partId 기반 검사항목 조회 (part relation 포함)
 * 2. **create**: partId + seq 유니크 조합
 */

import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateIqcItemDto, UpdateIqcItemDto, IqcItemQueryDto } from '../dto/iqc-item.dto';

@Injectable()
export class IqcItemService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: IqcItemQueryDto) {
    const { page = 1, limit = 10, partId, search, useYn } = query;
    const skip = (page - 1) * limit;

    const where = {
      deletedAt: null,
      ...(partId && { partId }),
      ...(useYn && { useYn }),
      ...(search && {
        OR: [
          { inspectItem: { contains: search, mode: 'insensitive' as const } },
          { spec: { contains: search, mode: 'insensitive' as const } },
        ],
      }),
    };

    const [items, total] = await Promise.all([
      this.prisma.iqcItemMaster.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ partId: 'asc' }, { seq: 'asc' }],
        include: { part: { select: { partCode: true, partName: true } } },
      }),
      this.prisma.iqcItemMaster.count({ where }),
    ]);

    // 평면화
    const data = items.map(item => ({
      ...item,
      partCode: item.part?.partCode || null,
      partName: item.part?.partName || null,
    }));

    return { data, total, page, limit };
  }

  async findById(id: string) {
    const item = await this.prisma.iqcItemMaster.findFirst({
      where: { id, deletedAt: null },
      include: { part: { select: { partCode: true, partName: true } } },
    });
    if (!item) throw new NotFoundException(`IQC 검사항목을 찾을 수 없습니다: ${id}`);
    
    // 평면화
    return {
      ...item,
      partCode: item.part?.partCode || null,
      partName: item.part?.partName || null,
    };
  }

  async create(dto: CreateIqcItemDto) {
    return this.prisma.iqcItemMaster.create({
      data: {
        partId: dto.partId,
        seq: dto.seq,
        inspectItem: dto.inspectItem,
        spec: dto.spec,
        lsl: dto.lsl,
        usl: dto.usl,
        unit: dto.unit,
        isShelfLife: dto.isShelfLife ?? false,
        retestCycle: dto.retestCycle,
        useYn: dto.useYn ?? 'Y',
      },
    });
  }

  async update(id: string, dto: UpdateIqcItemDto) {
    await this.findById(id);
    return this.prisma.iqcItemMaster.update({ where: { id }, data: dto });
  }

  async delete(id: string) {
    await this.findById(id);
    return this.prisma.iqcItemMaster.update({ where: { id }, data: { deletedAt: new Date() } });
  }
}
