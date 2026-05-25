/**
 * @file src/modules/menu-categories/services/menu-categories.service.ts
 * @description 사이드바 카테고리 CRUD/Reorder 서비스
 *
 * 초보자 가이드:
 * 1. 카테고리 코드는 영문 대문자/언더스코어, __ROOT__는 예약어
 * 2. 빈 카테고리만 삭제 가능 (자식 있으면 한국어 메시지 409)
 * 3. reorder는 트랜잭션으로 일괄 갱신
 */
import { Injectable, ConflictException, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TransactionService } from '../../../shared/transaction.service';
import { MenuCategory } from '../../../entities/menu-category.entity';
import { MenuCategoryItem } from '../../../entities/menu-category-item.entity';
import {
  CreateMenuCategoryDto,
  UpdateMenuCategoryDto,
  ReorderCategoriesDto,
  RESERVED_ROOT,
} from '../dto/menu-category.dto';

interface AuditScope {
  company: string;
  plantCd: string;
  userId: string;
}

@Injectable()
export class MenuCategoriesService {
  constructor(
    @InjectRepository(MenuCategory)
    private readonly categoryRepo: Repository<MenuCategory>,
    @InjectRepository(MenuCategoryItem)
    private readonly itemRepo: Repository<MenuCategoryItem>,
    private readonly tx: TransactionService,
  ) {}

  async findAll(scope?: AuditScope): Promise<MenuCategory[]> {
    const tenantWhere = scope ? { company: scope.company, plantCd: scope.plantCd } : {};
    return this.categoryRepo.find({
      where: tenantWhere,
      order: { sortOrder: 'ASC', categoryCode: 'ASC' },
    });
  }

  async create(dto: CreateMenuCategoryDto, scope: AuditScope): Promise<MenuCategory> {
    if (dto.code === RESERVED_ROOT) {
      throw new BadRequestException(`예약어 ${RESERVED_ROOT}는 생성할 수 없습니다.`);
    }
    const existing = await this.categoryRepo.findOne({
      where: { categoryCode: dto.code, company: scope.company, plantCd: scope.plantCd },
    });
    if (existing) {
      throw new ConflictException(`이미 존재하는 카테고리 코드입니다: ${dto.code}`);
    }
    const now = new Date();
    const entity = this.categoryRepo.create({
      categoryCode: dto.code,
      labelKey: dto.labelKey,
      iconName: dto.iconName ?? null,
      sortOrder: 9999,
      isActive: 'Y',
      company: scope.company,
      plantCd: scope.plantCd,
      createdAt: now,
      createdBy: scope.userId,
      updatedAt: now,
      updatedBy: scope.userId,
    });
    return this.categoryRepo.save(entity);
  }

  async update(code: string, dto: UpdateMenuCategoryDto, scope: AuditScope): Promise<MenuCategory> {
    const existing = await this.categoryRepo.findOne({
      where: { categoryCode: code, company: scope.company, plantCd: scope.plantCd },
    });
    if (!existing) throw new NotFoundException(`카테고리를 찾을 수 없습니다: ${code}`);

    if (code === RESERVED_ROOT) {
      if (dto.labelKey !== undefined || dto.iconName !== undefined || dto.isActive !== undefined) {
        throw new BadRequestException(`${RESERVED_ROOT}는 라벨/아이콘/활성 상태를 변경할 수 없습니다.`);
      }
    }

    await this.categoryRepo.update(
      { categoryCode: code, company: scope.company, plantCd: scope.plantCd },
      {
        ...(dto.labelKey !== undefined && { labelKey: dto.labelKey }),
        ...(dto.iconName !== undefined && { iconName: dto.iconName }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
        updatedAt: new Date(),
        updatedBy: scope.userId,
      },
    );

    return (await this.categoryRepo.findOne({
      where: { categoryCode: code, company: scope.company, plantCd: scope.plantCd },
    }))!;
  }

  async delete(code: string, scope?: AuditScope): Promise<{ code: string }> {
    if (code === RESERVED_ROOT) {
      throw new BadRequestException(`예약어 ${RESERVED_ROOT}는 삭제할 수 없습니다.`);
    }
    const tenantWhere = scope ? { company: scope.company, plantCd: scope.plantCd } : {};
    const existing = await this.categoryRepo.findOne({ where: { categoryCode: code, ...tenantWhere } });
    if (!existing) throw new NotFoundException(`카테고리를 찾을 수 없습니다: ${code}`);

    const childCount = await this.itemRepo.count({ where: { categoryCode: code, ...tenantWhere } });
    if (childCount > 0) {
      throw new ConflictException(
        `카테고리에 메뉴가 ${childCount}개 있습니다. 먼저 다른 카테고리로 이동하거나 삭제해주세요`,
      );
    }

    await this.categoryRepo.delete({ categoryCode: code, ...tenantWhere });
    return { code };
  }

  async reorder(dto: ReorderCategoriesDto, scope?: AuditScope): Promise<void> {
    const tenantWhere = scope ? { company: scope.company, plantCd: scope.plantCd } : {};
    await this.tx.run(async (queryRunner) => {
      const repo = queryRunner.manager.getRepository(MenuCategory);
      for (const item of dto.items) {
        await repo.update(
          { categoryCode: item.code, ...tenantWhere },
          { sortOrder: item.sortOrder, updatedAt: new Date() },
        );
      }
    });
  }
}
