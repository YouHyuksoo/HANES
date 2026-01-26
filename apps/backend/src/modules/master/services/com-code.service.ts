/**
 * @file src/modules/master/services/com-code.service.ts
 * @description 공통코드 비즈니스 로직 서비스
 *
 * 초보자 가이드:
 * 1. **CRUD 메서드**: 생성, 조회, 수정, 삭제 로직 구현
 * 2. **Prisma 사용**: PrismaService를 통해 DB 접근
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
import { PrismaService } from '../../../prisma/prisma.service';
import {
  CreateComCodeDto,
  UpdateComCodeDto,
  ComCodeQueryDto,
} from '../dto/com-code.dto';

@Injectable()
export class ComCodeService {
  private readonly logger = new Logger(ComCodeService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * 그룹 코드 목록 조회 (중복 제거)
   */
  async findAllGroups() {
    const groups = await this.prisma.comCode.groupBy({
      by: ['groupCode'],
      _count: { groupCode: true },
      orderBy: { groupCode: 'asc' },
    });

    return groups.map((g) => ({
      groupCode: g.groupCode,
      count: g._count?.groupCode ?? 0,
    }));
  }

  /**
   * 공통코드 목록 조회
   */
  async findAll(query: ComCodeQueryDto) {
    const { page = 1, limit = 10, groupCode, search, useYn } = query;
    const skip = (page - 1) * limit;

    const where = {
      ...(groupCode && { groupCode }),
      ...(useYn && { useYn }),
      ...(search && {
        OR: [
          { detailCode: { contains: search, mode: 'insensitive' as const } },
          { codeName: { contains: search, mode: 'insensitive' as const } },
        ],
      }),
    };

    const [data, total] = await Promise.all([
      this.prisma.comCode.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ groupCode: 'asc' }, { sortOrder: 'asc' }],
      }),
      this.prisma.comCode.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  /**
   * 그룹 코드로 상세 코드 목록 조회
   */
  async findByGroupCode(groupCode: string) {
    const codes = await this.prisma.comCode.findMany({
      where: {
        groupCode,
        useYn: 'Y',
      },
      orderBy: { sortOrder: 'asc' },
    });

    return codes;
  }

  /**
   * 공통코드 단건 조회 (ID)
   */
  async findById(id: string) {
    const code = await this.prisma.comCode.findUnique({
      where: { id },
    });

    if (!code) {
      throw new NotFoundException(`공통코드를 찾을 수 없습니다: ${id}`);
    }

    return code;
  }

  /**
   * 공통코드 단건 조회 (그룹코드 + 상세코드)
   */
  async findByCode(groupCode: string, detailCode: string) {
    const code = await this.prisma.comCode.findUnique({
      where: {
        groupCode_detailCode: {
          groupCode,
          detailCode,
        },
      },
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
  async create(dto: CreateComCodeDto) {
    // 중복 체크
    const existing = await this.prisma.comCode.findUnique({
      where: {
        groupCode_detailCode: {
          groupCode: dto.groupCode,
          detailCode: dto.detailCode,
        },
      },
    });

    if (existing) {
      throw new ConflictException(
        `이미 존재하는 코드입니다: ${dto.groupCode}.${dto.detailCode}`,
      );
    }

    return this.prisma.comCode.create({
      data: {
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
      },
    });
  }

  /**
   * 공통코드 수정
   */
  async update(id: string, dto: UpdateComCodeDto) {
    await this.findById(id); // 존재 확인

    return this.prisma.comCode.update({
      where: { id },
      data: {
        ...(dto.parentCode !== undefined && { parentCode: dto.parentCode }),
        ...(dto.codeName !== undefined && { codeName: dto.codeName }),
        ...(dto.codeDesc !== undefined && { codeDesc: dto.codeDesc }),
        ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
        ...(dto.useYn !== undefined && { useYn: dto.useYn }),
        ...(dto.attr1 !== undefined && { attr1: dto.attr1 }),
        ...(dto.attr2 !== undefined && { attr2: dto.attr2 }),
        ...(dto.attr3 !== undefined && { attr3: dto.attr3 }),
      },
    });
  }

  /**
   * 공통코드 삭제
   */
  async delete(id: string) {
    await this.findById(id); // 존재 확인

    return this.prisma.comCode.delete({
      where: { id },
    });
  }

  /**
   * 공통코드 일괄 삭제 (그룹 코드 기준)
   */
  async deleteByGroupCode(groupCode: string) {
    return this.prisma.comCode.deleteMany({
      where: { groupCode },
    });
  }
}
