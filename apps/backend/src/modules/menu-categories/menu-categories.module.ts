/**
 * @file src/modules/menu-categories/menu-categories.module.ts
 * @description 메뉴 카테고리 관리 모듈
 */
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MenuCategory } from '../../entities/menu-category.entity';
import { MenuCategoryItem } from '../../entities/menu-category-item.entity';
import { MenuCategoriesService } from './services/menu-categories.service';
import { MenuCategoryItemsService } from './services/menu-category-items.service';
import { MenuCategoriesController } from './controllers/menu-categories.controller';
import { MenuCategoryItemsController } from './controllers/menu-category-items.controller';
import { User } from '../../entities/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([MenuCategory, MenuCategoryItem, User])],
  controllers: [MenuCategoriesController, MenuCategoryItemsController],
  providers: [MenuCategoriesService, MenuCategoryItemsService],
  exports: [MenuCategoriesService, MenuCategoryItemsService],
})
export class MenuCategoriesModule {}
