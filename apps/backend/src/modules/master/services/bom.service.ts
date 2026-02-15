/**
 * @file src/modules/master/services/bom.service.ts
 * @description BOM 비즈니스 로직 서비스 - Oracle TM_BOM 기준 보강
 *
 * 초보자 가이드:
 * 1. **findParents**: BOM에 등재된 모품목(부모품목) 목록 조회
 * 2. **findHierarchy**: 부모품목 ID 기준 재귀 트리 구조 조회
 * 3. **CRUD**: 추가/수정/삭제 모두 DB에 반영
 */

import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateBomDto, UpdateBomDto, BomQueryDto } from '../dto/bom.dto';

@Injectable()
export class BomService {
  constructor(private readonly prisma: PrismaService) {}

  /** BOM에 등재된 모품목(부모품목) 목록 + 자품목 수 */
  async findParents(search?: string) {
    const where: any = { deletedAt: null, useYn: 'Y' };
    if (search) {
      where.parentPart = {
        OR: [
          { partCode: { contains: search, mode: 'insensitive' } },
          { partName: { contains: search, mode: 'insensitive' } },
          { partNo: { contains: search, mode: 'insensitive' } },
        ],
      };
    }

    const grouped = await this.prisma.bomMaster.groupBy({
      by: ['parentPartId'],
      where,
      _count: { id: true },
    });

    if (grouped.length === 0) return [];

    const parentIds = grouped.map((g) => g.parentPartId);
    const parents = await this.prisma.partMaster.findMany({
      where: { id: { in: parentIds }, deletedAt: null },
      select: { id: true, partCode: true, partName: true, partNo: true, partType: true },
      orderBy: { partCode: 'asc' },
    });

    const countMap = new Map(grouped.map((g) => [g.parentPartId, g._count.id]));
    return parents.map((p) => ({
      ...p,
      bomCount: countMap.get(p.id) || 0,
    }));
  }

  async findAll(query: BomQueryDto) {
    const { page = 1, limit = 10, parentPartId, childPartId, revision } = query;
    const skip = (page - 1) * limit;

    const where = {
      deletedAt: null,
      ...(parentPartId && { parentPartId }),
      ...(childPartId && { childPartId }),
      ...(revision && { revision }),
    };

    const [data, total] = await Promise.all([
      this.prisma.bomMaster.findMany({
        where,
        skip,
        take: limit,
        include: {
          parentPart: { select: { id: true, partCode: true, partName: true } },
          childPart: { select: { id: true, partCode: true, partName: true, unit: true } },
        },
        orderBy: [{ parentPartId: 'asc' }, { seq: 'asc' }],
      }),
      this.prisma.bomMaster.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  async findById(id: string) {
    const bom = await this.prisma.bomMaster.findFirst({
      where: { id, deletedAt: null },
      include: { parentPart: true, childPart: true },
    });
    if (!bom) throw new NotFoundException(`BOM을 찾을 수 없습니다: ${id}`);
    return bom;
  }

  async findByParentId(parentPartId: string) {
    return this.prisma.bomMaster.findMany({
      where: { parentPartId, deletedAt: null, useYn: 'Y' },
      include: {
        childPart: { select: { id: true, partCode: true, partName: true, unit: true, partType: true } },
      },
      orderBy: { seq: 'asc' },
    });
  }

  /** 재귀 트리 BOM 구조 조회 (depth 제한) */
  async findHierarchy(parentPartId: string, depth: number = 3) {
    const buildTree = async (partId: string, currentDepth: number): Promise<any[]> => {
      if (currentDepth > depth) return [];

      const children = await this.prisma.bomMaster.findMany({
        where: { parentPartId: partId, deletedAt: null, useYn: 'Y' },
        include: {
          childPart: {
            select: { id: true, partCode: true, partName: true, partType: true, unit: true, rev: true },
          },
        },
        orderBy: { seq: 'asc' },
      });

      return Promise.all(
        children.map(async (child) => ({
          id: child.id,
          level: currentDepth,
          partCode: child.childPart.partCode,
          partName: child.childPart.partName,
          partType: child.childPart.partType,
          qtyPer: Number(child.qtyPer),
          unit: child.childPart.unit,
          revision: child.revision,
          seq: child.seq,
          oper: child.oper,
          side: child.side,
          validFrom: child.validFrom,
          validTo: child.validTo,
          useYn: child.useYn,
          childPartId: child.childPartId,
          children: await buildTree(child.childPartId, currentDepth + 1),
        })),
      );
    };

    return buildTree(parentPartId, 1);
  }

  async create(dto: CreateBomDto) {
    if (dto.parentPartId === dto.childPartId) {
      throw new ConflictException('상위 품목과 하위 품목이 같을 수 없습니다.');
    }

    const existing = await this.prisma.bomMaster.findFirst({
      where: {
        parentPartId: dto.parentPartId,
        childPartId: dto.childPartId,
        revision: dto.revision ?? 'A',
        deletedAt: null,
      },
    });
    if (existing) throw new ConflictException('이미 존재하는 BOM입니다.');

    return this.prisma.bomMaster.create({
      data: {
        parentPartId: dto.parentPartId,
        childPartId: dto.childPartId,
        qtyPer: dto.qtyPer,
        seq: dto.seq ?? 0,
        revision: dto.revision ?? 'A',
        bomGrp: dto.bomGrp,
        oper: dto.oper,
        side: dto.side,
        ecoNo: dto.ecoNo,
        validFrom: dto.validFrom ? new Date(dto.validFrom) : undefined,
        validTo: dto.validTo ? new Date(dto.validTo) : undefined,
        remark: dto.remark,
        useYn: dto.useYn ?? 'Y',
      },
      include: { parentPart: true, childPart: true },
    });
  }

  async update(id: string, dto: UpdateBomDto) {
    await this.findById(id);
    return this.prisma.bomMaster.update({
      where: { id },
      data: {
        ...(dto.qtyPer !== undefined && { qtyPer: dto.qtyPer }),
        ...(dto.seq !== undefined && { seq: dto.seq }),
        ...(dto.bomGrp !== undefined && { bomGrp: dto.bomGrp }),
        ...(dto.oper !== undefined && { oper: dto.oper }),
        ...(dto.side !== undefined && { side: dto.side }),
        ...(dto.ecoNo !== undefined && { ecoNo: dto.ecoNo }),
        ...(dto.validFrom !== undefined && { validFrom: dto.validFrom ? new Date(dto.validFrom) : null }),
        ...(dto.validTo !== undefined && { validTo: dto.validTo ? new Date(dto.validTo) : null }),
        ...(dto.remark !== undefined && { remark: dto.remark }),
        ...(dto.useYn !== undefined && { useYn: dto.useYn }),
      },
      include: { parentPart: true, childPart: true },
    });
  }

  async delete(id: string) {
    await this.findById(id);
    return this.prisma.bomMaster.update({ where: { id }, data: { deletedAt: new Date() } });
  }
}
