/**
 * @file src/modules/material/controllers/lot-merge.controller.ts
 * @description 자재 LOT 병합 API 컨트롤러
 *
 * 초보자 가이드:
 * 1. GET /material/lot-merge  — 병합 가능한 LOT 목록 조회
 * 2. POST /material/lot-merge — LOT 병합 실행
 */

import { Controller, Get, Post, Body, Query, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { LotMergeService } from '../services/lot-merge.service';
import { LotMergeDto, LotMergeQueryDto } from '../dto/lot-merge.dto';
import { ResponseUtil } from '../../../common/dto/response.dto';
import { Company, Plant } from '../../../common/decorators/tenant.decorator';

@ApiTags('자재관리 - LOT병합')
@Controller('material/lot-merge')
export class LotMergeController {
  constructor(private readonly lotMergeService: LotMergeService) {}

  @Get()
  @ApiOperation({ summary: '병합 가능한 LOT 목록 조회' })
  async findMergeable(@Query() query: LotMergeQueryDto, @Company() company: string, @Plant() plant: string) {
    const result = await this.lotMergeService.findMergeableLots(query, company, plant);
    return ResponseUtil.paged(result.data, result.total, result.page, result.limit);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'LOT 병합 실행' })
  async merge(@Body() dto: LotMergeDto) {
    const data = await this.lotMergeService.merge(dto);
    return ResponseUtil.success(data, 'LOT이 병합되었습니다.');
  }
}
