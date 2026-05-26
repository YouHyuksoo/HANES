/**
 * @file src/modules/menu-categories/controllers/menu-categories.controller.ts
 * @description 사이드바 카테고리 CRUD/Tree/Reorder 컨트롤러
 *
 * 엔드포인트:
 * - GET    /menu-categories                  목록
 * - GET    /menu-categories/tree             사이드바 렌더용 트리(카테고리 + 메뉴 배치)
 * - GET    /menu-categories/unassigned-menus 미배치 menu 코드 목록
 * - POST   /menu-categories                  신규 카테고리
 * - PATCH  /menu-categories/reorder          카테고리 순서 일괄 갱신
 * - PATCH  /menu-categories/:code            카테고리 수정
 * - PATCH  /menu-categories/:code/items      카테고리 내 메뉴 순서 일괄 갱신
 * - DELETE /menu-categories/:code            카테고리 삭제
 */
import {
  BadRequestException,
  Body, Controller, Delete, Get, HttpCode, HttpStatus,
  Param, Patch, Post, Req, UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { MenuCategoriesService } from '../services/menu-categories.service';
import { MenuCategoryItemsService } from '../services/menu-category-items.service';
import {
  CreateMenuCategoryDto, UpdateMenuCategoryDto, ReorderCategoriesDto,
} from '../dto/menu-category.dto';
import { ReorderMenuItemsDto } from '../dto/menu-category-item.dto';
import { ResponseUtil } from '../../../common/dto/response.dto';
import { listKnownMenuCodes } from '../utils/menu-code-validator';
import { AuthenticatedRequest, JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';

@ApiTags('시스템 - 메뉴 카테고리')
@Controller('menu-categories')
export class MenuCategoriesController {
  constructor(
    private readonly categories: MenuCategoriesService,
    private readonly items: MenuCategoryItemsService,
  ) {}

  @Get()
  @ApiOperation({ summary: '카테고리 목록' })
  async findAll(@Req() req: AuthenticatedRequest) {
    const data = await this.categories.findAll(this.scope(req));
    return ResponseUtil.success(data);
  }

  @Get('tree')
  @ApiOperation({ summary: '사이드바 트리 (카테고리 + 메뉴 배치)' })
  async tree(@Req() req: AuthenticatedRequest) {
    const scope = this.scope(req);
    const [categories, allItems] = await Promise.all([
      this.categories.findAll(scope),
      this.items.findAll(scope),
    ]);
    const byCategory = new Map<string, { menuCode: string; sortOrder: number }[]>();
    for (const it of allItems) {
      const arr = byCategory.get(it.categoryCode) ?? [];
      arr.push({ menuCode: it.menuCode, sortOrder: it.sortOrder });
      byCategory.set(it.categoryCode, arr);
    }
    const tree = categories.map((c) => ({
      categoryCode: c.categoryCode,
      labelKey: c.labelKey,
      iconName: c.iconName,
      sortOrder: c.sortOrder,
      isActive: c.isActive,
      menus: byCategory.get(c.categoryCode) ?? [],
    }));
    return ResponseUtil.success(tree);
  }

  @Get('unassigned-menus')
  @ApiOperation({ summary: '어디에도 배치되지 않은 메뉴 코드 목록' })
  async unassigned(@Req() req: AuthenticatedRequest) {
    const all = listKnownMenuCodes();
    const allItems = await this.items.findAll(this.scope(req));
    const placed = new Set(allItems.map((i) => i.menuCode));
    const unassigned = all.filter((code) => !placed.has(code));
    return ResponseUtil.success(unassigned);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '카테고리 생성' })
  async create(@Body() dto: CreateMenuCategoryDto, @Req() req: AuthenticatedRequest) {
    const data = await this.categories.create(dto, this.scope(req));
    return ResponseUtil.success(data);
  }

  @Patch('reorder')
  @ApiOperation({ summary: '카테고리 순서 일괄 갱신' })
  async reorder(@Body() dto: ReorderCategoriesDto, @Req() req: AuthenticatedRequest) {
    await this.categories.reorder(dto, this.scope(req));
    return ResponseUtil.success({ ok: true });
  }

  @Patch(':code')
  @ApiOperation({ summary: '카테고리 수정' })
  async update(@Param('code') code: string, @Body() dto: UpdateMenuCategoryDto, @Req() req: AuthenticatedRequest) {
    const data = await this.categories.update(code, dto, this.scope(req));
    return ResponseUtil.success(data);
  }

  @Patch(':code/items')
  @ApiOperation({ summary: '카테고리 내 메뉴 순서 일괄 갱신' })
  async reorderItems(@Param('code') code: string, @Body() dto: ReorderMenuItemsDto, @Req() req: AuthenticatedRequest) {
    await this.items.reorderInCategory(code, dto, this.scope(req));
    return ResponseUtil.success({ ok: true });
  }

  @Delete(':code')
  @ApiOperation({ summary: '카테고리 삭제(빈 카테고리만 가능)' })
  async delete(@Param('code') code: string, @Req() req: AuthenticatedRequest) {
    const data = await this.categories.delete(code, this.scope(req));
    return ResponseUtil.success(data);
  }

  private scope(req: AuthenticatedRequest) {
    const user = req.user;
    const company = user.company;
    const plantCd = user.plant;
    if (!company || !plantCd) {
      throw new BadRequestException('회사/사업장 정보가 없습니다.');
    }
    return {
      company,
      plantCd,
      userId: user.id,
    };
  }
}
