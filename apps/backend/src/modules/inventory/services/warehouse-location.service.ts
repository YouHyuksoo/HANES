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
import { Repository, In, FindOptionsWhere } from 'typeorm';
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

  private tenantWhere(company?: string | null, plant?: string | null) {
    return {
      ...(company && { company }),
      ...(plant && { plant }),
    };
  }

  async findAll(warehouseCode?: string, company?: string, plant?: string) {
    const tenantWhere = this.tenantWhere(company, plant);
    const where: FindOptionsWhere<WarehouseLocation> = { ...tenantWhere };
    if (warehouseCode) where.warehouseCode = warehouseCode;

    const locations = await this.locationRepo.find({
      where,
      order: { locationCode: 'ASC' },
    });

    // 창고명 매핑
    const whIds = [...new Set(locations.map((l) => l.warehouseCode))];
    const warehouses = whIds.length > 0
      ? await this.warehouseRepo.find({ where: { warehouseCode: In(whIds), ...tenantWhere } })
      : [];
    const whMap = new Map(warehouses.map((w) => [w.warehouseCode, w]));

    return {
      success: true,
      data: locations.map((loc) => {
        const wh = whMap.get(loc.warehouseCode);
        return {
          ...loc,
          warehouseCode: loc.warehouseCode,
          warehouseName: wh?.warehouseName ?? '',
        };
      }),
    };
  }

  async create(dto: CreateWarehouseLocationDto, company?: string, plant?: string) {
    const tenantWhere = this.tenantWhere(company, plant);
    const existing = await this.locationRepo.findOne({
      where: { warehouseCode: dto.warehouseCode, locationCode: dto.locationCode, ...tenantWhere },
    });
    if (existing) {
      throw new ConflictException(
        `이미 존재하는 로케이션 코드입니다: ${dto.locationCode}`,
      );
    }

    const location = this.locationRepo.create({
      warehouseCode: dto.warehouseCode,
      locationCode: dto.locationCode,
      locationName: dto.locationName,
      zone: dto.zone ?? null,
      rowNo: dto.rowNo ?? null,
      colNo: dto.colNo ?? null,
      levelNo: dto.levelNo ?? null,
      remark: dto.remark ?? null,
      useYn: 'Y',
      company: company || null,
      plant: plant || null,
    });
    const saved = await this.locationRepo.save(location);
    return { success: true, data: saved };
  }

  async update(id: string, dto: UpdateWarehouseLocationDto, company?: string, plant?: string) {
    // id is composite key encoded as "warehouseCode::locationCode"
    const [warehouseCode, locationCode] = id.split('::');
    const location = await this.locationRepo.findOne({
      where: { warehouseCode, locationCode, ...this.tenantWhere(company, plant) },
    });
    if (!location) {
      throw new NotFoundException(`로케이션을 찾을 수 없습니다: ${id}`);
    }

    const updateData: Partial<WarehouseLocation> = {
      ...(dto.locationName !== undefined ? { locationName: dto.locationName } : {}),
      ...(dto.zone !== undefined ? { zone: dto.zone } : {}),
      ...(dto.rowNo !== undefined ? { rowNo: dto.rowNo } : {}),
      ...(dto.colNo !== undefined ? { colNo: dto.colNo } : {}),
      ...(dto.levelNo !== undefined ? { levelNo: dto.levelNo } : {}),
      ...(dto.useYn !== undefined ? { useYn: dto.useYn } : {}),
      ...(dto.remark !== undefined ? { remark: dto.remark } : {}),
    };
    Object.assign(location, updateData);
    const saved = await this.locationRepo.save(location);
    return { success: true, data: saved };
  }

  async remove(id: string, company?: string, plant?: string) {
    // id is composite key encoded as "warehouseCode::locationCode"
    const [warehouseCode, locationCode] = id.split('::');
    const location = await this.locationRepo.findOne({
      where: { warehouseCode, locationCode, ...this.tenantWhere(company, plant) },
    });
    if (!location) {
      throw new NotFoundException(`로케이션을 찾을 수 없습니다: ${id}`);
    }

    await this.locationRepo.remove(location);
    return { success: true };
  }
}
