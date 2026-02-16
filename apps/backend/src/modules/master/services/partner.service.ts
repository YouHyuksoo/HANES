/**
 * @file src/modules/master/services/partner.service.ts
 * @description 거래처마스터 비즈니스 로직 서비스
 */

import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreatePartnerDto, UpdatePartnerDto, PartnerQueryDto } from '../dto/partner.dto';

@Injectable()
export class PartnerService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: PartnerQueryDto, company?: string) {
    const { page = 1, limit = 10, partnerType, search, useYn } = query;
    const skip = (page - 1) * limit;

    const where = {
      deletedAt: null,
      ...(company && { company }),
      ...(partnerType && { partnerType }),
      ...(useYn && { useYn }),
      ...(search && {
        OR: [
          { partnerCode: { contains: search, mode: 'insensitive' as const } },
          { partnerName: { contains: search, mode: 'insensitive' as const } },
          { bizNo: { contains: search, mode: 'insensitive' as const } },
          { contactPerson: { contains: search, mode: 'insensitive' as const } },
        ],
      }),
    };

    const [data, total] = await Promise.all([
      this.prisma.partnerMaster.findMany({ where, skip, take: limit, orderBy: { partnerCode: 'asc' } }),
      this.prisma.partnerMaster.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  async findById(id: string) {
    const partner = await this.prisma.partnerMaster.findFirst({ where: { id, deletedAt: null } });
    if (!partner) throw new NotFoundException(`거래처를 찾을 수 없습니다: ${id}`);
    return partner;
  }

  async findByCode(partnerCode: string) {
    const partner = await this.prisma.partnerMaster.findFirst({ where: { partnerCode, deletedAt: null } });
    if (!partner) throw new NotFoundException(`거래처를 찾을 수 없습니다: ${partnerCode}`);
    return partner;
  }

  async create(dto: CreatePartnerDto) {
    const existing = await this.prisma.partnerMaster.findFirst({
      where: { partnerCode: dto.partnerCode, deletedAt: null },
    });

    if (existing) throw new ConflictException(`이미 존재하는 거래처 코드입니다: ${dto.partnerCode}`);

    return this.prisma.partnerMaster.create({
      data: {
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
      },
    });
  }

  async update(id: string, dto: UpdatePartnerDto) {
    await this.findById(id);
    return this.prisma.partnerMaster.update({ where: { id }, data: dto });
  }

  async delete(id: string) {
    await this.findById(id);
    return this.prisma.partnerMaster.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  async findByType(partnerType: string) {
    return this.prisma.partnerMaster.findMany({
      where: { partnerType, useYn: 'Y', deletedAt: null },
      orderBy: { partnerCode: 'asc' },
    });
  }

  async getStatistics() {
    const [totalCount, supplierCount, customerCount, activeCount] = await Promise.all([
      this.prisma.partnerMaster.count({ where: { deletedAt: null } }),
      this.prisma.partnerMaster.count({ where: { partnerType: 'SUPPLIER', deletedAt: null } }),
      this.prisma.partnerMaster.count({ where: { partnerType: 'CUSTOMER', deletedAt: null } }),
      this.prisma.partnerMaster.count({ where: { useYn: 'Y', deletedAt: null } }),
    ]);

    return { totalCount, supplierCount, customerCount, activeCount };
  }
}
