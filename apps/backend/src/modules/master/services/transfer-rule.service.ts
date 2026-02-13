/**
 * @file src/modules/master/services/transfer-rule.service.ts
 * @description 창고이동규칙 비즈니스 로직 서비스
 *
 * 초보자 가이드:
 * 1. **findAll**: 출발/도착 창고 기반 규칙 조회
 * 2. **include**: 창고명 조회를 위해 warehouse relation 포함
 */

import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateTransferRuleDto, UpdateTransferRuleDto, TransferRuleQueryDto } from '../dto/transfer-rule.dto';

@Injectable()
export class TransferRuleService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: TransferRuleQueryDto) {
    const { page = 1, limit = 10, fromWarehouseId, toWarehouseId, search, allowYn } = query;
    const skip = (page - 1) * limit;

    const where = {
      deletedAt: null,
      ...(fromWarehouseId && { fromWarehouseId }),
      ...(toWarehouseId && { toWarehouseId }),
      ...(allowYn && { allowYn }),
      ...(search && {
        OR: [
          { remark: { contains: search, mode: 'insensitive' as const } },
        ],
      }),
    };

    const [data, total] = await Promise.all([
      this.prisma.warehouseTransferRule.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          fromWarehouse: { select: { warehouseCode: true, warehouseName: true } },
          toWarehouse: { select: { warehouseCode: true, warehouseName: true } },
        },
      }),
      this.prisma.warehouseTransferRule.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  async findById(id: string) {
    const item = await this.prisma.warehouseTransferRule.findFirst({
      where: { id, deletedAt: null },
      include: {
        fromWarehouse: { select: { warehouseCode: true, warehouseName: true } },
        toWarehouse: { select: { warehouseCode: true, warehouseName: true } },
      },
    });
    if (!item) throw new NotFoundException(`창고이동규칙을 찾을 수 없습니다: ${id}`);
    return item;
  }

  async create(dto: CreateTransferRuleDto) {
    const existing = await this.prisma.warehouseTransferRule.findFirst({
      where: {
        fromWarehouseId: dto.fromWarehouseId,
        toWarehouseId: dto.toWarehouseId,
        deletedAt: null,
      },
    });
    if (existing) throw new ConflictException('이미 존재하는 창고이동규칙입니다.');

    return this.prisma.warehouseTransferRule.create({
      data: {
        fromWarehouseId: dto.fromWarehouseId,
        toWarehouseId: dto.toWarehouseId,
        allowYn: dto.allowYn ?? 'Y',
        remark: dto.remark,
      },
    });
  }

  async update(id: string, dto: UpdateTransferRuleDto) {
    await this.findById(id);
    return this.prisma.warehouseTransferRule.update({ where: { id }, data: dto });
  }

  async delete(id: string) {
    await this.findById(id);
    return this.prisma.warehouseTransferRule.update({ where: { id }, data: { deletedAt: new Date() } });
  }
}
