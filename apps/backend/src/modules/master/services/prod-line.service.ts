/**
 * @file src/modules/master/services/prod-line.service.ts
 * @description 생산라인마스터 비즈니스 로직 서비스
 */

import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateProdLineDto, UpdateProdLineDto, ProdLineQueryDto } from '../dto/prod-line.dto';

@Injectable()
export class ProdLineService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: ProdLineQueryDto, company?: string) {
    const { page = 1, limit = 50, search, useYn } = query;
    const skip = (page - 1) * limit;

    const where = {
      deletedAt: null,
      ...(company && { company }),
      ...(useYn && { useYn }),
      ...(search && {
        OR: [
          { lineCode: { contains: search, mode: 'insensitive' as const } },
          { lineName: { contains: search, mode: 'insensitive' as const } },
          { oper: { contains: search, mode: 'insensitive' as const } },
        ],
      }),
    };

    const [data, total] = await Promise.all([
      this.prisma.prodLineMaster.findMany({ where, skip, take: limit, orderBy: { lineCode: 'asc' } }),
      this.prisma.prodLineMaster.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  async findById(id: string) {
    const line = await this.prisma.prodLineMaster.findFirst({ where: { id, deletedAt: null } });
    if (!line) throw new NotFoundException(`생산라인을 찾을 수 없습니다: ${id}`);
    return line;
  }

  async create(dto: CreateProdLineDto) {
    const existing = await this.prisma.prodLineMaster.findFirst({
      where: { lineCode: dto.lineCode, deletedAt: null },
    });
    if (existing) throw new ConflictException(`이미 존재하는 라인 코드입니다: ${dto.lineCode}`);

    return this.prisma.prodLineMaster.create({
      data: {
        lineCode: dto.lineCode,
        lineName: dto.lineName,
        whLoc: dto.whLoc,
        erpCode: dto.erpCode,
        oper: dto.oper,
        lineType: dto.lineType,
        remark: dto.remark,
        useYn: dto.useYn ?? 'Y',
      },
    });
  }

  async update(id: string, dto: UpdateProdLineDto) {
    await this.findById(id);
    return this.prisma.prodLineMaster.update({ where: { id }, data: dto });
  }

  async delete(id: string) {
    await this.findById(id);
    return this.prisma.prodLineMaster.update({ where: { id }, data: { deletedAt: new Date() } });
  }
}
