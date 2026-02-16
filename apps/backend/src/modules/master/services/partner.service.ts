/**
 * @file src/modules/master/services/partner.service.ts
 * @description 거래처마스터 비즈니스 로직 서비스 - TypeORM Repository 패턴
 */

import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { PartnerMaster } from '../../../entities/partner-master.entity';
import { CreatePartnerDto, UpdatePartnerDto, PartnerQueryDto } from '../dto/partner.dto';

@Injectable()
export class PartnerService {
  constructor(
    @InjectRepository(PartnerMaster)
    private readonly partnerRepository: Repository<PartnerMaster>,
  ) {}

  async findAll(query: PartnerQueryDto, company?: string) {
    const { page = 1, limit = 10, partnerType, search, useYn } = query;
    const skip = (page - 1) * limit;

    const queryBuilder = this.partnerRepository.createQueryBuilder('partner')
      .where('partner.deletedAt IS NULL');

    if (company) {
      queryBuilder.andWhere('partner.company = :company', { company });
    }

    if (partnerType) {
      queryBuilder.andWhere('partner.partnerType = :partnerType', { partnerType });
    }

    if (useYn) {
      queryBuilder.andWhere('partner.useYn = :useYn', { useYn });
    }

    if (search) {
      queryBuilder.andWhere(
        '(UPPER(partner.partnerCode) LIKE UPPER(:search) OR UPPER(partner.partnerName) LIKE UPPER(:search) OR UPPER(partner.bizNo) LIKE UPPER(:search) OR UPPER(partner.contactPerson) LIKE UPPER(:search))',
        { search: `%${search}%` }
      );
    }

    const [data, total] = await Promise.all([
      queryBuilder
        .orderBy('partner.partnerCode', 'ASC')
        .skip(skip)
        .take(limit)
        .getMany(),
      queryBuilder.getCount(),
    ]);

    return { data, total, page, limit };
  }

  async findById(id: string) {
    const partner = await this.partnerRepository.findOne({
      where: { id, deletedAt: IsNull() },
    });
    if (!partner) throw new NotFoundException(`거래처를 찾을 수 없습니다: ${id}`);
    return partner;
  }

  async findByCode(partnerCode: string) {
    const partner = await this.partnerRepository.findOne({
      where: { partnerCode, deletedAt: IsNull() },
    });
    if (!partner) throw new NotFoundException(`거래처를 찾을 수 없습니다: ${partnerCode}`);
    return partner;
  }

  async create(dto: CreatePartnerDto) {
    const existing = await this.partnerRepository.findOne({
      where: { partnerCode: dto.partnerCode, deletedAt: IsNull() },
    });

    if (existing) throw new ConflictException(`이미 존재하는 거래처 코드입니다: ${dto.partnerCode}`);

    const partner = this.partnerRepository.create({
      partnerCode: dto.partnerCode,
      partnerName: dto.partnerName,
      partnerType: dto.partnerType,
      bizNo: dto.bizNo,
      ceoName: dto.ceoName,
      address: dto.address,
      tel: dto.tel,
      fax: dto.fax,
      email: dto.email,
      contactPerson: dto.contactPerson,
      remark: dto.remark,
      useYn: dto.useYn ?? 'Y',
    });

    return this.partnerRepository.save(partner);
  }

  async update(id: string, dto: UpdatePartnerDto) {
    await this.findById(id);
    await this.partnerRepository.update(id, dto);
    return this.findById(id);
  }

  async delete(id: string) {
    await this.findById(id);
    await this.partnerRepository.update(id, { deletedAt: new Date() });
    return { id, deletedAt: new Date() };
  }

  async findByType(partnerType: string) {
    return this.partnerRepository.find({
      where: { partnerType, useYn: 'Y', deletedAt: IsNull() },
      order: { partnerCode: 'asc' },
    });
  }

  async getStatistics() {
    const [totalCount, supplierCount, customerCount, activeCount] = await Promise.all([
      this.partnerRepository.count({ where: { deletedAt: IsNull() } }),
      this.partnerRepository.count({ where: { partnerType: 'SUPPLIER', deletedAt: IsNull() } }),
      this.partnerRepository.count({ where: { partnerType: 'CUSTOMER', deletedAt: IsNull() } }),
      this.partnerRepository.count({ where: { useYn: 'Y', deletedAt: IsNull() } }),
    ]);

    return { totalCount, supplierCount, customerCount, activeCount };
  }
}
