/**
 * @file src/modules/master/services/equip-inspect.service.ts
 * @description 설비점검항목마스터 비즈니스 로직 서비스
 */

import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, Like } from 'typeorm';
import { EquipInspectItemMaster } from '../../../entities/equip-inspect-item-master.entity';
import { CreateEquipInspectItemDto, UpdateEquipInspectItemDto, EquipInspectItemQueryDto } from '../dto/equip-inspect.dto';

@Injectable()
export class EquipInspectService {
  constructor(
    @InjectRepository(EquipInspectItemMaster)
    private readonly equipInspectRepository: Repository<EquipInspectItemMaster>,
  ) {}

  async findAll(query: EquipInspectItemQueryDto) {
    const { page = 1, limit = 10, equipId, inspectType, search, useYn } = query;

    const queryBuilder = this.equipInspectRepository.createQueryBuilder('item')
      .where('item.deletedAt IS NULL');

    if (equipId) {
      queryBuilder.andWhere('item.equipId = :equipId', { equipId });
    }

    if (inspectType) {
      queryBuilder.andWhere('item.inspectType = :inspectType', { inspectType });
    }

    if (useYn) {
      queryBuilder.andWhere('item.useYn = :useYn', { useYn });
    }

    if (search) {
      queryBuilder.andWhere(
        '(item.itemName LIKE :search OR item.equipId LIKE :search)',
        { search: `%${search}%` },
      );
    }

    const [data, total] = await queryBuilder
      .orderBy('item.equipId', 'ASC')
      .addOrderBy('item.seq', 'ASC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return { data, total, page, limit };
  }

  async findById(id: string) {
    const item = await this.equipInspectRepository.findOne({
      where: { id, deletedAt: IsNull() },
    });

    if (!item) {
      throw new NotFoundException('설비점검항목을 찾을 수 없습니다.');
    }

    return item;
  }

  async create(dto: CreateEquipInspectItemDto) {
    const entity = this.equipInspectRepository.create(dto);
    const saved = await this.equipInspectRepository.save(entity);
    return saved;
  }

  async update(id: string, dto: UpdateEquipInspectItemDto) {
    const item = await this.findById(id);

    const updated = await this.equipInspectRepository.save({
      ...item,
      ...dto,
      id,
    });

    return updated;
  }

  async delete(id: string) {
    const item = await this.findById(id);

    await this.equipInspectRepository.softRemove(item);

    return { id, deleted: true };
  }
}
