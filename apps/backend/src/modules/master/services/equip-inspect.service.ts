/**
 * @file src/modules/master/services/equip-inspect.service.ts
 * @description 설비점검항목마스터 비즈니스 로직 서비스
 *              복합키: company + plant + equipCode + inspectType + seq
 *
 * 초보자 가이드:
 * 1. findAll: 목록 조회 (equipCode, inspectType 필터)
 * 2. create: 항목 생성 (company, plant는 컨트롤러에서 전달)
 * 3. update/delete: 복합키로 식별
 */

import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EquipInspectItemMaster } from '../../../entities/equip-inspect-item-master.entity';
import { CreateEquipInspectItemDto, UpdateEquipInspectItemDto, EquipInspectItemQueryDto } from '../dto/equip-inspect.dto';
import { EquipInspectItemPoolService } from './equip-inspect-item-pool.service';

@Injectable()
export class EquipInspectService {
  constructor(
    @InjectRepository(EquipInspectItemMaster)
    private readonly equipInspectRepository: Repository<EquipInspectItemMaster>,
    private readonly poolService: EquipInspectItemPoolService,
  ) {}

  async findAll(query: EquipInspectItemQueryDto, company?: string, plant?: string) {
    const { page = 1, limit = 10, equipCode, inspectType, search, useYn } = query;

    const qb = this.equipInspectRepository.createQueryBuilder('item');

    if (company) qb.andWhere('item.company = :company', { company });
    if (plant) qb.andWhere('item.plant = :plant', { plant });
    if (equipCode) qb.andWhere('item.equipCode = :equipCode', { equipCode });
    if (inspectType) qb.andWhere('item.inspectType = :inspectType', { inspectType });
    if (useYn) qb.andWhere('item.useYn = :useYn', { useYn });
    if (search) {
      qb.andWhere(
        '(item.itemName LIKE :search OR item.equipCode LIKE :search)',
        { search: `%${search}%` },
      );
    }

    const [data, total] = await qb
      .orderBy('item.equipCode', 'ASC')
      .addOrderBy('item.inspectType', 'ASC')
      .addOrderBy('item.seq', 'ASC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return { data, total, page, limit };
  }

  async findByKey(company: string, plant: string, equipCode: string, inspectType: string, seq: number) {
    const item = await this.equipInspectRepository.findOne({
      where: { company, plant, equipCode, inspectType, seq },
    });
    if (!item) {
      throw new NotFoundException(`점검항목을 찾을 수 없습니다: ${equipCode}/${inspectType}/${seq}`);
    }
    return item;
  }

  async create(dto: CreateEquipInspectItemDto, company: string, plant: string) {
    const source = dto.itemCode
      ? await this.poolService.findByCode(company, plant, dto.itemCode)
      : null;

    const entity = this.equipInspectRepository.create({
      company,
      plant,
      equipCode: dto.equipCode,
      itemCode: source?.itemCode || dto.itemCode || null,
      inspectType: dto.inspectType || source?.inspectType,
      seq: dto.seq,
      itemName: source?.itemName || dto.itemName,
      criteria: source?.criteria ?? dto.criteria ?? null,
      cycle: source?.cycle ?? dto.cycle ?? null,
      useYn: dto.useYn || 'Y',
    });
    return this.equipInspectRepository.save(entity);
  }

  async update(
    company: string, plant: string, equipCode: string, inspectType: string, seq: number,
    dto: UpdateEquipInspectItemDto,
  ) {
    const item = await this.findByKey(company, plant, equipCode, inspectType, seq);
    const updateData: Partial<EquipInspectItemMaster> = {
      ...(dto.itemCode !== undefined ? { itemCode: dto.itemCode } : {}),
      ...(dto.itemName !== undefined ? { itemName: dto.itemName } : {}),
      ...(dto.criteria !== undefined ? { criteria: dto.criteria } : {}),
      ...(dto.cycle !== undefined ? { cycle: dto.cycle } : {}),
      ...(dto.useYn !== undefined ? { useYn: dto.useYn } : {}),
      ...(dto.itemType !== undefined ? { itemType: dto.itemType } : {}),
      ...(dto.unit !== undefined ? { unit: dto.unit } : {}),
      ...(dto.lslValue !== undefined ? { lslValue: dto.lslValue } : {}),
      ...(dto.uslValue !== undefined ? { uslValue: dto.uslValue } : {}),
      ...(dto.workerQrCode !== undefined ? { workerQrCode: dto.workerQrCode } : {}),
    };
    Object.assign(item, updateData);
    return this.equipInspectRepository.save(item);
  }

  async delete(company: string, plant: string, equipCode: string, inspectType: string, seq: number) {
    const item = await this.findByKey(company, plant, equipCode, inspectType, seq);
    await this.equipInspectRepository.remove(item);
    return { equipCode, inspectType, seq, deleted: true };
  }
}
