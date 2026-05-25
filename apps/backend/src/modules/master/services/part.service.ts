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

  private tenantWhere(company?: string, plant?: string) {
    return {
      ...(company ? { company } : {}),
      ...(plant ? { plant } : {}),
    };
  }

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
      const upperCustomer = customer.toUpperCase();
      queryBuilder.andWhere('p.customer LIKE :customer', { customer: `%${upperCustomer}%` });
    }

    if (search) {
      const upper = search.toUpperCase();
      queryBuilder.andWhere(
        '(p.itemCode LIKE :search OR p.itemName LIKE :searchRaw OR p.itemNo LIKE :search OR p.custPartNo LIKE :search OR p.spec LIKE :searchRaw)',
        { search: `%${upper}%`, searchRaw: `%${search}%` }
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

  async findById(itemCode: string, company?: string, plant?: string) {
    const part = await this.partRepository.findOne({
      where: { itemCode, ...this.tenantWhere(company, plant) },
    });
    if (!part) throw new NotFoundException(`품목을 찾을 수 없습니다: ${itemCode}`);
    return part;
  }

  async findByCode(itemCode: string, company?: string, plant?: string) {
    const part = await this.partRepository.findOne({
      where: { itemCode, ...this.tenantWhere(company, plant) },
    });
    if (!part) throw new NotFoundException(`품목을 찾을 수 없습니다: ${itemCode}`);
    return part;
  }

  async create(dto: CreatePartDto, company?: string, plant?: string) {
    const existing = await this.partRepository.findOne({
      where: { itemCode: dto.itemCode, ...this.tenantWhere(company, plant) },
    });

    if (existing) throw new ConflictException(`이미 존재하는 품목 코드입니다: ${dto.itemCode}`);

    const part = this.partRepository.create({
      itemCode: dto.itemCode,
      itemName: dto.itemName,
      itemNo: dto.itemNo,
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
      imageUrl: dto.imageUrl,
      company,
      plant,
    });

    return this.partRepository.save(part);
  }

  async update(itemCode: string, dto: UpdatePartDto, company?: string, plant?: string) {
    await this.findById(itemCode, company, plant);
    const updateData: any = { ...dto };
    delete updateData.itemCode;
    delete updateData.company;
    delete updateData.plant;
    await this.partRepository.update({ itemCode, ...this.tenantWhere(company, plant) }, updateData);
    return this.findById(itemCode, company, plant);
  }

  async delete(itemCode: string, company?: string, plant?: string) {
    await this.findById(itemCode, company, plant);
    await this.partRepository.delete({ itemCode, ...this.tenantWhere(company, plant) });
    return { itemCode };
  }

  async updateImage(itemCode: string, imageUrl: string | null, company?: string, plant?: string) {
    await this.findById(itemCode, company, plant);
    await this.partRepository.update({ itemCode, ...this.tenantWhere(company, plant) }, { imageUrl });
    return this.findById(itemCode, company, plant);
  }

  async findByType(itemType: string, company?: string, plant?: string) {
    return this.partRepository.find({
      where: { itemType, useYn: 'Y', ...this.tenantWhere(company, plant) },
      order: { itemCode: 'asc' },
    });
  }
}
