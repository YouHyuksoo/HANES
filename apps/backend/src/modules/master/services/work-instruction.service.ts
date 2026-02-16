/**
 * @file src/modules/master/services/work-instruction.service.ts
 * @description 작업지도서 비즈니스 로직 서비스
 *
 * 초보자 가이드:
 * 1. **findAll**: partId, processCode 기반 작업지도서 조회
 * 2. **include**: 품목명 조회를 위해 part relation 포함
 */

import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateWorkInstructionDto, UpdateWorkInstructionDto, WorkInstructionQueryDto } from '../dto/work-instruction.dto';

@Injectable()
export class WorkInstructionService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: WorkInstructionQueryDto) {
    const { page = 1, limit = 10, partId, processCode, search, useYn } = query;
    const skip = (page - 1) * limit;

    const where = {
      deletedAt: null,
      ...(partId && { partId }),
      ...(processCode && { processCode }),
      ...(useYn && { useYn }),
      ...(search && {
        OR: [
          { title: { contains: search, mode: 'insensitive' as const } },
          { content: { contains: search, mode: 'insensitive' as const } },
        ],
      }),
    };

    const [items, total] = await Promise.all([
      this.prisma.workInstruction.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { part: { select: { partCode: true, partName: true } } },
      }),
      this.prisma.workInstruction.count({ where }),
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
    const item = await this.prisma.workInstruction.findFirst({
      where: { id, deletedAt: null },
      include: { part: { select: { partCode: true, partName: true } } },
    });
    if (!item) throw new NotFoundException(`작업지도서를 찾을 수 없습니다: ${id}`);
    
    // 평면화
    return {
      ...item,
      partCode: item.part?.partCode || null,
      partName: item.part?.partName || null,
    };
  }

  async create(dto: CreateWorkInstructionDto) {
    return this.prisma.workInstruction.create({
      data: {
        partId: dto.partId,
        processCode: dto.processCode,
        title: dto.title,
        content: dto.content,
        imageUrl: dto.imageUrl,
        revision: dto.revision ?? 'A',
        useYn: dto.useYn ?? 'Y',
      },
    });
  }

  async update(id: string, dto: UpdateWorkInstructionDto) {
    await this.findById(id);
    return this.prisma.workInstruction.update({ where: { id }, data: dto });
  }

  async delete(id: string) {
    await this.findById(id);
    return this.prisma.workInstruction.update({ where: { id }, data: { deletedAt: new Date() } });
  }
}
