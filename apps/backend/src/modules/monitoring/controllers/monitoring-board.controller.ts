/**
 * @file src/modules/monitoring/controllers/monitoring-board.controller.ts
 * @description 모니터링 보드 API 컨트롤러 — 현장 TV/사이니지용 읽기전용 집계
 *
 * API 구조:
 * - GET /monitoring/boards/production : 생산현황 보드(KPI+작업지시+시간대별 실적) — 작업지시 칸반도 재사용
 * - GET /monitoring/boards/quality    : 품질 보드(불량률/공정별/유형TOP/수리/7일 추이)
 * - GET /monitoring/boards/inventory  : 재고 보드(유형별 KPI/안전재고 미달/창고별/금일 입출고)
 */
import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Company, Plant } from '../../../common/decorators/tenant.decorator';
import { ProductionBoardService } from '../services/production-board.service';
import { QualityBoardService } from '../services/quality-board.service';
import { InventoryBoardService } from '../services/inventory-board.service';

@ApiTags('모니터링 - 보드')
@Controller('monitoring/boards')
export class MonitoringBoardController {
  constructor(
    private readonly productionBoardService: ProductionBoardService,
    private readonly qualityBoardService: QualityBoardService,
    private readonly inventoryBoardService: InventoryBoardService,
  ) {}

  @Get('production')
  @ApiOperation({ summary: '생산현황 보드', description: '오늘 지시일 작업지시 KPI/목록/시간대별 실적' })
  async getProductionBoard(@Company() company: string, @Plant() plant: string) {
    const data = await this.productionBoardService.getBoard(company, plant);
    return { success: true, data };
  }

  @Get('quality')
  @ApiOperation({ summary: '품질 보드', description: '오늘 불량률/공정별/유형 TOP/수리 현황/7일 추이' })
  async getQualityBoard(@Company() company: string, @Plant() plant: string) {
    const data = await this.qualityBoardService.getBoard(company, plant);
    return { success: true, data };
  }

  @Get('inventory')
  @ApiOperation({ summary: '재고 보드', description: '유형별 KPI/안전재고 미달/창고별 분포/금일 입출고' })
  async getInventoryBoard(@Company() company: string, @Plant() plant: string) {
    const data = await this.inventoryBoardService.getBoard(company, plant);
    return { success: true, data };
  }
}
