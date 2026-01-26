/**
 * @file src/modules/master/services/plant.service.ts
 * @description 공장/라인 비즈니스 로직 서비스
 */

import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreatePlantDto, UpdatePlantDto, PlantQueryDto } from '../dto/plant.dto';

@Injectable()
export class PlantService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: PlantQueryDto) {
    const { page = 1, limit = 10, plantType, search, useYn, parentId } = query;
    const skip = (page - 1) * limit;

    const where = {
      deletedAt: null,
      ...(plantType && { plantType }),
      ...(useYn && { useYn }),
      ...(parentId && { parentId }),
      ...(search && {
        OR: [
          { plantCode: { contains: search, mode: 'insensitive' as const } },
          { plantName: { contains: search, mode: 'insensitive' as const } },
        ],
      }),
    };

    const [data, total] = await Promise.all([
      this.prisma.plant.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ plantType: 'asc' }, { sortOrder: 'asc' }],
        include: { parent: { select: { id: true, plantName: true } } },
      }),
      this.prisma.plant.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  async findById(id: string) {
    const plant = await this.prisma.plant.findFirst({
      where: { id, deletedAt: null },
      include: { parent: true, children: { where: { deletedAt: null } } },
    });

    if (!plant) throw new NotFoundException(`공장/라인을 찾을 수 없습니다: ${id}`);
    return plant;
  }

  async findHierarchy(rootId?: string) {
    return this.prisma.plant.findMany({
      where: { deletedAt: null, ...(rootId ? { id: rootId } : { parentId: null }) },
      orderBy: [{ sortOrder: 'asc' }],
      include: {
        children: {
          where: { deletedAt: null },
          include: { children: { where: { deletedAt: null } } },
        },
      },
    });
  }

  async create(dto: CreatePlantDto) {
    const existing = await this.prisma.plant.findFirst({
      where: {
        plantCode: dto.plantCode,
        shopCode: dto.shopCode ?? null,
        lineCode: dto.lineCode ?? null,
        cellCode: dto.cellCode ?? null,
        deletedAt: null,
      },
    });

    if (existing) throw new ConflictException(`이미 존재하는 공장/라인입니다`);

    return this.prisma.plant.create({
      data: {
        plantCode: dto.plantCode,
        shopCode: dto.shopCode,
        lineCode: dto.lineCode,
        cellCode: dto.cellCode,
        plantName: dto.plantName,
        plantType: dto.plantType,
        parentId: dto.parentId,
        sortOrder: dto.sortOrder ?? 0,
        useYn: dto.useYn ?? 'Y',
      },
    });
  }

  async update(id: string, dto: UpdatePlantDto) {
    await this.findById(id);
    return this.prisma.plant.update({ where: { id }, data: dto });
  }

  async delete(id: string) {
    await this.findById(id);
    const childCount = await this.prisma.plant.count({ where: { parentId: id, deletedAt: null } });
    if (childCount > 0) throw new ConflictException(`하위 항목이 존재합니다`);
    return this.prisma.plant.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  async findByType(plantType: string) {
    return this.prisma.plant.findMany({
      where: { plantType, useYn: 'Y', deletedAt: null },
      orderBy: [{ sortOrder: 'asc' }],
    });
  }
}
