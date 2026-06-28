/**
 * @file src/modules/master/services/equip-bom.service.ts
 * @description 설비 BOM 관리 Service
 *
 * 초보자 가이드:
 * 1. **BOM 품목 마스터** CRUD (부품/소모품)
 * 2. **설비-BOM 연결** 관리 (어떤 설비에 어떤 부품이 사용되는지)
 */

import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, FindOptionsWhere } from 'typeorm';
import { EquipBomItem } from '../../../entities/equip-bom-item.entity';
import { EquipBomRel } from '../../../entities/equip-bom-rel.entity';
import {
  CreateEquipBomItemDto,
  UpdateEquipBomItemDto,
  EquipBomItemQueryDto,
  CreateEquipBomRelDto,
  UpdateEquipBomRelDto,
  EquipBomRelQueryDto,
} from '../dto/equip-bom.dto';

@Injectable()
export class EquipBomService {
  constructor(
    @InjectRepository(EquipBomItem)
    private readonly bomItemRepo: Repository<EquipBomItem>,
    @InjectRepository(EquipBomRel)
    private readonly bomRelRepo: Repository<EquipBomRel>,
  ) {}

  // ========================================
  // BOM 품목 마스터 CRUD
  // ========================================

  async findAllItems(query: EquipBomItemQueryDto, company?: string, plant?: string) {
    const { page = 1, limit = 20, equipCode, itemType, useYn, search, company: queryCompany } = query;

    const whereConditions: FindOptionsWhere<EquipBomItem> = {};

    if (equipCode) {
      whereConditions.equipCode = equipCode;
    }
    if (itemType === 'PART' || itemType === 'CONSUMABLE') {
      whereConditions.itemType = itemType;
    }
    if (useYn) {
      whereConditions.useYn = useYn;
    }
    if (company || queryCompany) {
      whereConditions.company = company || queryCompany;
    }
    if (plant) {
      whereConditions.plant = plant;
    }

    let where: FindOptionsWhere<EquipBomItem> | FindOptionsWhere<EquipBomItem>[] = whereConditions;
    
    // 검색어 처리
    if (search) {
      where = [
        { ...whereConditions, bomItemCode: Like(`%${search}%`) },
        { ...whereConditions, bomItemName: Like(`%${search}%`) },
      ];
    }

    const [data, total] = await this.bomItemRepo.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return { data, total, page, limit };
  }

  private tenantWhere(company?: string, plant?: string) {
    return {
      ...(company ? { company } : {}),
      ...(plant ? { plant } : {}),
    };
  }

  async findItem(equipCode: string, bomItemCode: string, company?: string, plant?: string): Promise<EquipBomItem> {
    const item = await this.bomItemRepo.findOne({
      where: { equipCode, bomItemCode, ...this.tenantWhere(company, plant) },
    });
    if (!item) {
      throw new NotFoundException('BOM 품목을 찾을 수 없습니다.');
    }
    return item;
  }

  async createItem(dto: CreateEquipBomItemDto, company?: string, plant?: string): Promise<EquipBomItem> {
    const existing = await this.bomItemRepo.findOne({
      where: { equipCode: dto.equipCode, bomItemCode: dto.bomItemCode, ...this.tenantWhere(company, plant) },
    });
    if (existing) {
      throw new ConflictException(`이미 등록된 설비 BOM 품목입니다: ${dto.equipCode}/${dto.bomItemCode}`);
    }

    const item = this.bomItemRepo.create({
      equipCode: dto.equipCode,
      bomItemCode: dto.bomItemCode,
      bomItemName: dto.bomItemName,
      itemType: dto.itemType,
      spec: dto.spec ?? null,
      maker: dto.maker ?? null,
      unit: dto.unit ?? 'EA',
      unitPrice: dto.unitPrice ?? null,
      replacementCycle: dto.replacementCycle ?? null,
      stockQty: dto.stockQty ?? 0,
      safetyStock: dto.safetyStock ?? 0,
      useYn: dto.useYn ?? 'Y',
      company: company ?? null,
      plant: plant ?? null,
    });
    return this.bomItemRepo.save(item);
  }

  async updateItem(equipCode: string, bomItemCode: string, dto: UpdateEquipBomItemDto, company?: string, plant?: string): Promise<EquipBomItem> {
    const item = await this.findItem(equipCode, bomItemCode, company, plant);
    const updateData: Partial<EquipBomItem> = {
      ...(dto.bomItemName !== undefined ? { bomItemName: dto.bomItemName } : {}),
      ...(dto.itemType !== undefined ? { itemType: dto.itemType } : {}),
      ...(dto.spec !== undefined ? { spec: dto.spec } : {}),
      ...(dto.maker !== undefined ? { maker: dto.maker } : {}),
      ...(dto.unit !== undefined ? { unit: dto.unit } : {}),
      ...(dto.unitPrice !== undefined ? { unitPrice: dto.unitPrice } : {}),
      ...(dto.replacementCycle !== undefined ? { replacementCycle: dto.replacementCycle } : {}),
      ...(dto.stockQty !== undefined ? { stockQty: dto.stockQty } : {}),
      ...(dto.safetyStock !== undefined ? { safetyStock: dto.safetyStock } : {}),
      ...(dto.useYn !== undefined ? { useYn: dto.useYn } : {}),
    };
    Object.assign(item, updateData);
    return this.bomItemRepo.save(item);
  }

  async deleteItem(equipCode: string, bomItemCode: string, company?: string, plant?: string): Promise<void> {
    const item = await this.findItem(equipCode, bomItemCode, company, plant);
    await this.bomItemRepo.remove(item);
  }

  // ========================================
  // 설비-BOM 연결 CRUD
  // ========================================

  async findAllRels(query: EquipBomRelQueryDto, company?: string, plant?: string) {
    const { page = 1, limit = 20, equipCode, bomItemId, itemType, useYn } = query;

    const queryBuilder = this.bomRelRepo
      .createQueryBuilder('rel')
      .leftJoinAndSelect('rel.equipment', 'equip')
      .leftJoinAndSelect('rel.bomItem', 'item');

    if (equipCode) {
      queryBuilder.andWhere('rel.equipCode = :equipCode', { equipCode });
    }

    if (bomItemId) {
      queryBuilder.andWhere('rel.bomItemCode = :bomItemId', { bomItemId });
    }

    if (itemType) {
      queryBuilder.andWhere('item.itemType = :itemType', { itemType });
    }

    if (useYn) {
      queryBuilder.andWhere('rel.useYn = :useYn', { useYn });
    }
    if (company) {
      queryBuilder.andWhere('rel.company = :company', { company });
    }
    if (plant) {
      queryBuilder.andWhere('rel.plant = :plant', { plant });
    }

    const [data, total] = await queryBuilder
      .orderBy('rel.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return { data, total, page, limit };
  }

  async findRelByCompositeKey(equipCode: string, bomItemCode: string, company?: string, plant?: string): Promise<EquipBomRel> {
    const rel = await this.bomRelRepo.findOne({
      where: { equipCode, bomItemCode, ...this.tenantWhere(company, plant) },
      relations: ['equipment', 'bomItem'],
    });
    if (!rel) {
      throw new NotFoundException('설비-BOM 연결 정보를 찾을 수 없습니다.');
    }
    return rel;
  }

  async findRelsByEquipId(equipCode: string, company?: string, plant?: string): Promise<EquipBomRel[]> {
    return this.bomRelRepo.find({
      where: { equipCode, useYn: 'Y', ...this.tenantWhere(company, plant) },
      relations: ['bomItem'],
      order: { createdAt: 'DESC' },
    });
  }

  async createRel(dto: CreateEquipBomRelDto, company?: string, plant?: string): Promise<EquipBomRel> {
    const existing = await this.bomRelRepo.findOne({
      where: { equipCode: dto.equipCode, bomItemCode: dto.bomItemId, ...this.tenantWhere(company, plant) },
    });
    if (existing) {
      throw new ConflictException(`이미 등록된 설비 BOM 연결입니다: ${dto.equipCode}/${dto.bomItemId}`);
    }

    const rel = this.bomRelRepo.create({
      equipCode: dto.equipCode,
      bomItemCode: dto.bomItemId,
      quantity: dto.quantity,
      installDate: dto.installDate ? new Date(dto.installDate) : null,
      expireDate: dto.expireDate ? new Date(dto.expireDate) : null,
      remark: dto.remark,
      useYn: dto.useYn,
      company,
      plant,
    });
    return this.bomRelRepo.save(rel);
  }

  async updateRel(equipCode: string, bomItemCode: string, dto: UpdateEquipBomRelDto, company?: string, plant?: string): Promise<EquipBomRel> {
    const rel = await this.findRelByCompositeKey(equipCode, bomItemCode, company, plant);
    if (dto.quantity !== undefined) rel.quantity = dto.quantity;
    if (dto.installDate !== undefined) rel.installDate = dto.installDate ? new Date(dto.installDate) : null;
    if (dto.expireDate !== undefined) rel.expireDate = dto.expireDate ? new Date(dto.expireDate) : null;
    if (dto.remark !== undefined) rel.remark = dto.remark ?? null;
    if (dto.useYn !== undefined) rel.useYn = dto.useYn;
    return this.bomRelRepo.save(rel);
  }

  async deleteRel(equipCode: string, bomItemCode: string, company?: string, plant?: string): Promise<void> {
    const rel = await this.findRelByCompositeKey(equipCode, bomItemCode, company, plant);
    await this.bomRelRepo.remove(rel);
  }

  // ========================================
  // 특정 설비의 BOM 목록 조회
  // ========================================

  async getEquipBomList(equipCode: string, company?: string, plant?: string) {
    const rels = await this.bomRelRepo.find({
      where: { equipCode, useYn: 'Y', ...this.tenantWhere(company, plant) },
      relations: ['bomItem'],
      order: { createdAt: 'DESC' },
    });

    return rels.map((rel) => ({
      equipCode: rel.equipCode,
      bomItemCode: rel.bomItemCode,
      quantity: rel.quantity,
      installDate: rel.installDate,
      expireDate: rel.expireDate,
      remark: rel.remark,
      useYn: rel.useYn,
      bomItem: {
        bomItemCode: rel.bomItem.bomItemCode,
        bomItemName: rel.bomItem.bomItemName,
        itemType: rel.bomItem.itemType,
        spec: rel.bomItem.spec,
        maker: rel.bomItem.maker,
        unit: rel.bomItem.unit,
        unitPrice: rel.bomItem.unitPrice,
        replacementCycle: rel.bomItem.replacementCycle,
        stockQty: rel.bomItem.stockQty,
        safetyStock: rel.bomItem.safetyStock,
      },
    }));
  }
}
