/**
 * @file src/modules/master/services/routing.service.ts
 * @description 공정라우팅(ProcessMap) 비즈니스 로직 서비스 - 복합 PK (itemCode + seq)
 *
 * 초보자 가이드:
 * 1. **findAll**: itemCode 기반 라우팅 목록 조회
 * 2. **create**: itemCode+seq 복합 PK 중복 체크 후 생성
 * 3. **update/delete**: itemCode+seq 복합키로 식별
 */

import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProcessMap } from '../../../entities/process-map.entity';
import { ItemMaster } from '../../../entities/item-master.entity';
import { CreateRoutingDto, UpdateRoutingDto, RoutingQueryDto } from '../dto/routing.dto';

@Injectable()
export class RoutingService {
  constructor(
    @InjectRepository(ProcessMap)
    private readonly routingRepository: Repository<ProcessMap>,
    @InjectRepository(ItemMaster)
    private readonly partRepository: Repository<ItemMaster>,
  ) {}

  private tenantWhere(company?: string, plant?: string) {
    return {
      ...(company ? { company } : {}),
      ...(plant ? { plant } : {}),
    };
  }

  private partJoinCondition = (
    'part.itemCode = routing.itemCode'
    + ' AND part.company = routing.company'
    + ' AND part.plant = routing.plant'
  );

  async findAll(query: RoutingQueryDto, company?: string, plant?: string) {
    const { page = 1, limit = 10, itemCode, search, useYn } = query;
    const skip = (page - 1) * limit;

    const queryBuilder = this.routingRepository.createQueryBuilder('routing')
      .leftJoin(ItemMaster, 'part', this.partJoinCondition)
      .addSelect(['part.itemName']);

    if (company) queryBuilder.andWhere('routing.company = :company', { company });
    if (plant) queryBuilder.andWhere('routing.plant = :plant', { plant });
    if (itemCode) queryBuilder.andWhere('routing.itemCode = :itemCode', { itemCode });
    if (useYn) queryBuilder.andWhere('routing.useYn = :useYn', { useYn });
    if (search) {
      const upper = search.toUpperCase();
      queryBuilder.andWhere(
        '(routing.processCode LIKE :searchCode OR routing.processName LIKE :searchRaw)',
        { searchCode: `%${upper}%`, searchRaw: `%${search}%` },
      );
    }

    const [{ entities: items, raw }, total] = await Promise.all([
      queryBuilder
        .orderBy('routing.itemCode', 'ASC')
        .addOrderBy('routing.seq', 'ASC')
        .skip(skip)
        .take(limit)
        .getRawAndEntities(),
      queryBuilder.getCount(),
    ]);

    const data = items.map((item, i) => ({
      ...item,
      itemName: raw[i]?.part_itemName ?? null,
    }));

    return { data, total, page, limit };
  }

  async findByKey(itemCode: string, seq: number, company?: string, plant?: string) {
    const qb = this.routingRepository.createQueryBuilder('routing')
      .leftJoin(ItemMaster, 'part', this.partJoinCondition)
      .addSelect(['part.itemName'])
      .where('routing.itemCode = :itemCode', { itemCode })
      .andWhere('routing.seq = :seq', { seq });

    if (company) qb.andWhere('routing.company = :company', { company });
    if (plant) qb.andWhere('routing.plant = :plant', { plant });

    const { entities, raw } = await qb.getRawAndEntities();
    const item = entities[0];
    if (!item) throw new NotFoundException(`라우팅을 찾을 수 없습니다: ${itemCode}/${seq}`);

    return { ...item, itemName: raw[0]?.part_itemName ?? null };
  }

  async create(dto: CreateRoutingDto, company?: string, plant?: string) {
    const existing = await this.routingRepository.findOne({
      where: { itemCode: dto.itemCode, seq: dto.seq, ...this.tenantWhere(company, plant) },
    });
    if (existing) {
      throw new ConflictException(`이미 존재하는 라우팅입니다: ${dto.itemCode} / seq ${dto.seq}`);
    }

    const routing = this.routingRepository.create({
      itemCode: dto.itemCode,
      seq: dto.seq,
      processCode: dto.processCode,
      processName: dto.processName,
      processType: dto.processType,
      equipType: dto.equipType,
      stdTime: dto.stdTime,
      setupTime: dto.setupTime,
      wireLength: dto.wireLength,
      stripLength: dto.stripLength,
      crimpHeight: dto.crimpHeight,
      crimpWidth: dto.crimpWidth,
      weldCondition: dto.weldCondition,
      processParams: dto.processParams,
      useYn: dto.useYn ?? 'Y',
      company,
      plant,
    });

    return this.routingRepository.save(routing);
  }

  async update(itemCode: string, seq: number, dto: UpdateRoutingDto, company?: string, plant?: string) {
    await this.findByKey(itemCode, seq, company, plant);
    const updateData: Partial<Pick<
      ProcessMap,
      | 'processCode'
      | 'processName'
      | 'processType'
      | 'equipType'
      | 'stdTime'
      | 'setupTime'
      | 'wireLength'
      | 'stripLength'
      | 'crimpHeight'
      | 'crimpWidth'
      | 'weldCondition'
      | 'processParams'
      | 'useYn'
    >> = {
      ...(dto.processCode !== undefined ? { processCode: dto.processCode } : {}),
      ...(dto.processName !== undefined ? { processName: dto.processName } : {}),
      ...(dto.processType !== undefined ? { processType: dto.processType } : {}),
      ...(dto.equipType !== undefined ? { equipType: dto.equipType } : {}),
      ...(dto.stdTime !== undefined ? { stdTime: dto.stdTime } : {}),
      ...(dto.setupTime !== undefined ? { setupTime: dto.setupTime } : {}),
      ...(dto.wireLength !== undefined ? { wireLength: dto.wireLength } : {}),
      ...(dto.stripLength !== undefined ? { stripLength: dto.stripLength } : {}),
      ...(dto.crimpHeight !== undefined ? { crimpHeight: dto.crimpHeight } : {}),
      ...(dto.crimpWidth !== undefined ? { crimpWidth: dto.crimpWidth } : {}),
      ...(dto.weldCondition !== undefined ? { weldCondition: dto.weldCondition } : {}),
      ...(dto.processParams !== undefined ? { processParams: dto.processParams } : {}),
      ...(dto.useYn !== undefined ? { useYn: dto.useYn } : {}),
    };
    await this.routingRepository.update({ itemCode, seq, ...this.tenantWhere(company, plant) }, updateData);
    return this.findByKey(itemCode, seq, company, plant);
  }

  async delete(itemCode: string, seq: number, company?: string, plant?: string) {
    await this.findByKey(itemCode, seq, company, plant);
    await this.routingRepository.delete({ itemCode, seq, ...this.tenantWhere(company, plant) });
    return { itemCode, seq };
  }
}
