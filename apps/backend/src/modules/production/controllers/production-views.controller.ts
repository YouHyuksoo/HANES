/**
 * @file src/modules/production/controllers/production-views.controller.ts
 * @description 생산관리 조회 전용 API 컨트롤러
 *
 * 초보자 가이드:
 * 1. **작업진행현황**: GET /production/progress
 * 2. **샘플검사이력**: GET /production/sample-inspect
 * 3. **포장실적조회**: GET /production/pack-result
 * 4. **반제품/제품재고**: GET /production/wip-stock
 */

import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ProductionViewsService } from '../services/production-views.service';
import {
  ProgressQueryDto,
  SampleInspectQueryDto,
  PackResultQueryDto,
  WipStockQueryDto,
} from '../dto/production-views.dto';
import { ResponseUtil } from '../../../common/dto/response.dto';

@ApiTags('생산관리 - 조회')
@Controller('production')
export class ProductionViewsController {
  constructor(private readonly viewsService: ProductionViewsService) {}

  @Get('progress')
  @ApiOperation({ summary: '작업지시 진행현황', description: '작업지시별 계획수량 vs 실적수량, 진행률 대시보드' })
  @ApiResponse({ status: 200, description: '조회 성공' })
  async getProgress(@Query() query: ProgressQueryDto) {
    const result = await this.viewsService.getProgress(query);
    return ResponseUtil.paged(result.data, result.total, result.page, result.limit);
  }

  @Get('sample-inspect')
  @ApiOperation({ summary: '샘플검사이력 조회', description: '검사 결과 이력 목록' })
  @ApiResponse({ status: 200, description: '조회 성공' })
  async getSampleInspect(@Query() query: SampleInspectQueryDto) {
    const result = await this.viewsService.getSampleInspect(query);
    return ResponseUtil.paged(result.data, result.total, result.page, result.limit);
  }

  @Get('pack-result')
  @ApiOperation({ summary: '포장실적 조회', description: '포장 박스 실적 목록' })
  @ApiResponse({ status: 200, description: '조회 성공' })
  async getPackResult(@Query() query: PackResultQueryDto) {
    const result = await this.viewsService.getPackResult(query);
    return ResponseUtil.paged(result.data, result.total, result.page, result.limit);
  }

  @Get('wip-stock')
  @ApiOperation({ summary: '반제품/제품 재고 조회', description: 'WIP/FG 유형 재고 목록' })
  @ApiResponse({ status: 200, description: '조회 성공' })
  async getWipStock(@Query() query: WipStockQueryDto) {
    const result = await this.viewsService.getWipStock(query);
    return ResponseUtil.paged(result.data, result.total, result.page, result.limit);
  }
}
