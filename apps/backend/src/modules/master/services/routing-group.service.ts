/**
 * @file src/modules/master/services/routing-group.service.ts
 * @description 라우팅 그룹 + 공정순서 + 양품조건 비즈니스 로직
 *
 * 초보자 가이드:
 * 1. 라우팅 그룹 CRUD: ROUTING_GROUPS 테이블
 * 2. 공정순서 CRUD: ROUTING_PROCESSES 테이블
 * 3. 양품조건 CRUD + bulk: PROCESS_QUALITY_CONDITIONS 테이블
 */
import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { RoutingGroup } from '../../../entities/routing-group.entity';
import { RoutingProcess } from '../../../entities/routing-process.entity';
import { ProcessQualityCondition } from '../../../entities/process-quality-condition.entity';
import { PartMaster } from '../../../entities/part-master.entity';
import {
  CreateRoutingGroupDto, UpdateRoutingGroupDto, RoutingGroupQueryDto,
  CreateRoutingProcessDto, UpdateRoutingProcessDto,
  BulkSaveConditionDto,
} from '../dto/routing-group.dto';

@Injectable()
export class RoutingGroupService {
  constructor(
    @InjectRepository(RoutingGroup)
    private readonly groupRepo: Repository<RoutingGroup>,
    @InjectRepository(RoutingProcess)
    private readonly processRepo: Repository<RoutingProcess>,
    @InjectRepository(ProcessQualityCondition)
    private readonly conditionRepo: Repository<ProcessQualityCondition>,
    @InjectRepository(PartMaster)
    private readonly partRepo: Repository<PartMaster>,
    private readonly dataSource: DataSource,
  ) {}

  // ─── 라우팅 그룹 CRUD ───

  async findAllGroups(query: RoutingGroupQueryDto, company?: string, plant?: string) {
    const { page = 1, limit = 50, search, useYn } = query;
    const skip = (page - 1) * limit;
    const qb = this.groupRepo.createQueryBuilder('g')
      .leftJoin('ITEM_MASTERS', 'p', 'g.itemCode = p.ITEM_CODE')
      .addSelect('p.ITEM_NAME', 'itemName')
      .addSelect('p.ITEM_TYPE', 'itemType');

    if (company) qb.andWhere('g.company = :company', { company });
    if (plant) qb.andWhere('g.plant = :plant', { plant });
    if (useYn) qb.andWhere('g.useYn = :useYn', { useYn });
    if (search) {
      qb.andWhere(
        '(UPPER(g.routingCode) LIKE UPPER(:s) OR UPPER(g.routingName) LIKE UPPER(:s) OR UPPER(g.itemCode) LIKE UPPER(:s) OR UPPER(p.ITEM_NAME) LIKE UPPER(:s))',
        { s: `%${search}%` },
      );
    }

    const rawAndEntities = await qb
      .orderBy('g.routingCode', 'ASC')
      .skip(skip).take(limit)
      .getRawAndEntities();

    const total = await qb.getCount();

    const data = rawAndEntities.entities.map((entity, i) => ({
      ...entity,
      itemName: rawAndEntities.raw[i]?.itemName || null,
      itemType: rawAndEntities.raw[i]?.itemType || null,
    }));

    return { data, total, page, limit };
  }

  /** 품목코드로 라우팅 그룹 조회 (BOM 페이지용) */
  async findByItemCode(itemCode: string) {
    const group = await this.groupRepo.findOne({ where: { itemCode } });
    if (!group) return null;

    const processes = await this.processRepo.find({
      where: { routingCode: group.routingCode },
      order: { seq: 'ASC' },
    });

    return { ...group, processes };
  }

  async findGroupByCode(routingCode: string) {
    const group = await this.groupRepo.findOne({ where: { routingCode } });
    if (!group) throw new NotFoundException(`라우팅 그룹을 찾을 수 없습니다: ${routingCode}`);
    return group;
  }

  async createGroup(dto: CreateRoutingGroupDto, company?: string, plant?: string) {
    const existing = await this.groupRepo.findOne({ where: { routingCode: dto.routingCode } });
    if (existing) throw new ConflictException(`이미 존재하는 라우팅 그룹: ${dto.routingCode}`);

    const group = this.groupRepo.create({
      ...dto,
      useYn: dto.useYn ?? 'Y',
      company: company || '40',
      plant: plant || '1000',
    });
    return this.groupRepo.save(group);
  }

  async updateGroup(routingCode: string, dto: UpdateRoutingGroupDto) {
    await this.findGroupByCode(routingCode);
    const { routingCode: _rc, ...updateData } = dto;
    await this.groupRepo.update({ routingCode }, updateData);
    return this.findGroupByCode(routingCode);
  }

  async deleteGroup(routingCode: string) {
    await this.findGroupByCode(routingCode);
    await this.dataSource.transaction(async (manager) => {
      await manager.delete(ProcessQualityCondition, { routingCode });
      await manager.delete(RoutingProcess, { routingCode });
      await manager.delete(RoutingGroup, { routingCode });
    });
    return { routingCode };
  }

  // ─── 공정순서 CRUD ───

  async findProcesses(routingCode: string) {
    return this.processRepo.find({
      where: { routingCode },
      order: { seq: 'ASC' },
    });
  }

  async createProcess(dto: CreateRoutingProcessDto, company?: string, plant?: string) {
    const existing = await this.processRepo.findOne({
      where: { routingCode: dto.routingCode, seq: dto.seq },
    });
    if (existing) throw new ConflictException(`이미 존재하는 공정순서: ${dto.routingCode} / seq ${dto.seq}`);

    const proc = this.processRepo.create({
      ...dto,
      useYn: dto.useYn ?? 'Y',
      company: company || '40',
      plant: plant || '1000',
    });
    return this.processRepo.save(proc);
  }

  async updateProcess(routingCode: string, seq: number, dto: UpdateRoutingProcessDto) {
    const existing = await this.processRepo.findOne({ where: { routingCode, seq } });
    if (!existing) throw new NotFoundException(`공정순서를 찾을 수 없습니다: ${routingCode}/${seq}`);

    const { routingCode: _rc, seq: _s, ...updateData } = dto;
    await this.processRepo.update({ routingCode, seq }, updateData);
    return this.processRepo.findOne({ where: { routingCode, seq } });
  }

  async deleteProcess(routingCode: string, seq: number) {
    const existing = await this.processRepo.findOne({ where: { routingCode, seq } });
    if (!existing) throw new NotFoundException(`공정순서를 찾을 수 없습니다: ${routingCode}/${seq}`);

    await this.dataSource.transaction(async (manager) => {
      await manager.delete(ProcessQualityCondition, { routingCode, seq });
      await manager.delete(RoutingProcess, { routingCode, seq });
    });
    return { routingCode, seq };
  }

  // ─── 양품조건 CRUD ───

  async findConditions(routingCode: string, seq: number) {
    return this.conditionRepo.find({
      where: { routingCode, seq },
      order: { conditionSeq: 'ASC' },
    });
  }

  async bulkSaveConditions(
    routingCode: string, seq: number,
    dto: BulkSaveConditionDto,
    company?: string, plant?: string,
  ) {
    return this.dataSource.transaction(async (manager) => {
      await manager.delete(ProcessQualityCondition, { routingCode, seq });
      if (dto.conditions.length === 0) return [];

      const entities = dto.conditions.map((c) =>
        manager.create(ProcessQualityCondition, {
          routingCode, seq,
          conditionSeq: c.conditionSeq,
          conditionCode: c.conditionCode,
          minValue: c.minValue,
          maxValue: c.maxValue,
          unit: c.unit,
          equipInterfaceYn: c.equipInterfaceYn ?? 'N',
          useYn: 'Y',
          company: company || '40',
          plant: plant || '1000',
        }),
      );
      return manager.save(ProcessQualityCondition, entities);
    });
  }
}
