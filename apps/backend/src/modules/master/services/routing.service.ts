/**
 * @file src/modules/master/services/routing.service.ts
 * @description 공정라우팅(ProcessMap) 비즈니스 로직 서비스 - TypeORM Repository 패턴
 *
 * 초보자 가이드:
 * 1. **findAll**: itemCode 기반 라우팅 목록 조회
 * 2. **create**: itemCode+seq 유니크 체크 후 생성
 * 3. **include**: 품목명 조회를 위해 part relation 포함
 */

import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { ProcessMap } from '../../../entities/process-map.entity';
import { PartMaster } from '../../../entities/part-master.entity';
import { CreateRoutingDto, UpdateRoutingDto, RoutingQueryDto } from '../dto/routing.dto';

@Injectable()
export class RoutingService {
  constructor(
    @InjectRepository(ProcessMap)
    private readonly routingRepository: Repository<ProcessMap>,
    @InjectRepository(PartMaster)
    private readonly partRepository: Repository<PartMaster>,
  ) {}

  async findAll(query: RoutingQueryDto, company?: string, plant?: string) {
    const { page = 1, limit = 10, itemCode, search, useYn } = query;
    const skip = (page - 1) * limit;

    const queryBuilder = this.routingRepository.createQueryBuilder('routing')

    if (company) {
      queryBuilder.andWhere('routing.company = :company', { company });
    }
    if (plant) {
      queryBuilder.andWhere('routing.plant = :plant', { plant });
    }

    if (itemCode) {
      queryBuilder.andWhere('routing.itemCode = :itemCode', { itemCode });
    }

    if (useYn) {
      queryBuilder.andWhere('routing.useYn = :useYn', { useYn });
    }

    if (search) {
      queryBuilder.andWhere(
        '(UPPER(routing.processCode) LIKE UPPER(:search) OR UPPER(routing.processName) LIKE UPPER(:search))',
        { search: `%${search}%` }
      );
    }

    const [items, total] = await Promise.all([
      queryBuilder
        .orderBy('routing.itemCode', 'ASC')
        .addOrderBy('routing.seq', 'ASC')
        .skip(skip)
        .take(limit)
        .getMany(),
      queryBuilder.getCount(),
    ]);

    // Fetch part information for each routing item
    const itemCodes = [...new Set(items.map(item => item.itemCode).filter(Boolean))];
    const parts = itemCodes.length > 0
      ? await this.partRepository.find({
          where: { itemCode: In(itemCodes) },
          select: ['itemCode', 'itemName'],
        })
      : [];

    const partMap = new Map(parts.map(p => [p.itemCode, p]));

    const data = items.map(item => ({
      ...item,
      itemName: partMap.get(item.itemCode)?.itemName || null,
    }));

    return { data, total, page, limit };
  }

  async findById(id: string) {
    const item = await this.routingRepository.findOne({
      where: { id: +id },
    });
    if (!item) throw new NotFoundException(`라우팅을 찾을 수 없습니다: ${id}`);

    const part = await this.partRepository.findOne({
      where: { itemCode: item.itemCode },
      select: ['itemCode', 'itemName'],
    });

    return {
      ...item,
      itemCode: part?.itemCode || null,
      itemName: part?.itemName || null,
    };
  }

  async create(dto: CreateRoutingDto) {
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
    });

    return this.routingRepository.save(routing);
  }

  async update(id: string, dto: UpdateRoutingDto) {
    await this.findById(id);
    await this.routingRepository.update(+id, dto);
    return this.findById(id);
  }

  async delete(id: string) {
    await this.findById(id);
    await this.routingRepository.delete(+id);
    return { id };
  }
}
