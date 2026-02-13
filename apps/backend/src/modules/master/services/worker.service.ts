/**
 * @file src/modules/master/services/worker.service.ts
 * @description 작업자마스터 비즈니스 로직 서비스
 *
 * 초보자 가이드:
 * 1. **processIds**: JSON 타입으로 DB에 저장 (담당 공정 목록)
 * 2. **중복 체크**: workerCode 기준 유니크 제약
 */

import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateWorkerDto, UpdateWorkerDto, WorkerQueryDto } from '../dto/worker.dto';

@Injectable()
export class WorkerService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: WorkerQueryDto) {
    const { page = 1, limit = 10, search, dept, useYn } = query;
    const skip = (page - 1) * limit;

    const where = {
      deletedAt: null,
      ...(dept && { dept: { contains: dept, mode: 'insensitive' as const } }),
      ...(useYn && { useYn }),
      ...(search && {
        OR: [
          { workerCode: { contains: search, mode: 'insensitive' as const } },
          { workerName: { contains: search, mode: 'insensitive' as const } },
        ],
      }),
    };

    const [data, total] = await Promise.all([
      this.prisma.workerMaster.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' } }),
      this.prisma.workerMaster.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  async findById(id: string) {
    const item = await this.prisma.workerMaster.findFirst({ where: { id, deletedAt: null } });
    if (!item) throw new NotFoundException(`작업자를 찾을 수 없습니다: ${id}`);
    return item;
  }

  async create(dto: CreateWorkerDto) {
    const existing = await this.prisma.workerMaster.findFirst({
      where: { workerCode: dto.workerCode, deletedAt: null },
    });
    if (existing) throw new ConflictException(`이미 존재하는 작업자 코드입니다: ${dto.workerCode}`);

    return this.prisma.workerMaster.create({
      data: {
        workerCode: dto.workerCode,
        workerName: dto.workerName,
        dept: dto.dept,
        qrCode: dto.qrCode,
        processIds: dto.processIds ?? [],
        useYn: dto.useYn ?? 'Y',
      },
    });
  }

  async update(id: string, dto: UpdateWorkerDto) {
    await this.findById(id);
    return this.prisma.workerMaster.update({ where: { id }, data: dto });
  }

  async delete(id: string) {
    await this.findById(id);
    return this.prisma.workerMaster.update({ where: { id }, data: { deletedAt: new Date() } });
  }
}
