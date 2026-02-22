/**
 * @file src/modules/master/services/equip-bom.service.ts
 * @description 설비 BOM 관리 Service
 *
 * 초보자 가이드:
 * 1. **BOM 품목 마스터** CRUD (부품/소모품)
 * 2. **설비-BOM 연결** 관리 (어떤 설비에 어떤 부품이 사용되는지)
 */

import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, And } from 'typeorm';
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
    const { page = 1, limit = 20, itemType, useYn, search, company: queryCompany } = query;

    const whereConditions: any = {};

    if (itemType) {
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

    let where: any = whereConditions;
    
    // 검색어 처리
    if (search) {
      where = [
        { ...whereConditions, itemCode: Like(`%${search}%`) },
        { ...whereConditions, itemName: Like(`%${search}%`) },
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

  async findItemById(id: string): Promise<EquipBomItem> {
    const item = await this.bomItemRepo.findOne({ where: { id } });
    if (!item) {
      throw new NotFoundException('BOM 품목을 찾을 수 없습니다.');
    }
    return item;
  }

  async createItem(dto: CreateEquipBomItemDto): Promise<EquipBomItem> {
    const item = this.bomItemRepo.create(dto);
    return this.bomItemRepo.save(item);
  }

  async updateItem(id: string, dto: UpdateEquipBomItemDto): Promise<EquipBomItem> {
    const item = await this.findItemById(id);
    Object.assign(item, dto);
    return this.bomItemRepo.save(item);
  }

  async deleteItem(id: string): Promise<void> {
    const item = await this.findItemById(id);
    await this.bomItemRepo.softRemove(item);
  }

  // ========================================
  // 설비-BOM 연결 CRUD
  // ========================================

  async findAllRels(query: EquipBomRelQueryDto) {
    const { page = 1, limit = 20, equipId, bomItemId, itemType, useYn } = query;

    const queryBuilder = this.bomRelRepo
      .createQueryBuilder('rel')
      .leftJoinAndSelect('rel.equipment', 'equip')
      .leftJoinAndSelect('rel.bomItem', 'item')
      .where('rel.deletedAt IS NULL');

    if (equipId) {
      queryBuilder.andWhere('rel.equipId = :equipId', { equipId });
    }

    if (bomItemId) {
      queryBuilder.andWhere('rel.bomItemId = :bomItemId', { bomItemId });
    }

    if (itemType) {
      queryBuilder.andWhere('item.itemType = :itemType', { itemType });
    }

    if (useYn) {
      queryBuilder.andWhere('rel.useYn = :useYn', { useYn });
    }

    const [data, total] = await queryBuilder
      .orderBy('rel.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return { data, total, page, limit };
  }

  async findRelById(id: string): Promise<EquipBomRel> {
    const rel = await this.bomRelRepo.findOne({
      where: { id },
      relations: ['equipment', 'bomItem'],
    });
    if (!rel) {
      throw new NotFoundException('설비-BOM 연결 정보를 찾을 수 없습니다.');
    }
    return rel;
  }

  async findRelsByEquipId(equipId: string): Promise<EquipBomRel[]> {
    return this.bomRelRepo.find({
      where: { equipId, useYn: 'Y' },
      relations: ['bomItem'],
      order: { createdAt: 'DESC' },
    });
  }

  async createRel(dto: CreateEquipBomRelDto): Promise<EquipBomRel> {
    const rel = this.bomRelRepo.create({
      ...dto,
      installDate: dto.installDate ? new Date(dto.installDate) : null,
      expireDate: dto.expireDate ? new Date(dto.expireDate) : null,
    });
    return this.bomRelRepo.save(rel);
  }

  async updateRel(id: string, dto: UpdateEquipBomRelDto): Promise<EquipBomRel> {
    const rel = await this.findRelById(id);
    Object.assign(rel, {
      ...dto,
      installDate: dto.installDate ? new Date(dto.installDate) : rel.installDate,
      expireDate: dto.expireDate ? new Date(dto.expireDate) : rel.expireDate,
    });
    return this.bomRelRepo.save(rel);
  }

  async deleteRel(id: string): Promise<void> {
    const rel = await this.findRelById(id);
    await this.bomRelRepo.softRemove(rel);
  }

  // ========================================
  // 특정 설비의 BOM 목록 조회
  // ========================================

  async getEquipBomList(equipId: string) {
    const rels = await this.bomRelRepo.find({
      where: { equipId, useYn: 'Y' },
      relations: ['bomItem'],
      order: { createdAt: 'DESC' },
    });

    return rels.map((rel) => ({
      id: rel.id,
      equipId: rel.equipId,
      bomItemId: rel.bomItemId,
      quantity: rel.quantity,
      installDate: rel.installDate,
      expireDate: rel.expireDate,
      remark: rel.remark,
      useYn: rel.useYn,
      bomItem: {
        id: rel.bomItem.id,
        itemCode: rel.bomItem.itemCode,
        itemName: rel.bomItem.itemName,
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
