/**
 * @file services/warehouse-location.service.ts
 * @description 창고 로케이션 CRUD 서비스
 *
 * 초보자 가이드:
 * 1. findAll: 창고ID별 로케이션 목록 조회
 * 2. create: 로케이션 생성 (코드 중복 검증)
 * 3. update/remove: 수정/삭제
 */
import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { WarehouseLocation } from '../../../entities/warehouse-location.entity';
import { Warehouse } from '../../../entities/warehouse.entity';
import {
  CreateWarehouseLocationDto,
  UpdateWarehouseLocationDto,
} from '../dto/warehouse-location.dto';

@Injectable()
export class WarehouseLocationService {
  constructor(
    @InjectRepository(WarehouseLocation)
    private readonly locationRepo: Repository<WarehouseLocation>,
    @InjectRepository(Warehouse)
    private readonly warehouseRepo: Repository<Warehouse>,
  ) {}

  async findAll(warehouseCode?: string, company?: string, plant?: string) {
    const where: any = {
      ...(company && { company }),
      ...(plant && { plant }),
    };
    if (warehouseCode) where.warehouseCode = warehouseCode;

    const locations = await this.locationRepo.find({
      where,
      order: { locationCode: 'ASC' },
    });

    // 창고명 매핑
    const whIds = [...new Set(locations.map((l) => l.warehouseCode))];
    const warehouses = whIds.length > 0
      ? await this.warehouseRepo.find({ where: { warehouseCode: In(whIds) } })
      : [];
    const whMap = new Map(warehouses.map((w) => [w.warehouseCode, w]));

    return {
      success: true,
      data: locations.map((loc) => {
        const wh = whMap.get(loc.warehouseCode);
        return {
          ...loc,
          warehouseCode: wh?.warehouseCode ?? '',
          warehouseName: wh?.warehouseName ?? '',
        };
      }),
    };
  }

  async create(dto: CreateWarehouseLocationDto) {
    const existing = await this.locationRepo.findOne({
      where: { warehouseCode: dto.warehouseCode, locationCode: dto.locationCode },
    });
    if (existing) {
      throw new ConflictException(
        `이미 존재하는 로케이션 코드입니다: ${dto.locationCode}`,
      );
    }

    const location = this.locationRepo.create(dto);
    const saved = await this.locationRepo.save(location);
    return { success: true, data: saved };
  }

  async update(id: string, dto: UpdateWarehouseLocationDto) {
    // id is composite key encoded as "warehouseCode::locationCode"
    const [warehouseCode, locationCode] = id.split('::');
    const location = await this.locationRepo.findOne({ where: { warehouseCode, locationCode } });
    if (!location) {
      throw new NotFoundException(`로케이션을 찾을 수 없습니다: ${id}`);
    }

    Object.assign(location, dto);
    const saved = await this.locationRepo.save(location);
    return { success: true, data: saved };
  }

  async remove(id: string) {
    // id is composite key encoded as "warehouseCode::locationCode"
    const [warehouseCode, locationCode] = id.split('::');
    const location = await this.locationRepo.findOne({ where: { warehouseCode, locationCode } });
    if (!location) {
      throw new NotFoundException(`로케이션을 찾을 수 없습니다: ${id}`);
    }

    await this.locationRepo.remove(location);
    return { success: true };
  }
}
