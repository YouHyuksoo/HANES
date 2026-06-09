/**
 * @file src/modules/shipping/controllers/box-stock.controller.ts
 * @description 박스입고재고조회 API - 제품재고(시리얼=FG_LABELS) 기준 박스별 재고
 *
 * - GET /shipping/box-stock              : 박스별 재고 집계 (왼쪽 그리드)
 * - GET /shipping/box-stock/:boxNo/serials : 박스 내 재고 시리얼 (오른쪽 그리드)
 *
 * 재고 정의: FG_LABELS.BOX_NO 부여(입고됨) + STATUS <> 'SHIPPED'(미출하)
 */
import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam, ApiResponse } from '@nestjs/swagger';
import { Company, Plant } from '../../../common/decorators/tenant.decorator';
import { BoxService } from '../services/box.service';
import { ResponseUtil } from '../../../common/dto/response.dto';

@ApiTags('출하관리 - 박스재고')
@Controller('shipping/box-stock')
export class BoxStockController {
  constructor(private readonly boxService: BoxService) {}

  @Get()
  @ApiOperation({ summary: '박스별 제품재고 집계', description: '입고되어 미출하 상태인 시리얼을 박스별로 집계' })
  @ApiResponse({ status: 200, description: '조회 성공' })
  async findStockByBox(
    @Query('boxNo') boxNo: string | undefined,
    @Company() company: string,
    @Plant() plant: string,
  ) {
    const data = await this.boxService.findStockByBox(boxNo, company, plant);
    return ResponseUtil.success(data);
  }

  @Get(':boxNo/serials')
  @ApiOperation({ summary: '박스 내 재고 시리얼 목록' })
  @ApiParam({ name: 'boxNo', description: '박스 번호' })
  @ApiResponse({ status: 200, description: '조회 성공' })
  async findStockSerials(
    @Param('boxNo') boxNo: string,
    @Company() company: string,
    @Plant() plant: string,
  ) {
    const data = await this.boxService.findStockSerials(boxNo, company, plant);
    return ResponseUtil.success(data);
  }
}
