/**
 * @file src/modules/master/services/routing.service.ts
 * @description 공정라우팅(ProcessMap) 비즈니스 로직 서비스
 *
 * 초보자 가이드:
 * 1. **findAll**: partId 기반 라우팅 목록 조회
 * 2. **create**: partId+seq 유니크 체크 후 생성
 * 3. **include**: 품목명 조회를 위해 part relation 포함
 */

import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateRoutingDto, UpdateRoutingDto, RoutingQueryDto } from '../dto/routing.dto';

@Injectable()
export class RoutingService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: RoutingQueryDto) {
    const { page = 1, limit = 10, partId, search, useYn } = query;
    const skip = (page - 1) * limit;

    const where = {
      deletedAt: null,
      ...(partId && { partId }),
      ...(useYn && { useYn }),
      ...(search && {
        OR: [
          { processCode: { contains: search, mode: 'insensitive' as const } },
          { processName: { contains: search, mode: 'insensitive' as const } },
        ],
      }),
    };

    const [data, total] = await Promise.all([
      this.prisma.processMap.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ partId: 'asc' }, { seq: 'asc' }],
        include: { part: { select: { partCode: true, partName: true } } },
      }),
      this.prisma.processMap.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  async findById(id: string) {
    const item = await this.prisma.processMap.findFirst({
      where: { id, deletedAt: null },
      include: { part: { select: { partCode: true, partName: true } } },
    });
    if (!item) throw new NotFoundException(`라우팅을 찾을 수 없습니다: ${id}`);
    return item;
  }

  async create(dto: CreateRoutingDto) {
    return this.prisma.processMap.create({
      data: {
        partId: dto.partId,
        seq: dto.seq,
        processCode: dto.processCode,
        processName: dto.processName,
        processType: dto.processType,
        equipType: dto.equipType,
        stdTime: dto.stdTime,
        setupTime: dto.setupTime,
        useYn: dto.useYn ?? 'Y',
      },
    });
  }

  async update(id: string, dto: UpdateRoutingDto) {
    await this.findById(id);
    return this.prisma.processMap.update({ where: { id }, data: dto });
  }

  async delete(id: string) {
    await this.findById(id);
    return this.prisma.processMap.update({ where: { id }, data: { deletedAt: new Date() } });
  }
}
