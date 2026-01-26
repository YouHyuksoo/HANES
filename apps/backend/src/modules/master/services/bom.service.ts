/**
 * @file src/modules/master/services/bom.service.ts
 * @description BOM 비즈니스 로직 서비스
 */

import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateBomDto, UpdateBomDto, BomQueryDto } from '../dto/bom.dto';

@Injectable()
export class BomService {
  constructor(private readonly prisma: PrismaService) {}

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
        orderBy: [{ parentPartId: 'asc' }, { revision: 'desc' }],
      }),
      this.prisma.bomMaster.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  async findById(id: string) {
    const bom = await this.prisma.bomMaster.findFirst({
      where: { id, deletedAt: null },
      include: {
        parentPart: true,
        childPart: true,
      },
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
      orderBy: { revision: 'desc' },
    });
  }

  async findHierarchy(parentPartId: string, depth: number = 3) {
    const buildTree = async (partId: string, currentDepth: number): Promise<any[]> => {
      if (currentDepth > depth) return [];

      const children = await this.prisma.bomMaster.findMany({
        where: { parentPartId: partId, deletedAt: null, useYn: 'Y' },
        include: { childPart: true },
      });

      return Promise.all(
        children.map(async (child) => ({
          ...child,
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
        revision: dto.revision ?? 'A',
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
