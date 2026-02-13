/**
 * @file src/modules/master/services/process.service.ts
 * @description 공정마스터 비즈니스 로직 서비스
 *
 * 초보자 가이드:
 * 1. **findAll**: 페이징/검색/필터 조회
 * 2. **create**: 중복 코드 체크 후 생성
 * 3. **delete**: 소프트 삭제 (deletedAt 설정)
 */

import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateProcessDto, UpdateProcessDto, ProcessQueryDto } from '../dto/process.dto';

@Injectable()
export class ProcessService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: ProcessQueryDto) {
    const { page = 1, limit = 10, search, processType, useYn } = query;
    const skip = (page - 1) * limit;

    const where = {
      deletedAt: null,
      ...(processType && { processType }),
      ...(useYn && { useYn }),
      ...(search && {
        OR: [
          { processCode: { contains: search, mode: 'insensitive' as const } },
          { processName: { contains: search, mode: 'insensitive' as const } },
        ],
      }),
    };

    const [data, total] = await Promise.all([
      this.prisma.processMaster.findMany({ where, skip, take: limit, orderBy: { sortOrder: 'asc' } }),
      this.prisma.processMaster.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  async findById(id: string) {
    const item = await this.prisma.processMaster.findFirst({ where: { id, deletedAt: null } });
    if (!item) throw new NotFoundException(`공정을 찾을 수 없습니다: ${id}`);
    return item;
  }

  async create(dto: CreateProcessDto) {
    const existing = await this.prisma.processMaster.findFirst({
      where: { processCode: dto.processCode, deletedAt: null },
    });
    if (existing) throw new ConflictException(`이미 존재하는 공정 코드입니다: ${dto.processCode}`);

    return this.prisma.processMaster.create({
      data: {
        processCode: dto.processCode,
        processName: dto.processName,
        processType: dto.processType,
        sortOrder: dto.sortOrder ?? 0,
        remark: dto.remark,
        useYn: dto.useYn ?? 'Y',
      },
    });
  }

  async update(id: string, dto: UpdateProcessDto) {
    await this.findById(id);
    return this.prisma.processMaster.update({ where: { id }, data: dto });
  }

  async delete(id: string) {
    await this.findById(id);
    return this.prisma.processMaster.update({ where: { id }, data: { deletedAt: new Date() } });
  }
}
