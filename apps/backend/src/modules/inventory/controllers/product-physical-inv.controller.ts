/**
 * @file src/modules/inventory/controllers/product-physical-inv.controller.ts
 * @description 제품 재고실사 API 컨트롤러
 *
 * 초보자 가이드:
 * 1. GET /inventory/product-physical-inv → 실사 대상 Stock 목록
 * 2. GET /inventory/product-physical-inv/history → 실사 이력
 * 3. POST /inventory/product-physical-inv → 실사 결과 반영
 */

import { Controller, Get, Post, Body, Query, HttpCode, HttpStatus } from '@nestjs/common';
import { Company, Plant } from '../../../common/decorators/tenant.decorator';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { ProductPhysicalInvService } from '../services/product-physical-inv.service';
import {
  CreateProductPhysicalInvDto,
  ProductPhysicalInvQueryDto,
  ProductPhysicalInvHistoryQueryDto,
} from '../dto/product-physical-inv.dto';
import { ResponseUtil } from '../../../common/dto/response.dto';

@ApiTags('재고관리 - 제품 재고실사')
@Controller('inventory/product-physical-inv')
export class ProductPhysicalInvController {
  constructor(private readonly productPhysicalInvService: ProductPhysicalInvService) {}

  @Get()
  @ApiOperation({ summary: '제품 실사 대상 재고 목록 조회' })
  async findStocks(@Query() query: ProductPhysicalInvQueryDto, @Company() company: string, @Plant() plant: string) {
    const result = await this.productPhysicalInvService.findStocks(query, company, plant);
    return ResponseUtil.paged(result.data, result.total, result.page, result.limit);
  }

  @Get('history')
  @ApiOperation({ summary: '제품 재고실사 이력 조회' })
  async findHistory(@Query() query: ProductPhysicalInvHistoryQueryDto, @Company() company: string, @Plant() plant: string) {
    const result = await this.productPhysicalInvService.findHistory(query, company, plant);
    return ResponseUtil.paged(result.data, result.total, result.page, result.limit);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '제품 재고실사 결과 반영' })
  async apply(@Body() dto: CreateProductPhysicalInvDto) {
    const data = await this.productPhysicalInvService.applyCount(dto);
    return ResponseUtil.success(data, '제품 재고실사가 반영되었습니다.');
  }
}
