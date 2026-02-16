/**
 * @file src/modules/master/services/part.service.ts
 * @description 품목마스터 비즈니스 로직 서비스 - TypeORM Repository 패턴
 */

import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { PartMaster } from '../../../entities/part-master.entity';
import { CreatePartDto, UpdatePartDto, PartQueryDto } from '../dto/part.dto';

@Injectable()
export class PartService {
  constructor(
    @InjectRepository(PartMaster)
    private readonly partRepository: Repository<PartMaster>,
  ) {}

  async findAll(query: PartQueryDto, company?: string) {
    const { page = 1, limit = 20, partType, search, customer, useYn } = query;
    const skip = (page - 1) * limit;

    const queryBuilder = this.partRepository.createQueryBuilder('p')
      .where('p.deletedAt IS NULL');

    if (company) {
      queryBuilder.andWhere('p.company = :company', { company });
    }

    if (partType) {
      queryBuilder.andWhere('p.partType = :partType', { partType });
    }

    if (useYn) {
      queryBuilder.andWhere('p.useYn = :useYn', { useYn });
    }

    if (customer) {
      queryBuilder.andWhere('UPPER(p.customer) LIKE UPPER(:customer)', { customer: `%${customer}%` });
    }

    if (search) {
      queryBuilder.andWhere(
        '(UPPER(p.partCode) LIKE UPPER(:search) OR UPPER(p.partName) LIKE UPPER(:search) OR UPPER(p.partNo) LIKE UPPER(:search) OR UPPER(p.custPartNo) LIKE UPPER(:search) OR UPPER(p.spec) LIKE UPPER(:search))',
        { search: `%${search}%` }
      );
    }

    const [data, total] = await Promise.all([
      queryBuilder
        .orderBy('p.partCode', 'ASC')
        .skip(skip)
        .take(limit)
        .getMany(),
      queryBuilder.getCount(),
    ]);

    return { data, total, page, limit };
  }

  async findById(id: string) {
    const part = await this.partRepository.findOne({
      where: { id, deletedAt: IsNull() },
    });
    if (!part) throw new NotFoundException(`품목을 찾을 수 없습니다: ${id}`);
    return part;
  }

  async findByCode(partCode: string) {
    const part = await this.partRepository.findOne({
      where: { partCode, deletedAt: IsNull() },
    });
    if (!part) throw new NotFoundException(`품목을 찾을 수 없습니다: ${partCode}`);
    return part;
  }

  async create(dto: CreatePartDto) {
    const existing = await this.partRepository.findOne({
      where: { partCode: dto.partCode, deletedAt: IsNull() },
    });

    if (existing) throw new ConflictException(`이미 존재하는 품목 코드입니다: ${dto.partCode}`);

    const part = this.partRepository.create({
      partCode: dto.partCode,
      partName: dto.partName,
      partNo: dto.partNo,
      custPartNo: dto.custPartNo,
      partType: dto.partType,
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

  async update(id: string, dto: UpdatePartDto) {
    await this.findById(id);
    await this.partRepository.update(id, dto);
    return this.findById(id);
  }

  async delete(id: string) {
    await this.findById(id);
    await this.partRepository.update(id, { deletedAt: new Date() });
    return { id, deletedAt: new Date() };
  }

  async findByType(partType: string) {
    return this.partRepository.find({
      where: { partType, useYn: 'Y', deletedAt: IsNull() },
      order: { partCode: 'asc' },
    });
  }
}
