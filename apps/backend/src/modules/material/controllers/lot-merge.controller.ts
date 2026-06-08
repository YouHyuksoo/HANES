/**
 * @file src/modules/material/controllers/lot-merge.controller.ts
 * @description 자재 LOT 병합 API 컨트롤러
 *
 * 초보자 가이드:
 * 1. GET /material/lot-merge  — 병합 가능한 LOT 목록 조회
 * 2. POST /material/lot-merge — LOT 병합 실행
 */

import { Controller, Get, Post, Body, Query, Param, HttpCode, HttpStatus, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { LotMergeService } from '../services/lot-merge.service';
import { LotMergeDto, LotMergeQueryDto } from '../dto/lot-merge.dto';
import { ResponseUtil } from '../../../common/dto/response.dto';
import { Company, Plant } from '../../../common/decorators/tenant.decorator';
import { InventoryFreezeGuard } from '../../../common/guards/inventory-freeze.guard';

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

  @Get('by-barcode/:matUid')
  @ApiOperation({ summary: '바코드 스캔 단건 조회 (병합 후보 자격 검증)' })
  async findByBarcode(@Param('matUid') matUid: string, @Company() company: string, @Plant() plant: string) {
    const data = await this.lotMergeService.findByBarcode(matUid, company, plant);
    return ResponseUtil.success(data);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(InventoryFreezeGuard)
  @ApiOperation({ summary: 'LOT 병합 실행' })
  async merge(@Body() dto: LotMergeDto, @Company() company: string, @Plant() plant: string) {
    const data = await this.lotMergeService.merge(dto, company, plant);
    return ResponseUtil.success(data, 'LOT이 병합되었습니다.');
  }
}
