/**
 * @file src/modules/master/services/part.service.ts
 * @description 품목마스터 비즈니스 로직 서비스 - TypeORM Repository 패턴
 */

import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PartMaster } from '../../../entities/part-master.entity';
import { CreatePartDto, UpdatePartDto, PartQueryDto } from '../dto/part.dto';

@Injectable()
export class PartService {
  constructor(
    @InjectRepository(PartMaster)
    private readonly partRepository: Repository<PartMaster>,
  ) {}

  async findAll(query: PartQueryDto, company?: string, plant?: string) {
    const { page = 1, limit = 20, itemType, search, customer, useYn } = query;
    const skip = (page - 1) * limit;

    const queryBuilder = this.partRepository.createQueryBuilder('p')

    if (company) {
      queryBuilder.andWhere('p.company = :company', { company });
    }
    if (plant) {
      queryBuilder.andWhere('p.plant = :plant', { plant });
    }

    if (itemType) {
      queryBuilder.andWhere('p.itemType = :itemType', { itemType });
    }

    if (useYn) {
      queryBuilder.andWhere('p.useYn = :useYn', { useYn });
    }

    if (customer) {
      queryBuilder.andWhere('UPPER(p.customer) LIKE UPPER(:customer)', { customer: `%${customer}%` });
    }

    if (search) {
      queryBuilder.andWhere(
        '(UPPER(p.itemCode) LIKE UPPER(:search) OR UPPER(p.itemName) LIKE UPPER(:search) OR UPPER(p.partNo) LIKE UPPER(:search) OR UPPER(p.custPartNo) LIKE UPPER(:search) OR UPPER(p.spec) LIKE UPPER(:search))',
        { search: `%${search}%` }
      );
    }

    const [data, total] = await Promise.all([
      queryBuilder
        .orderBy('p.itemCode', 'ASC')
        .skip(skip)
        .take(limit)
        .getMany(),
      queryBuilder.getCount(),
    ]);

    return { data, total, page, limit };
  }

  async findById(itemCode: string) {
    const part = await this.partRepository.findOne({
      where: { itemCode },
    });
    if (!part) throw new NotFoundException(`품목을 찾을 수 없습니다: ${itemCode}`);
    return part;
  }

  async findByCode(itemCode: string) {
    const part = await this.partRepository.findOne({
      where: { itemCode },
    });
    if (!part) throw new NotFoundException(`품목을 찾을 수 없습니다: ${itemCode}`);
    return part;
  }

  async create(dto: CreatePartDto) {
    const existing = await this.partRepository.findOne({
      where: { itemCode: dto.itemCode },
    });

    if (existing) throw new ConflictException(`이미 존재하는 품목 코드입니다: ${dto.itemCode}`);

    const part = this.partRepository.create({
      itemCode: dto.itemCode,
      itemName: dto.itemName,
      partNo: dto.partNo,
      custPartNo: dto.custPartNo,
      itemType: dto.itemType,
      productType: dto.productType,
      spec: dto.spec,
      rev: dto.rev,
      unit: dto.unit ?? 'EA',
      drawNo: dto.drawNo,
      customer: dto.customer,
      vendor: dto.vendor,
      leadTime: dto.leadTime ?? 0,
      safetyStock: dto.safetyStock ?? 0,
      lotUnitQty: dto.lotUnitQty,
      boxQty: dto.boxQty ?? 0,
      iqcYn: dto.iqcYn ?? 'Y',
      tactTime: dto.tactTime ?? 0,
      expiryDate: dto.expiryDate ?? 0,
      remark: dto.remark,
      useYn: dto.useYn ?? 'Y',
    });

    return this.partRepository.save(part);
  }

  async update(itemCode: string, dto: UpdatePartDto) {
    await this.findById(itemCode);
    await this.partRepository.update(itemCode, dto);
    return this.findById(itemCode);
  }

  async delete(itemCode: string) {
    await this.findById(itemCode);
    await this.partRepository.delete(itemCode);
    return { itemCode };
  }

  async findByType(itemType: string) {
    return this.partRepository.find({
      where: { itemType, useYn: 'Y' },
      order: { itemCode: 'asc' },
    });
  }
}
