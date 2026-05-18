/**
 * @file src/modules/menu-categories/controllers/menu-category-items.controller.ts
 * @description 메뉴(leaf) ↔ 카테고리 배치 컨트롤러 — 이동/삭제 단건
 */
import { Body, Controller, Delete, HttpCode, HttpStatus, Param, Patch, Req } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { MenuCategoryItemsService } from '../services/menu-category-items.service';
import { MoveMenuItemDto } from '../dto/menu-category-item.dto';
import { ResponseUtil } from '../../../common/dto/response.dto';

@ApiTags('시스템 - 메뉴 배치')
@Controller('menu-category-items')
export class MenuCategoryItemsController {
  constructor(private readonly items: MenuCategoryItemsService) {}

  @Patch('move')
  @ApiOperation({ summary: '메뉴를 다른 카테고리로 이동' })
  async move(@Body() dto: MoveMenuItemDto, @Req() req: any) {
    const data = await this.items.move(dto, this.scope(req));
    return ResponseUtil.success(data);
  }

  @Delete(':menuCode')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '메뉴 배치 삭제(미배치 상태로 만들기)' })
  async remove(@Param('menuCode') menuCode: string) {
    const data = await this.items.remove(menuCode);
    return ResponseUtil.success(data);
  }

  private scope(req: any) {
    const user = req.user ?? {};
    return {
      company: user.company ?? 'HANES',
      plantCd: user.plantCd ?? '-',
      userId: user.userId ?? user.userName ?? 'system',
    };
  }
}
