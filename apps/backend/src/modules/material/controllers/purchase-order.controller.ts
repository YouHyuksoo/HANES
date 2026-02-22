/**
 * @file src/modules/material/controllers/purchase-order.controller.ts
 * @description 구매발주(PO) CRUD API 컨트롤러
 */

import { Controller, Get, Post, Put, Delete, Body, Param, Query, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { PurchaseOrderService } from '../services/purchase-order.service';
import { CreatePurchaseOrderDto, UpdatePurchaseOrderDto, PurchaseOrderQueryDto } from '../dto/purchase-order.dto';
import { ResponseUtil } from '../../../common/dto/response.dto';
import { Company, Plant } from '../../../common/decorators/tenant.decorator';

@ApiTags('자재관리 - PO관리')
@Controller('material/purchase-orders')
export class PurchaseOrderController {
  constructor(private readonly purchaseOrderService: PurchaseOrderService) {}

  @Get()
  @ApiOperation({ summary: 'PO 목록 조회' })
  async findAll(@Query() query: PurchaseOrderQueryDto, @Company() company: string, @Plant() plant: string) {
    const result = await this.purchaseOrderService.findAll(query, company, plant);
    return ResponseUtil.paged(result.data, result.total, result.page, result.limit);
  }

  @Get(':id')
  @ApiOperation({ summary: 'PO 상세 조회' })
  async findById(@Param('id') id: string) {
    const data = await this.purchaseOrderService.findById(id);
    return ResponseUtil.success(data);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'PO 생성' })
  async create(@Body() dto: CreatePurchaseOrderDto) {
    const data = await this.purchaseOrderService.create(dto);
    return ResponseUtil.success(data, 'PO가 생성되었습니다.');
  }

  @Put(':id')
  @ApiOperation({ summary: 'PO 수정' })
  async update(@Param('id') id: string, @Body() dto: UpdatePurchaseOrderDto) {
    const data = await this.purchaseOrderService.update(id, dto);
    return ResponseUtil.success(data, 'PO가 수정되었습니다.');
  }

  @Delete(':id')
  @ApiOperation({ summary: 'PO 삭제' })
  async delete(@Param('id') id: string) {
    await this.purchaseOrderService.delete(id);
    return ResponseUtil.success(null, 'PO가 삭제되었습니다.');
  }
}
