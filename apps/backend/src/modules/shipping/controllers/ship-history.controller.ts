/**
 * @file src/modules/shipping/controllers/ship-history.controller.ts
 * @description 출하이력 조회 API 컨트롤러 (조회 전용)
 *
 * 초보자 가이드:
 * 1. **엔드포인트**: /api/v1/shipping/history
 * 2. 조회 전용 - GET만 지원
 *
 * API 경로:
 * - GET /shipping/history          출하이력 목록 조회
 * - GET /shipping/history/summary  출하이력 통계
 */

import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ShipHistoryService } from '../services/ship-history.service';
import { ShipHistoryQueryDto } from '../dto/ship-history.dto';
import { ResponseUtil } from '../../../common/dto/response.dto';

@ApiTags('출하관리 - 출하이력')
@Controller('shipping/history')
export class ShipHistoryController {
  constructor(private readonly shipHistoryService: ShipHistoryService) {}

  @Get()
  @ApiOperation({ summary: '출하이력 목록 조회' })
  @ApiResponse({ status: 200, description: '조회 성공' })
  async findAll(@Query() query: ShipHistoryQueryDto) {
    const result = await this.shipHistoryService.findAll(query);
    return ResponseUtil.paged(result.data, result.total, result.page, result.limit);
  }

  @Get('summary')
  @ApiOperation({ summary: '출하이력 통계 요약' })
  @ApiResponse({ status: 200, description: '조회 성공' })
  async getSummary() {
    const data = await this.shipHistoryService.getSummary();
    return ResponseUtil.success(data);
  }
}
