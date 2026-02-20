/**
 * @file src/modules/material/controllers/mat-stock.controller.ts
 * @description 재고 관리 API 컨트롤러
 */

import { Controller, Get, Post, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam } from '@nestjs/swagger';
import { MatStockService } from '../services/mat-stock.service';
import { StockQueryDto, StockAdjustDto, StockTransferDto } from '../dto/mat-stock.dto';
import { ResponseUtil } from '../../../common/dto/response.dto';

@ApiTags('자재관리 - 재고')
@Controller('material/stocks')
export class MatStockController {
  constructor(private readonly matStockService: MatStockService) {}

  @Get()
  @ApiOperation({ summary: '재고 목록 조회' })
  async findAll(@Query() query: StockQueryDto) {
    const result = await this.matStockService.findAll(query);
    return ResponseUtil.paged(result.data, result.total, result.page, result.limit);
  }

  @Get('available')
  @ApiOperation({ summary: '출고 가능 재고 조회 (IQC PASS만)' })
  async findAvailable(@Query() query: StockQueryDto) {
    const result = await this.matStockService.findAvailable(query);
    return ResponseUtil.paged(result.data, result.total, result.page, result.limit);
  }

  @Get('summary/:partId')
  @ApiOperation({ summary: '품목별 재고 요약' })
  @ApiParam({ name: 'partId', description: '품목 ID' })
  async getSummary(@Param('partId') partId: string) {
    const data = await this.matStockService.getStockSummary(partId);
    return ResponseUtil.success(data);
  }

  @Get('warehouse/:warehouseCode')
  @ApiOperation({ summary: '창고별 재고 조회' })
  async findByWarehouse(@Param('warehouseCode') warehouseCode: string, @Query() query: StockQueryDto) {
    const result = await this.matStockService.findAll({ ...query, warehouseCode });
    return ResponseUtil.paged(result.data, result.total, result.page, result.limit);
  }

  @Post('adjust')
  @ApiOperation({ summary: '재고 조정' })
  async adjust(@Body() dto: StockAdjustDto) {
    const data = await this.matStockService.adjustStock(dto);
    return ResponseUtil.success(data, '재고가 조정되었습니다.');
  }

  @Post('transfer')
  @ApiOperation({ summary: '재고 이동' })
  async transfer(@Body() dto: StockTransferDto) {
    const data = await this.matStockService.transferStock(dto);
    return ResponseUtil.success(data, '재고가 이동되었습니다.');
  }
}
