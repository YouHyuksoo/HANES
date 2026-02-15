/**
 * @file src/modules/master/services/part.service.ts
 * @description 품목마스터 비즈니스 로직 서비스 - Oracle TM_ITEMS 기준 10개 컬럼 보강
 */

import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreatePartDto, UpdatePartDto, PartQueryDto } from '../dto/part.dto';

@Injectable()
export class PartService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: PartQueryDto) {
    const { page = 1, limit = 20, partType, search, customer, useYn } = query;
    const skip = (page - 1) * limit;

    const where = {
      deletedAt: null,
      ...(partType && { partType }),
      ...(useYn && { useYn }),
      ...(customer && { customer: { contains: customer, mode: 'insensitive' as const } }),
      ...(search && {
        OR: [
          { partCode: { contains: search, mode: 'insensitive' as const } },
          { partName: { contains: search, mode: 'insensitive' as const } },
          { partNo: { contains: search, mode: 'insensitive' as const } },
          { custPartNo: { contains: search, mode: 'insensitive' as const } },
          { spec: { contains: search, mode: 'insensitive' as const } },
        ],
      }),
    };

    const [data, total] = await Promise.all([
      this.prisma.partMaster.findMany({ where, skip, take: limit, orderBy: { partCode: 'asc' } }),
      this.prisma.partMaster.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  async findById(id: string) {
    const part = await this.prisma.partMaster.findFirst({ where: { id, deletedAt: null } });
    if (!part) throw new NotFoundException(`품목을 찾을 수 없습니다: ${id}`);
    return part;
  }

  async findByCode(partCode: string) {
    const part = await this.prisma.partMaster.findFirst({ where: { partCode, deletedAt: null } });
    if (!part) throw new NotFoundException(`품목을 찾을 수 없습니다: ${partCode}`);
    return part;
  }

  async create(dto: CreatePartDto) {
    const existing = await this.prisma.partMaster.findFirst({
      where: { partCode: dto.partCode, deletedAt: null },
    });

    if (existing) throw new ConflictException(`이미 존재하는 품목 코드입니다: ${dto.partCode}`);

    return this.prisma.partMaster.create({
      data: {
        partCode: dto.partCode,
        partName: dto.partName,
        partNo: dto.partNo,
        custPartNo: dto.custPartNo,
        partType: dto.partType,
        productType: dto.productType,
        spec: dto.spec,
        rev: dto.rev,
        unit: dto.unit ?? 'EA',
        drawNo: dto.drawNo,
        customer: dto.customer,
        vendor: dto.vendor,
        leadTime: dto.leadTime ?? 0,
        safetyStock: dto.safetyStock ?? 0,
        lotUnitQty: dto.lotUnitQty,
        boxQty: dto.boxQty ?? 0,
        iqcFlag: dto.iqcFlag ?? 'Y',
        tactTime: dto.tactTime ?? 0,
        expiryDate: dto.expiryDate ?? 0,
        remarks: dto.remarks,
        useYn: dto.useYn ?? 'Y',
      },
    });
  }

  async update(id: string, dto: UpdatePartDto) {
    await this.findById(id);
    return this.prisma.partMaster.update({ where: { id }, data: dto });
  }

  async delete(id: string) {
    await this.findById(id);
    return this.prisma.partMaster.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  async findByType(partType: string) {
    return this.prisma.partMaster.findMany({
      where: { partType, useYn: 'Y', deletedAt: null },
      orderBy: { partCode: 'asc' },
    });
  }
}
