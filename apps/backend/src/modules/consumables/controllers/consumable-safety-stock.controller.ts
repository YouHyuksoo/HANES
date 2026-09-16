/**
 * @file consumable-safety-stock.controller.ts
 * @description 소모품 안전재고 사전알림 조회
 *
 * GET /consumables/safety-stock  품목별 안전재고 수준
 *   - onlyActionNeeded=Y : 부족/사전경고만 (목록 기본값·대시보드)
 *   - category, search   : 목록 필터
 */
import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Company, Plant } from '../../../common/decorators/tenant.decorator';
import { ConsumableSafetyStockService } from '../services/consumable-safety-stock.service';

@ApiTags('소모품')
@Controller('consumables/safety-stock')
export class ConsumableSafetyStockController {
  constructor(private readonly service: ConsumableSafetyStockService) {}

  @Get()
  @ApiOperation({ summary: '소모품 안전재고 사전알림 목록' })
  async list(
    @Company() company: string,
    @Plant() plant: string,
    @Query('onlyActionNeeded') onlyActionNeeded?: string,
    @Query('category') category?: string,
    @Query('search') search?: string,
  ) {
    const result = await this.service.findSafetyLevels(company, plant, {
      onlyActionNeeded: onlyActionNeeded === 'Y',
      category: category || undefined,
      search: search || undefined,
    });
    return { success: true, data: result.data, ratio: result.ratio };
  }
}
