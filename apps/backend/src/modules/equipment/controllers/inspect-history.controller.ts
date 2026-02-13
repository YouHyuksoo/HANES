/**
 * @file src/modules/equipment/controllers/inspect-history.controller.ts
 * @description 설비 점검이력 조회 API 컨트롤러 (조회 전용)
 *
 * 초보자 가이드:
 * 1. **엔드포인트**: /api/v1/equipment/inspect-history
 * 2. 일상/정기 점검 전체 이력을 조회 (inspectType 필터 가능)
 *
 * API 경로:
 * - GET /equipment/inspect-history          점검이력 목록 조회
 * - GET /equipment/inspect-history/summary  점검이력 통계
 */

import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { EquipInspectService } from '../services/equip-inspect.service';
import { EquipInspectQueryDto } from '../dto/equip-inspect.dto';
import { ResponseUtil } from '../../../common/dto/response.dto';

@ApiTags('설비관리 - 점검이력')
@Controller('equipment/inspect-history')
export class InspectHistoryController {
  constructor(private readonly equipInspectService: EquipInspectService) {}

  @Get()
  @ApiOperation({ summary: '점검이력 목록 조회 (전체)' })
  @ApiResponse({ status: 200, description: '조회 성공' })
  async findAll(@Query() query: EquipInspectQueryDto) {
    const result = await this.equipInspectService.findAll(query);
    return ResponseUtil.paged(result.data, result.total, result.page, result.limit);
  }

  @Get('summary')
  @ApiOperation({ summary: '점검이력 통계 요약' })
  @ApiResponse({ status: 200, description: '조회 성공' })
  async getSummary() {
    const data = await this.equipInspectService.getSummary();
    return ResponseUtil.success(data);
  }
}
