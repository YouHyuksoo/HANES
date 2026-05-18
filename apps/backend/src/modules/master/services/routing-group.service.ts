/**
 * @file src/modules/master/services/routing-group.service.ts
 * @description ?쇱슦??洹몃９ + 怨듭젙?쒖꽌 + ?묓뭹議곌굔 鍮꾩쫰?덉뒪 濡쒖쭅
 *
 * 珥덈낫??媛?대뱶:
 * 1. ?쇱슦??洹몃９ CRUD: ROUTING_GROUPS ?뚯씠釉?
 * 2. 怨듭젙?쒖꽌 CRUD: ROUTING_PROCESSES ?뚯씠釉?
 * 3. ?묓뭹議곌굔 CRUD + bulk: PROCESS_QUALITY_CONDITIONS ?뚯씠釉?
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

  // ??? ?쇱슦??洹몃９ CRUD ???

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
      const upper = search.toUpperCase();
      qb.andWhere(
        '(g.routingCode LIKE :s OR g.routingName LIKE :sRaw OR g.itemCode LIKE :s OR p.ITEM_NAME LIKE :sRaw)',
        { s: `%${upper}%`, sRaw: `%${search}%` },
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

  /** ?덈ぉ肄붾뱶濡??쇱슦??洹몃９ 議고쉶 (BOM ?섏씠吏?? */
  async findByItemCode(itemCode: string) {
    const group = await this.groupRepo.findOne({ where: { itemCode, useYn: 'Y' } });
    if (!group) return null;

    const processes = await this.processRepo.find({
      where: { routingCode: group.routingCode },
      order: { seq: 'ASC' },
    });

    return { ...group, processes };
  }

  async findGroupByCode(routingCode: string) {
    const group = await this.groupRepo.findOne({ where: { routingCode } });
    if (!group) throw new NotFoundException(`?쇱슦??洹몃９??李얠쓣 ???놁뒿?덈떎: ${routingCode}`);
    return group;
  }

  async createGroup(dto: CreateRoutingGroupDto, company?: string, plant?: string) {
    const existing = await this.groupRepo.findOne({ where: { routingCode: dto.routingCode } });
    if (existing) throw new ConflictException(`?대? 議댁옱?섎뒗 ?쇱슦??洹몃９: ${dto.routingCode}`);

    const group = this.groupRepo.create({
      ...dto,
      useYn: dto.useYn ?? 'Y',
      company,
      plant,
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

  // ??? 怨듭젙?쒖꽌 CRUD ???

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
    if (existing) throw new ConflictException(`?대? 議댁옱?섎뒗 怨듭젙?쒖꽌: ${dto.routingCode} / seq ${dto.seq}`);

    const proc = this.processRepo.create({
      ...dto,
      useYn: dto.useYn ?? 'Y',
      company,
      plant,
    });
    return this.processRepo.save(proc);
  }

  async updateProcess(routingCode: string, seq: number, dto: UpdateRoutingProcessDto) {
    const existing = await this.processRepo.findOne({ where: { routingCode, seq } });
    if (!existing) throw new NotFoundException(`怨듭젙?쒖꽌瑜?李얠쓣 ???놁뒿?덈떎: ${routingCode}/${seq}`);

    const { routingCode: _rc, seq: _s, ...updateData } = dto;
    await this.processRepo.update({ routingCode, seq }, updateData);
    return this.processRepo.findOne({ where: { routingCode, seq } });
  }

  async deleteProcess(routingCode: string, seq: number) {
    const existing = await this.processRepo.findOne({ where: { routingCode, seq } });
    if (!existing) throw new NotFoundException(`怨듭젙?쒖꽌瑜?李얠쓣 ???놁뒿?덈떎: ${routingCode}/${seq}`);

    await this.dataSource.transaction(async (manager) => {
      await manager.delete(ProcessQualityCondition, { routingCode, seq });
      await manager.delete(RoutingProcess, { routingCode, seq });
    });
    return { routingCode, seq };
  }

  // ??? ?묓뭹議곌굔 CRUD ???

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
          company,
          plant,
        }),
      );
      return manager.save(ProcessQualityCondition, entities);
    });
  }
}
