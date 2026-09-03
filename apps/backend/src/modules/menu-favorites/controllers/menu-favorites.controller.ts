/**
 * @file src/modules/menu-favorites/controllers/menu-favorites.controller.ts
 * @description 사용자별 사이드바 메뉴 즐겨찾기 컨트롤러
 *
 * 엔드포인트:
 * - GET /menu-favorites/me  내 즐겨찾기 메뉴 코드 목록 (순서 보존)
 * - PUT /menu-favorites/me  내 즐겨찾기 전체 교체 (menuCodes 배열 순서 = 표시 순서)
 */
import { BadRequestException, Body, Controller, Get, Put, Req } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { MenuFavoritesService, FavoriteScope } from '../services/menu-favorites.service';
import { ReplaceMenuFavoritesDto } from '../dto/menu-favorite.dto';
import { ResponseUtil } from '../../../common/dto/response.dto';
import { AuthenticatedRequest } from '../../../common/guards/jwt-auth.guard';

@ApiTags('시스템 - 메뉴 즐겨찾기')
@Controller('menu-favorites')
export class MenuFavoritesController {
  constructor(private readonly favorites: MenuFavoritesService) {}

  @Get('me')
  @ApiOperation({ summary: '내 즐겨찾기 메뉴 코드 목록' })
  async findMine(@Req() req: AuthenticatedRequest) {
    const data = await this.favorites.findMine(this.scope(req));
    return ResponseUtil.success(data);
  }

  @Put('me')
  @ApiOperation({ summary: '내 즐겨찾기 전체 교체 (배열 순서 = 표시 순서)' })
  async replaceMine(@Body() dto: ReplaceMenuFavoritesDto, @Req() req: AuthenticatedRequest) {
    const data = await this.favorites.replaceMine(dto.menuCodes, this.scope(req));
    return ResponseUtil.success(data);
  }

  private scope(req: AuthenticatedRequest): FavoriteScope {
    const user = req.user;
    if (!user?.company || !user?.plant || !user?.email) {
      throw new BadRequestException('회사/사업장/사용자 정보가 없습니다.');
    }
    return { company: user.company, plantCd: user.plant, userEmail: user.email };
  }
}
