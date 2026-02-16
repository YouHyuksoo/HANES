/**
 * @file src/modules/master/services/company.service.ts
 * @description 회사마스터 비즈니스 로직 서비스 - TypeORM Repository 패턴
 *
 * 초보자 가이드:
 * 1. **findAll**: 페이지네이션 + 검색 지원 목록 조회
 * 2. **findPublic**: 인증 없이 활성 회사 목록 (로그인 페이지용)
 * 3. **CRUD**: 생성/수정/소프트삭제
 */

import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { CompanyMaster } from '../../../entities/company-master.entity';
import { CreateCompanyDto, UpdateCompanyDto, CompanyQueryDto } from '../dto/company.dto';

@Injectable()
export class CompanyService {
  constructor(
    @InjectRepository(CompanyMaster)
    private readonly companyRepository: Repository<CompanyMaster>,
  ) {}

  /** 회사 목록 조회 (페이지네이션 + 검색) */
  async findAll(query: CompanyQueryDto) {
    const { page = 1, limit = 10, search, useYn } = query;
    const skip = (page - 1) * limit;

    const queryBuilder = this.companyRepository.createQueryBuilder('company')
      .where('company.deletedAt IS NULL');

    if (useYn) {
      queryBuilder.andWhere('company.useYn = :useYn', { useYn });
    }

    if (search) {
      queryBuilder.andWhere(
        '(UPPER(company.companyCode) LIKE UPPER(:search) OR UPPER(company.companyName) LIKE UPPER(:search) OR UPPER(company.bizNo) LIKE UPPER(:search))',
        { search: `%${search}%` }
      );
    }

    const [data, total] = await Promise.all([
      queryBuilder
        .orderBy('company.companyCode', 'ASC')
        .skip(skip)
        .take(limit)
        .getMany(),
      queryBuilder.getCount(),
    ]);

    return { data, total, page, limit };
  }

  /** 공개 API — 활성 회사 목록 (로그인 페이지용, 인증 불필요) */
  async findPublic() {
    return this.companyRepository.find({
      where: { useYn: 'Y', deletedAt: IsNull() },
      select: ['companyCode', 'companyName'],
      order: { companyCode: 'asc' },
    });
  }

  /** 상세 조회 */
  async findById(id: string) {
    const company = await this.companyRepository.findOne({
      where: { id, deletedAt: IsNull() },
    });
    if (!company) throw new NotFoundException(`회사를 찾을 수 없습니다: ${id}`);
    return company;
  }

  /** 생성 */
  async create(dto: CreateCompanyDto) {
    const existing = await this.companyRepository.findOne({
      where: { companyCode: dto.companyCode, deletedAt: IsNull() },
    });
    if (existing) throw new ConflictException(`이미 존재하는 회사 코드입니다: ${dto.companyCode}`);

    const company = this.companyRepository.create({
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
    });

    return this.companyRepository.save(company);
  }

  /** 수정 */
  async update(id: string, dto: UpdateCompanyDto) {
    await this.findById(id);
    await this.companyRepository.update(id, dto);
    return this.findById(id);
  }

  /** 소프트 삭제 */
  async delete(id: string) {
    await this.findById(id);
    await this.companyRepository.update(id, { deletedAt: new Date() });
    return { id, deletedAt: new Date() };
  }
}
