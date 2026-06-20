/**
 * @file src/modules/master/services/partner.service.ts
 * @description 거래처마스터 비즈니스 로직 서비스 - TypeORM Repository 패턴
 */

import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PartnerMaster } from '../../../entities/partner-master.entity';
import { CreatePartnerDto, UpdatePartnerDto, PartnerQueryDto } from '../dto/partner.dto';

@Injectable()
export class PartnerService {
  constructor(
    @InjectRepository(PartnerMaster)
    private readonly partnerRepository: Repository<PartnerMaster>,
  ) {}

  private tenantWhere(company?: string, plant?: string) {
    return {
      ...(company ? { company } : {}),
      ...(plant ? { plant } : {}),
    };
  }

  async findAll(query: PartnerQueryDto, company?: string, plant?: string) {
    const { page = 1, limit = 10, partnerType, search, useYn } = query;
    const skip = (page - 1) * limit;

    const queryBuilder = this.partnerRepository.createQueryBuilder('partner')

    if (company) {
      queryBuilder.andWhere('partner.company = :company', { company });
    }
    if (plant) {
      queryBuilder.andWhere('partner.plant = :plant', { plant });
    }

    if (partnerType) {
      queryBuilder.andWhere('partner.partnerType = :partnerType', { partnerType });
    }

    if (useYn) {
      queryBuilder.andWhere('partner.useYn = :useYn', { useYn });
    }

    if (search) {
      const upper = search.toUpperCase();
      queryBuilder.andWhere(
        '(partner.partnerCode LIKE :search OR partner.partnerName LIKE :searchRaw OR partner.bizNo LIKE :search OR partner.contactPerson LIKE :searchRaw)',
        { search: `%${upper}%`, searchRaw: `%${search}%` }
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

  async findById(partnerCode: string, company?: string, plant?: string) {
    const partner = await this.partnerRepository.findOne({
      where: { partnerCode, ...this.tenantWhere(company, plant) },
    });
    if (!partner) throw new NotFoundException(`거래처를 찾을 수 없습니다: ${partnerCode}`);
    return partner;
  }

  async findByCode(partnerCode: string, company?: string, plant?: string) {
    const partner = await this.partnerRepository.findOne({
      where: { partnerCode, ...this.tenantWhere(company, plant) },
    });
    if (!partner) throw new NotFoundException(`거래처를 찾을 수 없습니다: ${partnerCode}`);
    return partner;
  }

  async create(dto: CreatePartnerDto, company?: string, plant?: string) {
    const existing = await this.partnerRepository.findOne({
      where: { partnerCode: dto.partnerCode, ...this.tenantWhere(company, plant) },
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
      qualityGrade: dto.qualityGrade ?? null,
      inspectionMode: dto.inspectionMode ?? 'NORMAL',
      remark: dto.remark,
      useYn: dto.useYn ?? 'Y',
      company,
      plant,
    });

    return this.partnerRepository.save(partner);
  }

  async update(partnerCode: string, dto: UpdatePartnerDto, company?: string, plant?: string) {
    await this.findById(partnerCode, company, plant);
    const updateData: Partial<Pick<PartnerMaster,
      | 'partnerName'
      | 'partnerType'
      | 'bizNo'
      | 'ceoName'
      | 'address'
      | 'tel'
      | 'fax'
      | 'email'
      | 'contactPerson'
      | 'qualityGrade'
      | 'inspectionMode'
      | 'remark'
      | 'useYn'
    >> = {
      ...(dto.partnerName !== undefined ? { partnerName: dto.partnerName } : {}),
      ...(dto.partnerType !== undefined ? { partnerType: dto.partnerType } : {}),
      ...(dto.bizNo !== undefined ? { bizNo: dto.bizNo } : {}),
      ...(dto.ceoName !== undefined ? { ceoName: dto.ceoName } : {}),
      ...(dto.address !== undefined ? { address: dto.address } : {}),
      ...(dto.tel !== undefined ? { tel: dto.tel } : {}),
      ...(dto.fax !== undefined ? { fax: dto.fax } : {}),
      ...(dto.email !== undefined ? { email: dto.email } : {}),
      ...(dto.contactPerson !== undefined ? { contactPerson: dto.contactPerson } : {}),
      ...(dto.qualityGrade !== undefined ? { qualityGrade: dto.qualityGrade || null } : {}),
      ...(dto.inspectionMode !== undefined ? { inspectionMode: dto.inspectionMode } : {}),
      ...(dto.remark !== undefined ? { remark: dto.remark } : {}),
      ...(dto.useYn !== undefined ? { useYn: dto.useYn } : {}),
    };
    await this.partnerRepository.update({ partnerCode, ...this.tenantWhere(company, plant) }, updateData);
    return this.findById(partnerCode, company, plant);
  }

  async delete(partnerCode: string, company?: string, plant?: string) {
    await this.findById(partnerCode, company, plant);
    await this.partnerRepository.delete({ partnerCode, ...this.tenantWhere(company, plant) });
    return { partnerCode };
  }

  async findByType(partnerType: string, company?: string, plant?: string) {
    return this.partnerRepository.find({
      where: { partnerType, useYn: 'Y', ...this.tenantWhere(company, plant) },
      order: { partnerCode: 'asc' },
    });
  }

  async getStatistics(company?: string, plant?: string) {
    // 4번 count → 1번 집계 쿼리로 통합
    const qb = this.partnerRepository
      .createQueryBuilder('p')
      .select('COUNT(*)', 'totalCount')
      .addSelect("SUM(CASE WHEN p.partnerType = 'SUPPLIER' THEN 1 ELSE 0 END)", 'supplierCount')
      .addSelect("SUM(CASE WHEN p.partnerType = 'CUSTOMER' THEN 1 ELSE 0 END)", 'customerCount')
      .addSelect("SUM(CASE WHEN p.useYn = 'Y' THEN 1 ELSE 0 END)", 'activeCount');

    if (company) qb.andWhere('p.company = :company', { company });
    if (plant) qb.andWhere('p.plant = :plant', { plant });

    const stats = await qb.getRawOne();

    return {
      totalCount: Number(stats.totalCount) || 0,
      supplierCount: Number(stats.supplierCount) || 0,
      customerCount: Number(stats.customerCount) || 0,
      activeCount: Number(stats.activeCount) || 0,
    };
  }
}
