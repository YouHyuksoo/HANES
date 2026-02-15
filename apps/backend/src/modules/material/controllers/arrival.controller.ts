/**
 * @file src/modules/material/controllers/arrival.controller.ts
 * @description 입하관리 API 컨트롤러 - PO 기반/수동 입하 및 취소
 *
 * 초보자 가이드:
 * 1. **GET /material/arrivals**: 입하 이력 조회 (페이지네이션)
 * 2. **GET /material/arrivals/stats**: 입하 통계
 * 3. **GET /material/arrivals/receivable-pos**: 입하 가능 PO 목록
 * 4. **GET /material/arrivals/po/:poId/items**: PO 품목 상세
 * 5. **POST /material/arrivals/po**: PO 기반 입하 등록
 * 6. **POST /material/arrivals/manual**: 수동 입하 등록
 * 7. **POST /material/arrivals/cancel**: 입하 취소 (역분개)
 */

import { Controller, Get, Post, Body, Query, Param, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { ArrivalService } from '../services/arrival.service';
import {
  CreatePoArrivalDto,
  CreateManualArrivalDto,
  ArrivalQueryDto,
  CancelArrivalDto,
} from '../dto/arrival.dto';
import { ResponseUtil } from '../../../common/dto/response.dto';

@ApiTags('자재관리 - 입하관리')
@Controller('material/arrivals')
export class ArrivalController {
  constructor(private readonly arrivalService: ArrivalService) {}

  @Get()
  @ApiOperation({ summary: '입하 이력 조회' })
  async findAll(@Query() query: ArrivalQueryDto) {
    const result = await this.arrivalService.findAll(query);
    return ResponseUtil.paged(result.data, result.total, result.page, result.limit);
  }

  @Get('stats')
  @ApiOperation({ summary: '입하 통계' })
  async getStats() {
    const data = await this.arrivalService.getStats();
    return ResponseUtil.success(data);
  }

  @Get('receivable-pos')
  @ApiOperation({ summary: '입하 가능 PO 목록 조회' })
  async findReceivablePOs() {
    const data = await this.arrivalService.findReceivablePOs();
    return ResponseUtil.success(data);
  }

  @Get('po/:poId/items')
  @ApiOperation({ summary: 'PO 품목 상세 조회 (입하 가능 품목)' })
  async getPoItems(@Param('poId') poId: string) {
    const data = await this.arrivalService.getPoItems(poId);
    return ResponseUtil.success(data);
  }

  @Post('po')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'PO 기반 입하 등록' })
  async createPoArrival(@Body() dto: CreatePoArrivalDto) {
    const data = await this.arrivalService.createPoArrival(dto);
    return ResponseUtil.success(data, '입하가 등록되었습니다.');
  }

  @Post('manual')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '수동 입하 등록' })
  async createManualArrival(@Body() dto: CreateManualArrivalDto) {
    const data = await this.arrivalService.createManualArrival(dto);
    return ResponseUtil.success(data, '수동 입하가 등록되었습니다.');
  }

  @Post('cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '입하 취소 (역분개)' })
  async cancel(@Body() dto: CancelArrivalDto) {
    const data = await this.arrivalService.cancel(dto);
    return ResponseUtil.success(data, '입하가 취소되었습니다.');
  }
}
