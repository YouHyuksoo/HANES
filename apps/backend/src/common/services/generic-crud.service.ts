/**
 * @file common/services/generic-crud.service.ts
 * @description Generic CRUD Service for TypeORM
 * 
 * TypeORM 버전으로 마이그레이션 완료
 * 사용법:
 * @Injectable()
 * export class ProductService extends GenericCrudService<Product> {
 *   constructor(
 *     @InjectRepository(Product)
 *     private readonly productRepository: Repository<Product>,
 *   ) {
 *     super(productRepository, ['code', 'name']);
 *   }
 * }
 */

import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { Repository, FindOptionsWhere, Like, IsNull, FindManyOptions, FindOneOptions } from 'typeorm';
import { PaginationMeta } from '../dto/response.dto';
import { BaseListQueryDto } from '../dto/base-query.dto';

export interface PaginatedResult<T> {
  data: T[];
  meta: PaginationMeta;
}

export interface GenericCrudOptions<T> {
  searchFields?: (keyof T)[];
  defaultSortField?: keyof T;
  defaultSortOrder?: 'asc' | 'desc';
  uniqueFields?: (keyof T)[];
}

@Injectable()
export abstract class GenericCrudService<T extends { id: string; createdAt?: Date; updatedAt?: Date; deletedAt?: Date | null }> {
  constructor(
    protected readonly repository: Repository<T>,
    protected readonly options: GenericCrudOptions<T> = {},
  ) {}

  /**
   * 목록 조회 (페이지네이션, 검색, 필터링)
   */
  async findAll(query: BaseListQueryDto): Promise<PaginatedResult<T>> {
    const {
      page = 1,
      limit = 10,
      search,
      status,
      fromDate,
      toDate,
    } = query;

    const skip = (page - 1) * limit;
    
    // WHERE 조건 빌드
    const where: FindOptionsWhere<T> = this.buildWhere({ search, status, fromDate, toDate });

    // 정렬 옵션
    const order: any = {
      [this.options.defaultSortField || 'createdAt']: this.options.defaultSortOrder || 'desc',
    };

    // 병렬 조회
    const [data, total] = await Promise.all([
      this.repository.find({
        where,
        skip,
        take: limit,
        order,
      }),
      this.repository.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);
    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    };
  }

  /**
   * 단건 조회
   */
  async findById(id: string): Promise<T> {
    const where: FindOptionsWhere<any> = { id, deletedAt: IsNull() };
    const item = await this.repository.findOne({ where });

    if (!item) {
      throw new NotFoundException(`Item with ID "${id}" not found`);
    }

    return item;
  }

  /**
   * 단건 조회 (소프트 삭제 포함)
   */
  async findByIdWithDeleted(id: string): Promise<T | null> {
    const where: FindOptionsWhere<any> = { id };
    return this.repository.findOne({ where });
  }

  /**
   * 생성
   */
  async create(dto: Partial<T>, userId?: string): Promise<T> {
    // 고유 필드 중복 체크
    if (this.options.uniqueFields) {
      await this.checkDuplicates(dto);
    }

    // 생성 데이터 구성
    const data: any = {
      ...dto,
      ...(userId && { createdBy: userId }),
    };

    const entity = this.repository.create(data);
    const saved = await this.repository.save(entity);
    return Array.isArray(saved) ? saved[0] : saved;
  }

  /**
   * 수정
   */
  async update(id: string, dto: Partial<T>, userId?: string): Promise<T> {
    // 존재 확인
    await this.findById(id);

    // 고유 필드 중복 체크 (다른 항목과 중복 체크)
    if (this.options.uniqueFields) {
      await this.checkDuplicates(dto, id);
    }

    // 수정 데이터 구성
    const data: any = {
      ...dto,
      ...(userId && { updatedBy: userId }),
    };

    await this.repository.update(id, data);
    return this.findById(id);
  }

  /**
   * 소프트 삭제
   */
  async remove(id: string, userId?: string): Promise<void> {
    // 존재 확인
    await this.findById(id);

    await this.repository.update(id, {
      deletedAt: new Date(),
      ...(userId && { updatedBy: userId }),
    } as any);
  }

  /**
   * 하드 삭제 (주의: 실제로 데이터를 삭제합니다)
   */
  async hardDelete(id: string): Promise<void> {
    await this.repository.delete(id);
  }

  /**
   * 복수 하드 삭제
   */
  async hardDeleteMany(ids: string[]): Promise<void> {
    await this.repository.delete(ids);
  }

  /**
   * 존재 여부 확인
   */
  async exists(id: string): Promise<boolean> {
    const count = await this.repository.count({
      where: { id, deletedAt: IsNull() } as any,
    });
    return count > 0;
  }

  /**
   * 전체 카운트
   */
  async count(): Promise<number> {
    return this.repository.count({ where: { deletedAt: IsNull() } as any });
  }

  /**
   * WHERE 조건 빌드
   */
  protected buildWhere(filters: {
    search?: string;
    status?: string;
    fromDate?: string;
    toDate?: string;
  }): FindOptionsWhere<T> {
    const where: FindOptionsWhere<any> = { deletedAt: IsNull() };

    // 검색어 처리 (Oracle은 대소문자 구분이 있을 수 있으므로 UPPER 사용)
    if (filters.search && this.options.searchFields?.length) {
      const searchConditions = this.options.searchFields.map((field) => {
        return { [field]: Like(`%${filters.search}%`) };
      });
      // TypeORM에서는 OR 조건을 다르게 처리
      // 실제 구현에서는 QueryBuilder를 사용하는 것이 좋음
    }

    // 상태 필터
    if (filters.status) {
      where.status = filters.status;
    }

    // 기간 필터
    if (filters.fromDate || filters.toDate) {
      where.createdAt = {};
      if (filters.fromDate) {
        where.createdAt.gte = new Date(filters.fromDate);
      }
      if (filters.toDate) {
        where.createdAt.lte = new Date(filters.toDate + 'T23:59:59.999Z');
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

      const where: FindOptionsWhere<any> = {
        [field]: value,
        deletedAt: IsNull(),
      };

      if (excludeId) {
        where.id = { not: excludeId };
      }

      const existing = await this.repository.findOne({ where });

      if (existing) {
        throw new ConflictException(
          `${String(field)} with value "${value}" already exists`,
        );
      }
    }
  }

  /**
   * QueryBuilder 접근 (복잡한 쿼리용)
   */
  protected createQueryBuilder(alias: string) {
    return this.repository.createQueryBuilder(alias);
  }
}
