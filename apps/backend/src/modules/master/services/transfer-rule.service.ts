/**
 * @file src/modules/master/services/transfer-rule.service.ts
 * @description 창고이동규칙 비즈니스 로직 서비스 - TypeORM
 *
 * 초보자 가이드:
 * 1. fromWarehouseId + toWarehouseId 복합 PK로 조회/수정/삭제
 */

import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WarehouseTransferRule } from '../../../entities/warehouse-transfer-rule.entity';
import { CreateTransferRuleDto, UpdateTransferRuleDto, TransferRuleQueryDto } from '../dto/transfer-rule.dto';

@Injectable()
export class TransferRuleService {
  constructor(
    @InjectRepository(WarehouseTransferRule)
    private readonly transferRuleRepository: Repository<WarehouseTransferRule>,
  ) {}

  async findAll(query: TransferRuleQueryDto, company?: string, plant?: string) {
    const { page = 1, limit = 10, search, fromWarehouseId, toWarehouseId, allowYn } = query;
    const skip = (page - 1) * limit;

    const queryBuilder = this.transferRuleRepository.createQueryBuilder('rule')
      .leftJoin('WAREHOUSES', 'fw', 'fw.WAREHOUSE_CODE = rule.FROM_WAREHOUSE_ID AND fw.COMPANY = rule.COMPANY AND fw.PLANT_CD = rule.PLANT_CD')
      .leftJoin('WAREHOUSES', 'tw', 'tw.WAREHOUSE_CODE = rule.TO_WAREHOUSE_ID AND tw.COMPANY = rule.COMPANY AND tw.PLANT_CD = rule.PLANT_CD')
      .addSelect('fw.WAREHOUSE_CODE', 'fromWarehouseCode')
      .addSelect('fw.WAREHOUSE_NAME', 'fromWarehouseName')
      .addSelect('tw.WAREHOUSE_CODE', 'toWarehouseCode')
      .addSelect('tw.WAREHOUSE_NAME', 'toWarehouseName');

    if (company) {
      queryBuilder.andWhere('rule.company = :company', { company });
    }
    if (plant) {
      queryBuilder.andWhere('rule.plant = :plant', { plant });
    }

    if (fromWarehouseId) {
      queryBuilder.andWhere('rule.fromWarehouseId = :fromWarehouseId', { fromWarehouseId });
    }

    if (toWarehouseId) {
      queryBuilder.andWhere('rule.toWarehouseId = :toWarehouseId', { toWarehouseId });
    }

    if (allowYn) {
      queryBuilder.andWhere('rule.allowYn = :allowYn', { allowYn });
    }

    if (search) {
      const upper = search.toUpperCase();
      queryBuilder.andWhere(
        '(rule.fromWarehouseId LIKE :searchCode OR rule.toWarehouseId LIKE :searchCode OR rule.remark LIKE :searchRaw OR fw.WAREHOUSE_NAME LIKE :searchRaw OR tw.WAREHOUSE_NAME LIKE :searchRaw)',
        { searchCode: `%${upper}%`, searchRaw: `%${search}%` }
      );
    }

    const total = await queryBuilder.getCount();

    const rawData = await queryBuilder
      .orderBy('rule.fromWarehouseId', 'ASC')
      .addOrderBy('rule.toWarehouseId', 'ASC')
      .skip(skip)
      .take(limit)
      .getRawAndEntities();

    const data = rawData.entities.map((entity, idx) => ({
      ...entity,
      fromWarehouseCode: rawData.raw[idx]?.fromWarehouseCode ?? entity.fromWarehouseId,
      fromWarehouseName: rawData.raw[idx]?.fromWarehouseName ?? '',
      toWarehouseCode: rawData.raw[idx]?.toWarehouseCode ?? entity.toWarehouseId,
      toWarehouseName: rawData.raw[idx]?.toWarehouseName ?? '',
    }));

    return { data, total, page, limit };
  }

  async findByCompositeKey(fromWarehouseId: string, toWarehouseId: string, company?: string, plant?: string) {
    const rule = await this.transferRuleRepository.findOne({
      where: {
        fromWarehouseId,
        toWarehouseId,
        ...(company && { company }),
        ...(plant && { plant }),
      },
    });
    if (!rule) throw new NotFoundException(`창고이동규칙을 찾을 수 없습니다: ${fromWarehouseId} → ${toWarehouseId}`);
    return rule;
  }

  async create(dto: CreateTransferRuleDto, company?: string, plant?: string) {
    const existing = await this.transferRuleRepository.findOne({
      where: {
        fromWarehouseId: dto.fromWarehouseId,
        toWarehouseId: dto.toWarehouseId,
        ...(company && { company }),
        ...(plant && { plant }),
      },
    });
    if (existing) throw new ConflictException(`이미 존재하는 창고이동규칙입니다: ${dto.fromWarehouseId} -> ${dto.toWarehouseId}`);

    const rule = this.transferRuleRepository.create({
      fromWarehouseId: dto.fromWarehouseId,
      toWarehouseId: dto.toWarehouseId,
      allowYn: dto.allowYn ?? 'Y',
      remark: dto.remark,
      company: company || null,
      plant: plant || null,
    });

    return this.transferRuleRepository.save(rule);
  }

  async update(fromWarehouseId: string, toWarehouseId: string, dto: UpdateTransferRuleDto, company?: string, plant?: string) {
    await this.findByCompositeKey(fromWarehouseId, toWarehouseId, company, plant);
    const updateData: Partial<Pick<WarehouseTransferRule, 'allowYn' | 'remark'>> = {
      ...(dto.allowYn !== undefined ? { allowYn: dto.allowYn } : {}),
      ...(dto.remark !== undefined ? { remark: dto.remark } : {}),
    };
    await this.transferRuleRepository.update({
      fromWarehouseId,
      toWarehouseId,
      ...(company && { company }),
      ...(plant && { plant }),
    }, updateData);
    return this.findByCompositeKey(fromWarehouseId, toWarehouseId, company, plant);
  }

  async delete(fromWarehouseId: string, toWarehouseId: string, company?: string, plant?: string) {
    await this.findByCompositeKey(fromWarehouseId, toWarehouseId, company, plant);
    await this.transferRuleRepository.delete({
      fromWarehouseId,
      toWarehouseId,
      ...(company && { company }),
      ...(plant && { plant }),
    });
    return { fromWarehouseId, toWarehouseId };
  }
}
