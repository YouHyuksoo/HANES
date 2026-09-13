/**
 * @file inspect-item-spec.service.ts
 * @description 품목별 리크/내전압/토크 스펙 CRUD + resolve
 */
import { ConflictException, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InspectItemSpec } from '../../../entities/inspect-item-spec.entity';
import {
  CreateInspectItemSpecDto,
  InspectItemSpecQueryDto,
  UpdateInspectItemSpecDto,
} from '../dto/inspect-item-spec.dto';

@Injectable()
export class InspectItemSpecService {
  constructor(
    @InjectRepository(InspectItemSpec)
    private readonly repo: Repository<InspectItemSpec>,
  ) {}

  async findAll(query: InspectItemSpecQueryDto, company: string, plant: string) {
    const { page = 1, limit = 50, search, itemCode, inspectType, useYn } = query;
    const qb = this.repo.createQueryBuilder('s')
      .where('s.company = :company', { company })
      .andWhere('s.plant = :plant', { plant });
    if (itemCode) qb.andWhere('s.itemCode = :itemCode', { itemCode });
    if (inspectType) qb.andWhere('s.inspectType = :inspectType', { inspectType });
    if (useYn) qb.andWhere('s.useYn = :useYn', { useYn });
    if (search?.trim()) {
      qb.andWhere('(UPPER(s.itemCode) LIKE :search OR UPPER(s.connectorKey) LIKE :search)', {
        search: `%${search.trim().toUpperCase()}%`,
      });
    }
    const [data, total] = await qb
      .orderBy('s.itemCode', 'ASC')
      .addOrderBy('s.inspectType', 'ASC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();
    return { data, total, page, limit };
  }

  async findById(specId: number, company: string, plant: string) {
    const spec = await this.repo.findOne({ where: { specId, company, plant } });
    if (!spec) throw new NotFoundException(`검사 스펙을 찾을 수 없습니다: ${specId}`);
    return spec;
  }

  async resolve(itemCode: string, inspectType: string, company: string, plant: string, connectorKey?: string) {
    const key = (connectorKey ?? '*').trim() || '*';
    const typed = await this.repo.findOne({
      where: { company, plant, itemCode: itemCode.trim(), inspectType, connectorKey: key, useYn: 'Y' },
    });
    if (typed) return typed;
    if (key !== '*') {
      return this.repo.findOne({
        where: { company, plant, itemCode: itemCode.trim(), inspectType, connectorKey: '*', useYn: 'Y' },
      });
    }
    return null;
  }

  async create(dto: CreateInspectItemSpecDto, company: string, plant: string, userId: string) {
    const itemCode = dto.itemCode.trim();
    const inspectType = dto.inspectType.trim().toUpperCase();
    const connectorKey = (dto.connectorKey ?? '*').trim() || '*';
    const duplicate = await this.repo.findOne({ where: { company, plant, itemCode, inspectType, connectorKey } });
    if (duplicate) {
      throw new ConflictException(`이미 등록된 스펙입니다: ${itemCode} / ${inspectType} / ${connectorKey}`);
    }
    const specId = await this.nextSpecId();
    return this.repo.save(this.repo.create({
      specId, company, plant, itemCode, inspectType, connectorKey,
      chargeBar: dto.chargeBar ?? null,
      chargeTolBar: dto.chargeTolBar ?? null,
      measureBar: dto.measureBar ?? null,
      measureTolBar: dto.measureTolBar ?? null,
      holdSeconds: dto.holdSeconds ?? null,
      minHoldBar: dto.minHoldBar ?? null,
      testVoltageKv: dto.testVoltageKv ?? null,
      testSeconds: dto.testSeconds ?? null,
      maxCurrentMa: dto.maxCurrentMa ?? null,
      torqueLsl: dto.torqueLsl ?? null,
      torqueUsl: dto.torqueUsl ?? null,
      torqueUnit: dto.torqueUnit ?? null,
      remark: dto.remark ?? null,
      useYn: dto.useYn ?? 'Y',
      createdBy: userId,
      updatedBy: userId,
    }));
  }

  async update(specId: number, dto: UpdateInspectItemSpecDto, company: string, plant: string, userId: string) {
    const spec = await this.findById(specId, company, plant);
    const nextItem = dto.itemCode?.trim() ?? spec.itemCode;
    const nextType = dto.inspectType?.trim().toUpperCase() ?? spec.inspectType;
    const nextKey = dto.connectorKey !== undefined ? ((dto.connectorKey ?? '*').trim() || '*') : spec.connectorKey;
    if (nextItem !== spec.itemCode || nextType !== spec.inspectType || nextKey !== spec.connectorKey) {
      const duplicate = await this.repo.findOne({
        where: { company, plant, itemCode: nextItem, inspectType: nextType, connectorKey: nextKey },
      });
      if (duplicate && duplicate.specId !== specId) {
        throw new ConflictException(`이미 등록된 스펙입니다: ${nextItem} / ${nextType} / ${nextKey}`);
      }
    }
    Object.assign(spec, {
      itemCode: nextItem,
      inspectType: nextType,
      connectorKey: nextKey,
      ...(dto.chargeBar !== undefined ? { chargeBar: dto.chargeBar } : {}),
      ...(dto.chargeTolBar !== undefined ? { chargeTolBar: dto.chargeTolBar } : {}),
      ...(dto.measureBar !== undefined ? { measureBar: dto.measureBar } : {}),
      ...(dto.measureTolBar !== undefined ? { measureTolBar: dto.measureTolBar } : {}),
      ...(dto.holdSeconds !== undefined ? { holdSeconds: dto.holdSeconds } : {}),
      ...(dto.minHoldBar !== undefined ? { minHoldBar: dto.minHoldBar } : {}),
      ...(dto.testVoltageKv !== undefined ? { testVoltageKv: dto.testVoltageKv } : {}),
      ...(dto.testSeconds !== undefined ? { testSeconds: dto.testSeconds } : {}),
      ...(dto.maxCurrentMa !== undefined ? { maxCurrentMa: dto.maxCurrentMa } : {}),
      ...(dto.torqueLsl !== undefined ? { torqueLsl: dto.torqueLsl } : {}),
      ...(dto.torqueUsl !== undefined ? { torqueUsl: dto.torqueUsl } : {}),
      ...(dto.torqueUnit !== undefined ? { torqueUnit: dto.torqueUnit } : {}),
      ...(dto.remark !== undefined ? { remark: dto.remark } : {}),
      ...(dto.useYn !== undefined ? { useYn: dto.useYn } : {}),
      updatedBy: userId,
    });
    return this.repo.save(spec);
  }

  async delete(specId: number, company: string, plant: string) {
    const spec = await this.findById(specId, company, plant);
    await this.repo.remove(spec);
    return { specId, deleted: true };
  }

  private async nextSpecId(): Promise<number> {
    const rows: Array<{ nextSeq: unknown }> = await this.repo.manager.query(
      `SELECT SEQ_INSPECT_ITEM_SPEC.NEXTVAL AS "nextSeq" FROM DUAL`,
    );
    const next = Number(rows[0]?.nextSeq);
    if (!Number.isFinite(next) || next <= 0) {
      throw new InternalServerErrorException('SEQ_INSPECT_ITEM_SPEC 채번에 실패했습니다.');
    }
    return next;
  }
}
