/**
 * @file src/modules/menu-categories/services/menu-category-items.service.ts
 * @description 메뉴(leaf) ↔ 카테고리 배치 서비스 — 이동/삭제/카테고리 내 순서 일괄 갱신
 *
 * 초보자 가이드:
 * 1. move(): 메뉴 코드의 카테고리 배치를 신규 생성 또는 갱신 (upsert)
 * 2. remove(): 배치 행 삭제 → 미배치 상태 (사이드바에 표시 안 됨)
 * 3. reorderInCategory(): 같은 카테고리 내에서 sort_order 일괄 갱신
 * 4. menuCode 화이트리스트는 menu-code-validator의 KNOWN_LEAF_CODES
 */
import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TransactionService } from '../../../shared/transaction.service';
import { MenuCategory } from '../../../entities/menu-category.entity';
import { MenuCategoryItem } from '../../../entities/menu-category-item.entity';
import { MoveMenuItemDto, ReorderMenuItemsDto } from '../dto/menu-category-item.dto';
import { isValidMenuCode } from '../utils/menu-code-validator';

interface AuditScope {
  company: string;
  plantCd: string;
  userId: string;
}

@Injectable()
export class MenuCategoryItemsService {
  constructor(
    @InjectRepository(MenuCategoryItem)
    private readonly itemRepo: Repository<MenuCategoryItem>,
    @InjectRepository(MenuCategory)
    private readonly categoryRepo: Repository<MenuCategory>,
    private readonly tx: TransactionService,
  ) {}

  async findByCategory(categoryCode: string, scope?: AuditScope): Promise<MenuCategoryItem[]> {
    const tenantWhere = scope ? { company: scope.company, plantCd: scope.plantCd } : {};
    return this.itemRepo.find({
      where: { categoryCode, ...tenantWhere },
      order: { sortOrder: 'ASC', menuCode: 'ASC' },
    });
  }

  async findAll(scope?: AuditScope): Promise<MenuCategoryItem[]> {
    const tenantWhere = scope ? { company: scope.company, plantCd: scope.plantCd } : {};
    return this.itemRepo.find({
      where: tenantWhere,
      order: { categoryCode: 'ASC', sortOrder: 'ASC', menuCode: 'ASC' },
    });
  }

  async move(dto: MoveMenuItemDto, scope: AuditScope): Promise<MenuCategoryItem> {
    if (!isValidMenuCode(dto.menuCode)) {
      throw new BadRequestException(`알 수 없는 메뉴 코드입니다: ${dto.menuCode}`);
    }
    const cat = await this.categoryRepo.findOne({
      where: { categoryCode: dto.toCategoryCode, company: scope.company, plantCd: scope.plantCd },
    });
    if (!cat) throw new NotFoundException(`카테고리를 찾을 수 없습니다: ${dto.toCategoryCode}`);

    const existing = await this.itemRepo.findOne({
      where: { menuCode: dto.menuCode, company: scope.company, plantCd: scope.plantCd },
    });
    const now = new Date();

    const entity = this.itemRepo.create({
      menuCode: dto.menuCode,
      categoryCode: dto.toCategoryCode,
      sortOrder: dto.sortOrder,
      company: scope.company,
      plantCd: scope.plantCd,
      createdAt: existing?.createdAt ?? now,
      createdBy: existing?.createdBy ?? scope.userId,
      updatedAt: now,
      updatedBy: scope.userId,
    });

    return this.itemRepo.save(entity);
  }

  async remove(menuCode: string, scope?: AuditScope): Promise<{ menuCode: string }> {
    const tenantWhere = scope ? { company: scope.company, plantCd: scope.plantCd } : {};
    const existing = await this.itemRepo.findOne({ where: { menuCode, ...tenantWhere } });
    if (!existing) throw new NotFoundException(`메뉴 배치를 찾을 수 없습니다: ${menuCode}`);

    await this.itemRepo.delete({ menuCode, ...tenantWhere });
    return { menuCode };
  }

  async reorderInCategory(categoryCode: string, dto: ReorderMenuItemsDto, scope?: AuditScope): Promise<void> {
    const tenantWhere = scope ? { company: scope.company, plantCd: scope.plantCd } : {};
    await this.tx.run(async (queryRunner) => {
      const repo = queryRunner.manager.getRepository(MenuCategoryItem);
      for (const item of dto.items) {
        await repo.update(
          { menuCode: item.menuCode, categoryCode, ...tenantWhere },
          { sortOrder: item.sortOrder, updatedAt: new Date() },
        );
      }
    });
  }
}
