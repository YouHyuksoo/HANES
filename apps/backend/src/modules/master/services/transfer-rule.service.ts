/**
 * @file src/modules/master/services/transfer-rule.service.ts
 * @description 창고이동규칙 비즈니스 로직 서비스 - TypeORM
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
      queryBuilder.andWhere(
        '(UPPER(rule.fromWarehouseId) LIKE UPPER(:search) OR UPPER(rule.toWarehouseId) LIKE UPPER(:search) OR UPPER(rule.remark) LIKE UPPER(:search))',
        { search: `%${search}%` }
      );
    }

    const [data, total] = await Promise.all([
      queryBuilder
        .orderBy('rule.fromWarehouseId', 'ASC')
        .addOrderBy('rule.toWarehouseId', 'ASC')
        .skip(skip)
        .take(limit)
        .getMany(),
      queryBuilder.getCount(),
    ]);

    return { data, total, page, limit };
  }

  async findById(id: string) {
    const rule = await this.transferRuleRepository.findOne({
      where: { id },
    });
    if (!rule) throw new NotFoundException(`창고이동규칙을 찾을 수 없습니다: ${id}`);
    return rule;
  }

  async create(dto: CreateTransferRuleDto) {
    const existing = await this.transferRuleRepository.findOne({
      where: {
        fromWarehouseId: dto.fromWarehouseId,
        toWarehouseId: dto.toWarehouseId,
      },
    });
    if (existing) throw new ConflictException(`이미 존재하는 창고이동규칙입니다: ${dto.fromWarehouseId} -> ${dto.toWarehouseId}`);

    const rule = this.transferRuleRepository.create({
      fromWarehouseId: dto.fromWarehouseId,
      toWarehouseId: dto.toWarehouseId,
      allowYn: dto.allowYn ?? 'Y',
      remark: dto.remark,
    });

    return this.transferRuleRepository.save(rule);
  }

  async update(id: string, dto: UpdateTransferRuleDto) {
    await this.findById(id);
    await this.transferRuleRepository.update(id, dto);
    return this.findById(id);
  }

  async delete(id: string) {
    await this.findById(id);
    await this.transferRuleRepository.delete(id);
    return { id };
  }
}
