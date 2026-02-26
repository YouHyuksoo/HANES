/**
 * @file src/modules/master/services/plant.service.ts
 * @description 공장/라인 비즈니스 로직 서비스 - TypeORM Repository 패턴
 */

import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Plant } from '../../../entities/plant.entity';
import { CreatePlantDto, UpdatePlantDto, PlantQueryDto } from '../dto/plant.dto';

@Injectable()
export class PlantService {
  constructor(
    @InjectRepository(Plant)
    private readonly plantRepository: Repository<Plant>,
  ) {}

  async findAll(query: PlantQueryDto, company?: string) {
    const { page = 1, limit = 10, plantType, search, useYn } = query;
    const skip = (page - 1) * limit;

    const queryBuilder = this.plantRepository.createQueryBuilder('plant')

    if (company) {
      queryBuilder.andWhere('plant.company = :company', { company });
    }

    if (plantType) {
      queryBuilder.andWhere('plant.plantType = :plantType', { plantType });
    }

    if (useYn) {
      queryBuilder.andWhere('plant.useYn = :useYn', { useYn });
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

  async findById(plantCode: string, shopCode = '-', lineCode = '-', cellCode = '-') {
    const plant = await this.plantRepository.findOne({
      where: { plantCode, shopCode, lineCode, cellCode },
    });

    if (!plant) throw new NotFoundException(`공장/라인을 찾을 수 없습니다: ${plantCode}/${shopCode}/${lineCode}/${cellCode}`);
    return plant;
  }

  async findHierarchy(plantCode?: string) {
    const where: any = {};
    if (plantCode) {
      where.plantCode = plantCode;
    }

    return this.plantRepository.find({
      where,
      order: { sortOrder: 'asc' },
    });
  }

  async create(dto: CreatePlantDto) {
    const existing = await this.plantRepository.findOne({
      where: {
        plantCode: dto.plantCode,
        shopCode: dto.shopCode ?? '-',
        lineCode: dto.lineCode ?? '-',
        cellCode: dto.cellCode ?? '-',
      },
    });

    if (existing) throw new ConflictException(`이미 존재하는 공장/라인입니다`);

    const plant = this.plantRepository.create({
      plantCode: dto.plantCode,
      shopCode: dto.shopCode ?? '-',
      lineCode: dto.lineCode ?? '-',
      cellCode: dto.cellCode ?? '-',
      plantName: dto.plantName,
      plantType: dto.plantType,
      sortOrder: dto.sortOrder ?? 0,
      useYn: dto.useYn ?? 'Y',
    });

    return this.plantRepository.save(plant);
  }

  async update(plantCode: string, dto: UpdatePlantDto, shopCode = '-', lineCode = '-', cellCode = '-') {
    await this.findById(plantCode, shopCode, lineCode, cellCode);
    await this.plantRepository.update({ plantCode, shopCode, lineCode, cellCode }, dto);
    return this.findById(plantCode, shopCode, lineCode, cellCode);
  }

  async delete(plantCode: string, shopCode = '-', lineCode = '-', cellCode = '-') {
    await this.findById(plantCode, shopCode, lineCode, cellCode);

    await this.plantRepository.delete({ plantCode, shopCode, lineCode, cellCode });
    return { plantCode, shopCode, lineCode, cellCode };
  }

  async findByType(plantType: string) {
    return this.plantRepository.find({
      where: { plantType, useYn: 'Y' },
      order: { sortOrder: 'asc' },
    });
  }

}
