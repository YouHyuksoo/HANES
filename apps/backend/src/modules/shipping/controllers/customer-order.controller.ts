/**
 * @file src/modules/shipping/controllers/customer-order.controller.ts
 * @description 고객발주(Customer PO) CRUD API 컨트롤러
 *
 * 초보자 가이드:
 * 1. **엔드포인트**: /api/v1/shipping/customer-orders
 * 2. **CRUD**: 고객발주 등록/조회/수정/삭제
 *
 * API 경로:
 * - GET    /shipping/customer-orders       고객발주 목록 조회
 * - GET    /shipping/customer-orders/:id   고객발주 상세 조회
 * - POST   /shipping/customer-orders       고객발주 생성
 * - PUT    /shipping/customer-orders/:id   고객발주 수정
 * - DELETE /shipping/customer-orders/:id   고객발주 삭제
 */

import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Company, Plant } from '../../../common/decorators/tenant.decorator';
import { ApiTags, ApiOperation, ApiParam, ApiResponse } from '@nestjs/swagger';
import { CustomerOrderService } from '../services/customer-order.service';
import {
  CreateCustomerOrderDto,
  UpdateCustomerOrderDto,
  CustomerOrderQueryDto,
} from '../dto/customer-order.dto';
import { ResponseUtil } from '../../../common/dto/response.dto';

@ApiTags('출하관리 - 고객발주')
@Controller('shipping/customer-orders')
export class CustomerOrderController {
  constructor(private readonly customerOrderService: CustomerOrderService) {}

  @Get()
  @ApiOperation({ summary: '고객발주 목록 조회' })
  @ApiResponse({ status: 200, description: '조회 성공' })
  async findAll(@Query() query: CustomerOrderQueryDto, @Company() company: string, @Plant() plant: string) {
    const result = await this.customerOrderService.findAll(query, company, plant);
    return ResponseUtil.paged(result.data, result.total, result.page, result.limit);
  }

  @Get(':id')
  @ApiOperation({ summary: '고객발주 상세 조회' })
  @ApiParam({ name: 'id', description: '고객발주 ID' })
  async findById(@Param('id') id: string) {
    const data = await this.customerOrderService.findById(id);
    return ResponseUtil.success(data);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '고객발주 생성' })
  @ApiResponse({ status: 201, description: '생성 성공' })
  async create(@Body() dto: CreateCustomerOrderDto) {
    const data = await this.customerOrderService.create(dto);
    return ResponseUtil.success(data, '고객발주가 등록되었습니다.');
  }

  @Put(':id')
  @ApiOperation({ summary: '고객발주 수정' })
  @ApiParam({ name: 'id', description: '고객발주 ID' })
  async update(@Param('id') id: string, @Body() dto: UpdateCustomerOrderDto) {
    const data = await this.customerOrderService.update(id, dto);
    return ResponseUtil.success(data, '고객발주가 수정되었습니다.');
  }

  @Delete(':id')
  @ApiOperation({ summary: '고객발주 삭제' })
  @ApiParam({ name: 'id', description: '고객발주 ID' })
  async delete(@Param('id') id: string) {
    await this.customerOrderService.delete(id);
    return ResponseUtil.success(null, '고객발주가 삭제되었습니다.');
  }
}
