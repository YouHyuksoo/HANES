/**
 * @file src/modules/master/services/com-code.service.ts
 * @description 공통코드 비즈니스 로직 서비스 - TypeORM Repository 패턴
 *
 * 초보자 가이드:
 * 1. **CRUD 메서드**: 생성, 조회, 수정, 삭제 로직 구현
 * 2. **TypeORM 사용**: Repository 패턴을 통해 DB 접근
 * 3. **에러 처리**: NotFoundException 등 적절한 예외 발생
 *
 * 실제 DB 스키마 (com_codes 테이블):
 * - 단일 테이블에서 groupCode로 그룹 구분
 * - groupCode + detailCode가 유니크 키
 */

import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ComCode } from '../../../entities/com-code.entity';
import {
  CreateComCodeDto,
  UpdateComCodeDto,
  ComCodeQueryDto,
} from '../dto/com-code.dto';

@Injectable()
export class ComCodeService {
  private readonly logger = new Logger(ComCodeService.name);

  constructor(
    @InjectRepository(ComCode)
    private readonly comCodeRepository: Repository<ComCode>,
  ) {}

  private tenantWhere(company?: string, plant?: string) {
    return {
      ...(company ? { company } : {}),
      ...(plant ? { plant } : {}),
    };
  }

  private parseId(id: string) {
    const [groupCode, detailCode] = id.split('::');
    return { groupCode, detailCode };
  }

  /**
   * 전체 활성 코드를 groupCode별 그룹핑하여 반환
   * 프론트엔드에서 한 번의 호출로 모든 공통코드를 로드할 때 사용
   */
  async findAllActive(company?: string, plant?: string): Promise<Record<string, Array<{
    detailCode: string;
    codeName: string;
    codeDesc: string | null;
    sortOrder: number;
    attr1: string | null;
    attr2: string | null;
    attr3: string | null;
    defectGrade: string | null;
  }>>> {
    const codes = await this.comCodeRepository.find({
      where: { useYn: 'Y', ...this.tenantWhere(company, plant) },
      order: { groupCode: 'asc', sortOrder: 'asc' },
      select: {
        groupCode: true,
        detailCode: true,
        codeName: true,
        codeDesc: true,
        sortOrder: true,
        attr1: true,
        attr2: true,
        attr3: true,
        defectGrade: true,
      },
    });

    const grouped: Record<string, Array<{
      detailCode: string;
      codeName: string;
      codeDesc: string | null;
      sortOrder: number;
      attr1: string | null;
      attr2: string | null;
      attr3: string | null;
      defectGrade: string | null;
    }>> = {};

    for (const code of codes) {
      const { groupCode, ...rest } = code;
      if (!grouped[groupCode]) {
        grouped[groupCode] = [];
      }
      grouped[groupCode].push(rest);
    }

    return grouped;
  }

  /**
   * 그룹 코드 목록 조회 (중복 제거)
   */
  async findAllGroups(company?: string, plant?: string) {
    const queryBuilder = this.comCodeRepository.createQueryBuilder('code')
      .select('code.groupCode', 'groupCode')
      .addSelect('COUNT(*)', 'count')
      .addSelect("LISTAGG(code.detailCode, ' ') WITHIN GROUP (ORDER BY code.sortOrder)", 'detailCodes')
      .addSelect("LISTAGG(code.codeName, ' ') WITHIN GROUP (ORDER BY code.sortOrder)", 'searchTextKo')
      .addSelect("LISTAGG(code.attr1, ' ') WITHIN GROUP (ORDER BY code.sortOrder)", 'searchTextEn')
      .addSelect("LISTAGG(code.attr2, ' ') WITHIN GROUP (ORDER BY code.sortOrder)", 'searchTextZh')
      .addSelect("LISTAGG(code.attr3, ' ') WITHIN GROUP (ORDER BY code.sortOrder)", 'searchTextVi')
      .groupBy('code.groupCode')
      .orderBy('code.groupCode', 'ASC');

    if (company) {
      queryBuilder.andWhere('code.company = :company', { company });
    }
    if (plant) {
      queryBuilder.andWhere('code.plant = :plant', { plant });
    }

    const groups = await queryBuilder.getRawMany();

    return groups.map((g) => ({
      groupCode: g.groupCode,
      count: parseInt(g.count, 10),
      detailCodes: typeof g.detailCodes === 'string'
        ? g.detailCodes.split(' ').filter(Boolean)
        : [],
      searchText: {
        ko: g.searchTextKo ?? '',
        en: g.searchTextEn ?? '',
        zh: g.searchTextZh ?? '',
        vi: g.searchTextVi ?? '',
      },
    }));
  }

  /**
   * 공통코드 목록 조회
   */
  async findAll(query: ComCodeQueryDto, company?: string, plant?: string) {
    const { page = 1, limit = 10, groupCode, search, useYn } = query;
    const skip = (page - 1) * limit;

    const queryBuilder = this.comCodeRepository.createQueryBuilder('code');

    if (company) {
      queryBuilder.andWhere('code.company = :company', { company });
    }
    if (plant) {
      queryBuilder.andWhere('code.plant = :plant', { plant });
    }

    if (groupCode) {
      queryBuilder.andWhere('code.groupCode = :groupCode', { groupCode });
    }

    if (useYn) {
      queryBuilder.andWhere('code.useYn = :useYn', { useYn });
    }

    if (search) {
      const upper = search.toUpperCase();
      queryBuilder.andWhere(
        '(code.detailCode LIKE :searchUpper OR code.codeName LIKE :searchRaw)',
        { searchUpper: `%${upper}%`, searchRaw: `%${search}%` },
      );
    }

    const [data, total] = await Promise.all([
      queryBuilder
        .orderBy('code.groupCode', 'ASC')
        .addOrderBy('code.sortOrder', 'ASC')
        .skip(skip)
        .take(limit)
        .getMany(),
      queryBuilder.getCount(),
    ]);

    return { data, total, page, limit };
  }

  /**
   * 그룹 코드로 상세 코드 목록 조회
   */
  async findByGroupCode(groupCode: string, company?: string, plant?: string) {
    return this.comCodeRepository.find({
      where: { groupCode, useYn: 'Y', ...this.tenantWhere(company, plant) },
      order: { sortOrder: 'asc' },
    });
  }

  /**
   * 공통코드 단건 조회 (ID)
   */
  async findById(id: string, company?: string, plant?: string) {
    // id is composite key encoded as "groupCode::detailCode"
    const { groupCode, detailCode } = this.parseId(id);
    const code = await this.comCodeRepository.findOne({
      where: { groupCode, detailCode, ...this.tenantWhere(company, plant) },
    });

    if (!code) {
      throw new NotFoundException(`공통코드를 찾을 수 없습니다: ${id}`);
    }

    return code;
  }

  /**
   * 공통코드 단건 조회 (그룹코드 + 상세코드)
   */
  async findByCode(groupCode: string, detailCode: string, company?: string, plant?: string) {
    const code = await this.comCodeRepository.findOne({
      where: { groupCode, detailCode, ...this.tenantWhere(company, plant) },
    });

    if (!code) {
      throw new NotFoundException(
        `공통코드를 찾을 수 없습니다: ${groupCode}.${detailCode}`,
      );
    }

    return code;
  }

  /**
   * 공통코드 생성
   */
  async create(dto: CreateComCodeDto, company?: string, plant?: string) {
    // 중복 체크
    const existing = await this.comCodeRepository.findOne({
      where: {
        groupCode: dto.groupCode,
        detailCode: dto.detailCode,
        ...this.tenantWhere(company, plant),
      },
    });

    if (existing) {
      throw new ConflictException(
        `이미 존재하는 코드입니다: ${dto.groupCode}.${dto.detailCode}`,
      );
    }

    const comCode = this.comCodeRepository.create({
      groupCode: dto.groupCode,
      detailCode: dto.detailCode,
      parentCode: dto.parentCode,
      codeName: dto.codeName,
      codeDesc: dto.codeDesc,
      sortOrder: dto.sortOrder ?? 0,
      useYn: dto.useYn ?? 'Y',
      attr1: dto.attr1,
      attr2: dto.attr2,
      attr3: dto.attr3,
      defectGrade: dto.defectGrade ?? null,
      company: company || null,
      plant: plant || null,
    });

    return this.comCodeRepository.save(comCode);
  }

  /**
   * 공통코드 수정
   */
  async update(id: string, dto: UpdateComCodeDto, company?: string, plant?: string) {
    await this.findById(id, company, plant); // 존재 확인
    const { groupCode, detailCode } = this.parseId(id);

    const updateData: Partial<Pick<ComCode, 'parentCode' | 'codeName' | 'codeDesc' | 'sortOrder' | 'useYn' | 'attr1' | 'attr2' | 'attr3' | 'defectGrade'>> = {};
    if (dto.parentCode !== undefined) updateData.parentCode = dto.parentCode;
    if (dto.codeName !== undefined) updateData.codeName = dto.codeName;
    if (dto.codeDesc !== undefined) updateData.codeDesc = dto.codeDesc;
    if (dto.sortOrder !== undefined) updateData.sortOrder = dto.sortOrder;
    if (dto.useYn !== undefined) updateData.useYn = dto.useYn;
    if (dto.attr1 !== undefined) updateData.attr1 = dto.attr1;
    if (dto.attr2 !== undefined) updateData.attr2 = dto.attr2;
    if (dto.attr3 !== undefined) updateData.attr3 = dto.attr3;
    if (dto.defectGrade !== undefined) updateData.defectGrade = dto.defectGrade;

    await this.comCodeRepository.update(
      { groupCode, detailCode, ...this.tenantWhere(company, plant) },
      updateData,
    );
    return this.findById(id, company, plant);
  }

  /**
   * 공통코드 삭제
   */
  async delete(id: string, company?: string, plant?: string) {
    await this.findById(id, company, plant); // 존재 확인
    const { groupCode, detailCode } = this.parseId(id);

    await this.comCodeRepository.delete({ groupCode, detailCode, ...this.tenantWhere(company, plant) });
    return { id, deleted: true };
  }

  /**
   * 공통코드 일괄 삭제 (그룹 코드 기준)
   */
  async deleteByGroupCode(groupCode: string, company?: string, plant?: string) {
    const result = await this.comCodeRepository.delete({
      groupCode,
      ...this.tenantWhere(company, plant),
    });
    return { count: result.affected || 0 };
  }
}
