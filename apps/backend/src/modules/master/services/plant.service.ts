/**
 * @file src/modules/master/services/plant.service.ts
 * @description 공장/라인 비즈니스 로직 서비스 - TypeORM Repository 패턴
 */

import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { Plant } from '../../../entities/plant.entity';
import { CreatePlantDto, UpdatePlantDto, PlantQueryDto } from '../dto/plant.dto';

@Injectable()
export class PlantService {
  constructor(
    @InjectRepository(Plant)
    private readonly plantRepository: Repository<Plant>,
  ) {}

  async findAll(query: PlantQueryDto, company?: string) {
    const { page = 1, limit = 10, plantType, search, useYn, parentId } = query;
    const skip = (page - 1) * limit;

    const queryBuilder = this.plantRepository.createQueryBuilder('plant')
      .leftJoinAndSelect('plant.parent', 'parent')
      .where('plant.deletedAt IS NULL');

    if (company) {
      queryBuilder.andWhere('plant.company = :company', { company });
    }

    if (plantType) {
      queryBuilder.andWhere('plant.plantType = :plantType', { plantType });
    }

    if (useYn) {
      queryBuilder.andWhere('plant.useYn = :useYn', { useYn });
    }

    if (parentId) {
      queryBuilder.andWhere('plant.parentId = :parentId', { parentId });
    }

    if (search) {
      queryBuilder.andWhere(
        '(UPPER(plant.plantCode) LIKE UPPER(:search) OR UPPER(plant.plantName) LIKE UPPER(:search))',
        { search: `%${search}%` }
      );
    }

    const [data, total] = await Promise.all([
      queryBuilder
        .orderBy('plant.plantType', 'ASC')
        .addOrderBy('plant.sortOrder', 'ASC')
        .skip(skip)
        .take(limit)
        .getMany(),
      queryBuilder.getCount(),
    ]);

    return { data, total, page, limit };
  }

  async findById(id: string) {
    const plant = await this.plantRepository.findOne({
      where: { id, deletedAt: IsNull() },
      relations: ['parent', 'children'],
    });

    if (!plant) throw new NotFoundException(`공장/라인을 찾을 수 없습니다: ${id}`);
    return plant;
  }

  async findHierarchy(rootId?: string) {
    const where: any = { deletedAt: IsNull() };
    if (rootId) {
      where.id = rootId;
    } else {
      where.parentId = IsNull();
    }

    return this.plantRepository.find({
      where,
      order: { sortOrder: 'asc' },
      relations: ['children', 'children.children'],
    });
  }

  async create(dto: CreatePlantDto) {
    const existing = await this.plantRepository.findOne({
      where: {
        plantCode: dto.plantCode,
        shopCode: dto.shopCode ?? IsNull(),
        lineCode: dto.lineCode ?? IsNull(),
        cellCode: dto.cellCode ?? IsNull(),
        deletedAt: IsNull(),
      },
    });

    if (existing) throw new ConflictException(`이미 존재하는 공장/라인입니다`);

    const plant = this.plantRepository.create({
      plantCode: dto.plantCode,
      shopCode: dto.shopCode,
      lineCode: dto.lineCode,
      cellCode: dto.cellCode,
      plantName: dto.plantName,
      plantType: dto.plantType,
      parentId: dto.parentId,
      sortOrder: dto.sortOrder ?? 0,
      useYn: dto.useYn ?? 'Y',
    });

    return this.plantRepository.save(plant);
  }

  async update(id: string, dto: UpdatePlantDto) {
    await this.findById(id);
    await this.plantRepository.update(id, dto);
    return this.findById(id);
  }

  async delete(id: string) {
    await this.findById(id);
    const childCount = await this.plantRepository.count({
      where: { parentId: id, deletedAt: IsNull() },
    });
    if (childCount > 0) throw new ConflictException(`하위 항목이 존재합니다`);
    
    await this.plantRepository.update(id, { deletedAt: new Date() });
    return { id, deletedAt: new Date() };
  }

  async findByType(plantType: string) {
    return this.plantRepository.find({
      where: { plantType, useYn: 'Y', deletedAt: IsNull() },
      order: { sortOrder: 'asc' },
    });
  }

}
