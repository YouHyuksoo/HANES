/**
 * @file src/modules/master/services/company.service.ts
 * @description 회사마스터 비즈니스 로직 서비스
 *
 * 초보자 가이드:
 * 1. **findAll**: 페이지네이션 + 검색 지원 목록 조회
 * 2. **findPublic**: 인증 없이 활성 회사 목록 (로그인 페이지용)
 * 3. **CRUD**: 생성/수정/소프트삭제
 */

import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateCompanyDto, UpdateCompanyDto, CompanyQueryDto } from '../dto/company.dto';

@Injectable()
export class CompanyService {
  constructor(private readonly prisma: PrismaService) {}

  /** 회사 목록 조회 (페이지네이션 + 검색) */
  async findAll(query: CompanyQueryDto) {
    const { page = 1, limit = 10, search, useYn } = query;
    const skip = (page - 1) * limit;

    const where = {
      deletedAt: null,
      ...(useYn && { useYn }),
      ...(search && {
        OR: [
          { companyCode: { contains: search, mode: 'insensitive' as const } },
          { companyName: { contains: search, mode: 'insensitive' as const } },
          { bizNo: { contains: search, mode: 'insensitive' as const } },
        ],
      }),
    };

    const [data, total] = await Promise.all([
      this.prisma.companyMaster.findMany({ where, skip, take: limit, orderBy: { companyCode: 'asc' } }),
      this.prisma.companyMaster.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  /** 공개 API — 활성 회사 목록 (로그인 페이지용, 인증 불필요) */
  async findPublic() {
    return this.prisma.companyMaster.findMany({
      where: { useYn: 'Y', deletedAt: null },
      select: { companyCode: true, companyName: true },
      orderBy: { companyCode: 'asc' },
    });
  }

  /** 상세 조회 */
  async findById(id: string) {
    const company = await this.prisma.companyMaster.findFirst({ where: { id, deletedAt: null } });
    if (!company) throw new NotFoundException(`회사를 찾을 수 없습니다: ${id}`);
    return company;
  }

  /** 생성 */
  async create(dto: CreateCompanyDto) {
    const existing = await this.prisma.companyMaster.findFirst({
      where: { companyCode: dto.companyCode, deletedAt: null },
    });
    if (existing) throw new ConflictException(`이미 존재하는 회사 코드입니다: ${dto.companyCode}`);

    return this.prisma.companyMaster.create({
      data: {
        companyCode: dto.companyCode,
        companyName: dto.companyName,
        bizNo: dto.bizNo,
        ceoName: dto.ceoName,
        address: dto.address,
        tel: dto.tel,
        fax: dto.fax,
        email: dto.email,
        remark: dto.remark,
        useYn: dto.useYn ?? 'Y',
      },
    });
  }

  /** 수정 */
  async update(id: string, dto: UpdateCompanyDto) {
    await this.findById(id);
    return this.prisma.companyMaster.update({ where: { id }, data: dto });
  }

  /** 소프트 삭제 */
  async delete(id: string) {
    await this.findById(id);
    return this.prisma.companyMaster.update({ where: { id }, data: { deletedAt: new Date() } });
  }
}
