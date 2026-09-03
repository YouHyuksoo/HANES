/**
 * @file src/modules/menu-favorites/menu-favorites.module.ts
 * @description 사용자별 사이드바 메뉴 즐겨찾기 모듈
 */
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserMenuFavorite } from '../../entities/user-menu-favorite.entity';
import { MenuFavoritesService } from './services/menu-favorites.service';
import { MenuFavoritesController } from './controllers/menu-favorites.controller';

@Module({
  imports: [TypeOrmModule.forFeature([UserMenuFavorite])],
  controllers: [MenuFavoritesController],
  providers: [MenuFavoritesService],
  exports: [MenuFavoritesService],
})
export class MenuFavoritesModule {}
