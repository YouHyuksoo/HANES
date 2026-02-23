/**
 * @file src/modules/inventory/controllers/product-hold.controller.ts
 * @description 제품 재고 홀드 API 컨트롤러
 *
 * 초보자 가이드:
 * - GET /inventory/product-hold : 제품 재고 목록 (홀드 관리용)
 * - POST /inventory/product-hold/hold : 재고 홀드
 * - POST /inventory/product-hold/release : 홀드 해제
 */

import { Controller, Get, Post, Body, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { ProductHoldService } from '../services/product-hold.service';
import { ProductHoldActionDto, ProductReleaseHoldDto, ProductHoldQueryDto } from '../dto/product-hold.dto';
import { ResponseUtil } from '../../../common/dto/response.dto';
import { Company, Plant } from '../../../common/decorators/tenant.decorator';

@ApiTags('제품재고관리 - 제품홀드')
@Controller('inventory/product-hold')
export class ProductHoldController {
  constructor(private readonly productHoldService: ProductHoldService) {}

  @Get()
  @ApiOperation({ summary: '제품 재고 목록 조회 (홀드 관리)' })
  async findAll(
    @Query() query: ProductHoldQueryDto,
    @Company() company: string,
    @Plant() plant: string,
  ) {
    const result = await this.productHoldService.findAll(query, company, plant);
    return ResponseUtil.paged(result.data, result.total, result.page, result.limit);
  }

  @Post('hold')
  @ApiOperation({ summary: '제품 재고 홀드' })
  async hold(@Body() dto: ProductHoldActionDto) {
    const data = await this.productHoldService.hold(dto);
    return ResponseUtil.success(data, '제품 재고가 홀드 처리되었습니다.');
  }

  @Post('release')
  @ApiOperation({ summary: '제품 재고 홀드 해제' })
  async release(@Body() dto: ProductReleaseHoldDto) {
    const data = await this.productHoldService.release(dto);
    return ResponseUtil.success(data, '제품 재고 홀드가 해제되었습니다.');
  }
}
