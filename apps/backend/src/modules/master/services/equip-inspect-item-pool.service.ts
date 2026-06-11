import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EquipInspectItemPool } from '../../../entities/equip-inspect-item-pool.entity';
import {
  CreateEquipInspectItemPoolDto,
  EquipInspectItemPoolQueryDto,
  UpdateEquipInspectItemPoolDto,
} from '../dto/equip-inspect-item-pool.dto';

@Injectable()
export class EquipInspectItemPoolService {
  constructor(
    @InjectRepository(EquipInspectItemPool)
    private readonly repo: Repository<EquipInspectItemPool>,
  ) {}

  async findAll(query: EquipInspectItemPoolQueryDto, company?: string, plant?: string) {
    const { page = 1, limit = 50, search, inspectType, useYn } = query;
    const qb = this.repo.createQueryBuilder('item');

    if (company) qb.andWhere('item.company = :company', { company });
    if (plant) qb.andWhere('item.plant = :plant', { plant });
    if (inspectType) qb.andWhere('item.inspectType = :inspectType', { inspectType });
    if (useYn) qb.andWhere('item.useYn = :useYn', { useYn });
    if (search) {
      qb.andWhere('(item.itemCode LIKE :search OR item.itemName LIKE :search)', {
        search: `%${search}%`,
      });
    }

    const [data, total] = await qb
      .orderBy('item.itemCode', 'ASC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return { data, total, page, limit };
  }

  async findByCode(company: string, plant: string, itemCode: string) {
    const item = await this.repo.findOne({
      where: { company, plant, itemCode, useYn: 'Y' },
    });
    if (!item) {
      throw new NotFoundException(`점검항목 마스터를 찾을 수 없습니다: ${itemCode}`);
    }
    return item;
  }

  async create(dto: CreateEquipInspectItemPoolDto, company: string, plant: string) {
    const existing = await this.repo.findOne({
      where: { company, plant, itemCode: dto.itemCode },
    });
    if (existing) {
      throw new ConflictException(`이미 존재하는 점검항목 코드입니다: ${dto.itemCode}`);
    }

    const entity = this.repo.create({
      company,
      plant,
      itemCode: dto.itemCode,
      itemName: dto.itemName,
      inspectType: dto.inspectType,
      criteria: dto.criteria ?? null,
      cycle: dto.cycle ?? null,
      useYn: dto.useYn ?? 'Y',
      itemType: dto.itemType ?? 'VISUAL',
      unit: dto.unit ?? null,
      lslValue: dto.lslValue ?? null,
      uslValue: dto.uslValue ?? null,
      remark: dto.remark ?? null,
    });
    return this.repo.save(entity);
  }

  async update(company: string, plant: string, itemCode: string, dto: UpdateEquipInspectItemPoolDto) {
    const item = await this.repo.findOne({ where: { company, plant, itemCode } });
    if (!item) {
      throw new NotFoundException(`점검항목 마스터를 찾을 수 없습니다: ${itemCode}`);
    }

    const updateData: Partial<EquipInspectItemPool> = {
      ...(dto.itemName !== undefined ? { itemName: dto.itemName } : {}),
      ...(dto.inspectType !== undefined ? { inspectType: dto.inspectType } : {}),
      ...(dto.criteria !== undefined ? { criteria: dto.criteria } : {}),
      ...(dto.cycle !== undefined ? { cycle: dto.cycle } : {}),
      ...(dto.useYn !== undefined ? { useYn: dto.useYn } : {}),
      ...(dto.itemType !== undefined ? { itemType: dto.itemType } : {}),
      ...(dto.unit !== undefined ? { unit: dto.unit } : {}),
      ...(dto.lslValue !== undefined ? { lslValue: dto.lslValue } : {}),
      ...(dto.uslValue !== undefined ? { uslValue: dto.uslValue } : {}),
      ...(dto.remark !== undefined ? { remark: dto.remark } : {}),
    };
    Object.assign(item, updateData);
    return this.repo.save(item);
  }

  async delete(company: string, plant: string, itemCode: string) {
    const item = await this.repo.findOne({ where: { company, plant, itemCode } });
    if (!item) {
      throw new NotFoundException(`점검항목 마스터를 찾을 수 없습니다: ${itemCode}`);
    }
    await this.repo.remove(item);
    return { itemCode, deleted: true };
  }
}
