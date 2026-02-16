/**
 * @file src/common/services/generic-crud.service.ts
 * @description Generic CRUD 서비스 베이스 클래스
 *
 * 기능:
 * 1. 페이지네이션 목록 조회 (findAll)
 * 2. 단건 조회 (findById)
 * 3. 생성 (create)
 * 4. 수정 (update)
 * 5. 소프트 삭제 (remove)
 * 6. 검색/필터링 자동 처리
 * 7. 중복 체크 및 예외 처리
 *
 * 사용법:
 * @Injectable()
 * export class ProductService extends GenericCrudService<
 *   Product,
 *   CreateProductDto,
 *   UpdateProductDto,
 *   ProductQueryDto
 * > {
 *   constructor(prisma: PrismaService) {
 *     super(prisma, 'product', ['code', 'name']);
 *   }
 *
 *   // 특화 로직만 추가
 * }
 */

import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import { PaginationMeta, ResponseUtil } from '../dto/response.dto';
import { BaseListQueryDto } from '../dto/base-query.dto';

/**
 * Prisma 모델 이름 타입
 */
export type PrismaModelName = keyof Omit<
  PrismaClient,
  | '$connect'
  | '$disconnect'
  | '$on'
  | '$transaction'
  | '$use'
  | '$queryRaw'
  | '$queryRawUnsafe'
  | '$executeRaw'
  | '$executeRawUnsafe'
  | '$extends'
>;

/**
 * 페이지네이션 결과 인터페이스
 */
export interface PaginatedResult<T> {
  data: T[];
  meta: PaginationMeta;
}

/**
 * Generic CRUD 서비스 옵션
 */
export interface GenericCrudOptions<T> {
  /**
   * 검색 대상 필드 목록
   * @example ['code', 'name', 'description']
   */
  searchFields?: (keyof T)[];

  /**
   * 기본 정렬 필드
   * @default 'createdAt'
   */
  defaultSortField?: keyof T;

  /**
   * 기본 정렬 방향
   * @default 'desc'
   */
  defaultSortOrder?: 'asc' | 'desc';

  /**
   * 고유 필드 (중복 체크용)
   * @example ['code', 'email']
   */
  uniqueFields?: (keyof T)[];

  /**
   * include 옵션 (관계 데이터 조회)
   */
  defaultInclude?: any;
}

/**
 * Generic CRUD 서비스 베이스 클래스
 */
@Injectable()
export abstract class GenericCrudService<
  T extends { id: string; createdAt?: Date; updatedAt?: Date; deletedAt?: Date | null },
  CreateDto extends Record<string, any>,
  UpdateDto extends Record<string, any>,
  QueryDto extends BaseListQueryDto = BaseListQueryDto,
> {
  /**
   * Prisma 모델 delegate
   */
  protected model: any;

  constructor(
    protected prisma: PrismaClient,
    protected modelName: PrismaModelName,
    protected options: GenericCrudOptions<T> = {},
  ) {
    this.model = prisma[modelName];
  }

  /**
   * 목록 조회 (페이지네이션, 검색, 필터링)
   */
  async findAll(query: QueryDto): Promise<PaginatedResult<T>> {
    const {
      page = 1,
      limit = 10,
    } = query;

    const skip = (page - 1) * limit;
    const where = this.buildWhere(query);

    // 정렬 옵션
    const orderBy: any = {
      [this.options.defaultSortField || 'createdAt']:
        this.options.defaultSortOrder || 'desc',
    };

    // 병렬 조회
    const [data, total] = await Promise.all([
      this.model.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: this.options.defaultInclude,
      }),
      this.model.count({ where }),
    ]);

    return ResponseUtil.paged(data, total, page, limit) as PaginatedResult<T>;
  }

  /**
   * 단건 조회
   */
  async findById(id: string, include?: any): Promise<T> {
    const item = await this.model.findFirst({
      where: { id, deletedAt: null } as any,
      include: include || this.options.defaultInclude,
    });

    if (!item) {
      throw new NotFoundException(`${String(this.modelName)} with ID "${id}" not found`);
    }

    return item;
  }

  /**
   * 생성
   */
  async create(dto: CreateDto, userId?: string): Promise<T> {
    // 고유 필드 중복 체크
    if (this.options.uniqueFields) {
      await this.checkDuplicates(dto as Partial<T>);
    }

    // 생성 데이터 구성
    const data: any = {
      ...dto,
      ...(userId && { createdBy: userId }),
    };

    return this.model.create({ data });
  }

  /**
   * 수정
   */
  async update(id: string, dto: UpdateDto, userId?: string): Promise<T> {
    // 존재 확인
    await this.findById(id);

    // 고유 필드 중복 체크 (다른 항목과 중복 체크)
    if (this.options.uniqueFields) {
      await this.checkDuplicates(dto as Partial<T>, id);
    }

    // 수정 데이터 구성
    const data: any = {
      ...dto,
      ...(userId && { updatedBy: userId }),
    };

    return this.model.update({
      where: { id },
      data,
    });
  }

  /**
   * 소프트 삭제
   */
  async remove(id: string, userId?: string): Promise<void> {
    // 존재 확인
    await this.findById(id);

    await this.model.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        ...(userId && { updatedBy: userId }),
      } as any,
    });
  }

  /**
   * 하드 삭제 (주의: 실제로 데이터를 삭제합니다)
   */
  async hardDelete(id: string): Promise<void> {
    await this.model.delete({
      where: { id },
    });
  }

  /**
   * WHERE 조건 빌드 (검색, 필터링)
   * @virtual 오버라이드 가능
   */
  protected buildWhere(query: QueryDto): any {
    const where: any = { deletedAt: null };

    // 검색어 처리
    if (query.search && this.options.searchFields?.length) {
      where.OR = this.options.searchFields.map((field) => ({
        [field]: {
          contains: query.search,
          mode: 'insensitive',
        },
      }));
    }

    // 상태 필터
    if (query.status) {
      where.status = query.status;
    }

    // 기간 필터
    if (query.fromDate || query.toDate) {
      where.createdAt = {};
      if (query.fromDate) {
        where.createdAt.gte = new Date(query.fromDate);
      }
      if (query.toDate) {
        where.createdAt.lte = new Date(query.toDate + 'T23:59:59.999Z');
      }
    }

    return where;
  }

  /**
   * 고유 필드 중복 체크
   */
  protected async checkDuplicates(dto: Partial<T>, excludeId?: string): Promise<void> {
    if (!this.options.uniqueFields) return;

    for (const field of this.options.uniqueFields) {
      const value = dto[field];
      if (!value) continue;

      const where: any = {
        [field]: value,
        deletedAt: null,
      };

      if (excludeId) {
        where.id = { not: excludeId };
      }

      const existing = await this.model.findFirst({ where });

      if (existing) {
        throw new ConflictException(
          `${String(this.modelName)} with ${String(field)} "${value}" already exists`,
        );
      }
    }
  }

  /**
   * 존재 여부 확인
   */
  protected async exists(id: string): Promise<boolean> {
    const count = await this.model.count({
      where: { id, deletedAt: null } as any,
    });
    return count > 0;
  }
}
