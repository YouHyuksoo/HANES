/**
 * @file src/modules/master/services/iqc-item.service.ts
 * @description IQC 검사항목마스터 비즈니스 로직 서비스
 *
 * 초보자 가이드:
 * 1. itemCode + seq 복합 PK로 조회/수정/삭제
 * 2. findAll: 목록 조회 (itemCode, search 필터)
 */

import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
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

  private tenantWhere(company?: string, plant?: string) {
    return {
      ...(company ? { company } : {}),
      ...(plant ? { plant } : {}),
    };
  }

  private assertSameTenant(
    context: string,
    requested: { company?: string | null; plant?: string | null },
    actual: { company?: string | null; plant?: string | null },
  ) {
    if (requested.company && actual.company !== requested.company) {
      throw new BadRequestException(
        `${context} 회사 정보가 일치하지 않습니다. request=${requested.company}, row=${actual.company ?? 'NULL'}`,
      );
    }
    if (requested.plant && actual.plant !== requested.plant) {
      throw new BadRequestException(
        `${context} 사업장 정보가 일치하지 않습니다. request=${requested.plant}, row=${actual.plant ?? 'NULL'}`,
      );
    }
  }

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

  async findByCompositeKey(itemCode: string, seq: number, company?: string, plant?: string) {
    const item = await this.iqcItemRepository.findOne({
      where: { itemCode, seq, ...this.tenantWhere(company, plant) },
    });

    if (!item) {
      throw new NotFoundException('IQC 검사항목을 찾을 수 없습니다.');
    }
    this.assertSameTenant('IQC 검사항목', { company, plant }, item);

    return item;
  }

  async create(dto: CreateIqcItemDto, company?: string, plant?: string) {
    const existing = await this.iqcItemRepository.findOne({
      where: { itemCode: dto.itemCode, seq: dto.seq, ...this.tenantWhere(company, plant) },
    });
    if (existing) {
      throw new ConflictException(`이미 등록된 IQC 검사항목입니다: ${dto.itemCode}/${dto.seq}`);
    }

    const entity = this.iqcItemRepository.create({
      itemCode: dto.itemCode,
      seq: dto.seq,
      inspectItem: dto.inspectItem,
      spec: dto.spec ?? null,
      lsl: dto.lsl ?? null,
      usl: dto.usl ?? null,
      unit: dto.unit ?? null,
      isShelfLife: dto.isShelfLife ?? false,
      retestCycle: dto.retestCycle ?? null,
      useYn: dto.useYn ?? 'Y',
      company: company || null,
      plant: plant || null,
    });
    const saved = await this.iqcItemRepository.save(entity);
    return saved;
  }

  async update(itemCode: string, seq: number, dto: UpdateIqcItemDto, company?: string, plant?: string) {
    const item = await this.findByCompositeKey(itemCode, seq, company, plant);

    Object.assign(item, {
      ...(dto.inspectItem !== undefined ? { inspectItem: dto.inspectItem } : {}),
      ...(dto.spec !== undefined ? { spec: dto.spec } : {}),
      ...(dto.lsl !== undefined ? { lsl: dto.lsl } : {}),
      ...(dto.usl !== undefined ? { usl: dto.usl } : {}),
      ...(dto.unit !== undefined ? { unit: dto.unit } : {}),
      ...(dto.isShelfLife !== undefined ? { isShelfLife: dto.isShelfLife } : {}),
      ...(dto.retestCycle !== undefined ? { retestCycle: dto.retestCycle } : {}),
      ...(dto.useYn !== undefined ? { useYn: dto.useYn } : {}),
    });

    const updated = await this.iqcItemRepository.save({
      ...item,
      company: item.company,
      plant: item.plant,
      itemCode,
      seq,
    });

    return updated;
  }

  async delete(itemCode: string, seq: number, company?: string, plant?: string) {
    const item = await this.findByCompositeKey(itemCode, seq, company, plant);

    await this.iqcItemRepository.remove(item);

    return { itemCode, seq, deleted: true };
  }
}
