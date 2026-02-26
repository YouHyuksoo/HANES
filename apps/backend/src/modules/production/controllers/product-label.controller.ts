/**
 * @file product-label.controller.ts
 * @description 제품 라벨 발행 API — 생산실적/OQC PASS 조회 + prdUid 채번
 *
 * 초보자 가이드:
 * 1. GET /production/product-label/results: 라벨 미발행 생산실적
 * 2. GET /production/product-label/oqc-passed: OQC 합격 + 미발행건
 * 3. POST /production/product-label/create: prdUid 채번 + 라벨 발행
 */
import { Controller, Get, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { ProductLabelService } from '../services/product-label.service';
import { CreatePrdLabelsDto } from '../dto/product-label.dto';
import { ResponseUtil } from '../../../common/dto/response.dto';

@ApiTags('생산관리 - 제품라벨발행')
@Controller('production/product-label')
export class ProductLabelController {
  constructor(private readonly service: ProductLabelService) {}

  @Get('results')
  @ApiOperation({ summary: '라벨 미발행 생산실적 목록' })
  async findLabelableResults() {
    const data = await this.service.findLabelableResults();
    return ResponseUtil.success(data);
  }

  @Get('oqc-passed')
  @ApiOperation({ summary: 'OQC 합격 + 라벨 미발행 목록' })
  async findLabelableOqcPassed() {
    const data = await this.service.findLabelableOqcPassed();
    return ResponseUtil.success(data);
  }

  @Post('create')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'prdUid 채번 + 제품 라벨 발행' })
  async createLabels(@Body() dto: CreatePrdLabelsDto) {
    const data = await this.service.createPrdLabels(dto);
    return ResponseUtil.success(data, `${data.length}건의 제품시리얼이 생성되었습니다.`);
  }
}
