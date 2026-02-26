/**
 * @file src/modules/master/services/iqc-item.service.ts
 * @description IQC 검사항목마스터 비즈니스 로직 서비스
 */

import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IqcItemMaster } from '../../../entities/iqc-item-master.entity';
import { CreateIqcItemDto, UpdateIqcItemDto, IqcItemQueryDto } from '../dto/iqc-item.dto';

@Injectable()
export class IqcItemService {
  constructor(
    @InjectRepository(IqcItemMaster)
    private readonly iqcItemRepository: Repository<IqcItemMaster>,
  ) {}

  async findAll(query: IqcItemQueryDto, company?: string, plant?: string) {
    const { page = 1, limit = 10, itemCode, search, useYn } = query;

    const queryBuilder = this.iqcItemRepository.createQueryBuilder('item');

    if (company) {
      queryBuilder.andWhere('item.company = :company', { company });
    }
    if (plant) {
      queryBuilder.andWhere('item.plant = :plant', { plant });
    }

    if (itemCode) {
      queryBuilder.andWhere('item.itemCode = :itemCode', { itemCode });
    }

    if (useYn) {
      queryBuilder.andWhere('item.useYn = :useYn', { useYn });
    }

    if (search) {
      queryBuilder.andWhere(
        '(item.inspectItem LIKE :search OR item.itemCode LIKE :search OR item.spec LIKE :search)',
        { search: `%${search}%` },
      );
    }

    const [data, total] = await queryBuilder
      .orderBy('item.itemCode', 'ASC')
      .addOrderBy('item.seq', 'ASC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return { data, total, page, limit };
  }

  async findById(id: string) {
    const item = await this.iqcItemRepository.findOne({
      where: { id: +id },
    });

    if (!item) {
      throw new NotFoundException('IQC 검사항목을 찾을 수 없습니다.');
    }

    return item;
  }

  async create(dto: CreateIqcItemDto) {
    const entity = this.iqcItemRepository.create(dto);
    const saved = await this.iqcItemRepository.save(entity);
    return saved;
  }

  async update(id: string, dto: UpdateIqcItemDto) {
    const item = await this.findById(id);

    const updated = await this.iqcItemRepository.save({
      ...item,
      ...dto,
      id: +id,
    });

    return updated;
  }

  async delete(id: string) {
    const item = await this.findById(id);

    await this.iqcItemRepository.remove(item);

    return { id, deleted: true };
  }
}
