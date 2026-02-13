/**
 * @file src/modules/master/services/model-suffix.service.ts
 * @description 모델접미사 비즈니스 로직 서비스
 *
 * 초보자 가이드:
 * 1. **findAll**: modelCode, customer 기반 접미사 조회
 * 2. **중복 체크**: modelCode + suffixCode 유니크 조합
 */

import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateModelSuffixDto, UpdateModelSuffixDto, ModelSuffixQueryDto } from '../dto/model-suffix.dto';

@Injectable()
export class ModelSuffixService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: ModelSuffixQueryDto) {
    const { page = 1, limit = 10, search, modelCode, customer, useYn } = query;
    const skip = (page - 1) * limit;

    const where = {
      deletedAt: null,
      ...(modelCode && { modelCode: { contains: modelCode, mode: 'insensitive' as const } }),
      ...(customer && { customer: { contains: customer, mode: 'insensitive' as const } }),
      ...(useYn && { useYn }),
      ...(search && {
        OR: [
          { modelCode: { contains: search, mode: 'insensitive' as const } },
          { suffixCode: { contains: search, mode: 'insensitive' as const } },
          { suffixName: { contains: search, mode: 'insensitive' as const } },
        ],
      }),
    };

    const [data, total] = await Promise.all([
      this.prisma.modelSuffix.findMany({ where, skip, take: limit, orderBy: [{ modelCode: 'asc' }, { suffixCode: 'asc' }] }),
      this.prisma.modelSuffix.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  async findById(id: string) {
    const item = await this.prisma.modelSuffix.findFirst({ where: { id, deletedAt: null } });
    if (!item) throw new NotFoundException(`모델접미사를 찾을 수 없습니다: ${id}`);
    return item;
  }

  async create(dto: CreateModelSuffixDto) {
    const existing = await this.prisma.modelSuffix.findFirst({
      where: { modelCode: dto.modelCode, suffixCode: dto.suffixCode, deletedAt: null },
    });
    if (existing) throw new ConflictException(`이미 존재하는 모델접미사입니다: ${dto.modelCode}-${dto.suffixCode}`);

    return this.prisma.modelSuffix.create({
      data: {
        modelCode: dto.modelCode,
        suffixCode: dto.suffixCode,
        suffixName: dto.suffixName,
        customer: dto.customer,
        remark: dto.remark,
        useYn: dto.useYn ?? 'Y',
      },
    });
  }

  async update(id: string, dto: UpdateModelSuffixDto) {
    await this.findById(id);
    return this.prisma.modelSuffix.update({ where: { id }, data: dto });
  }

  async delete(id: string) {
    await this.findById(id);
    return this.prisma.modelSuffix.update({ where: { id }, data: { deletedAt: new Date() } });
  }
}
