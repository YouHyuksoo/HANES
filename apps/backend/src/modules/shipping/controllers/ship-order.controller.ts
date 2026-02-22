/**
 * @file src/modules/shipping/controllers/ship-order.controller.ts
 * @description 출하지시 CRUD API 컨트롤러
 *
 * 초보자 가이드:
 * 1. **엔드포인트**: /api/v1/shipping/orders
 * 2. **CRUD**: 출하지시 등록/조회/수정/삭제
 *
 * API 경로:
 * - GET    /shipping/orders       출하지시 목록 조회
 * - GET    /shipping/orders/:id   출하지시 상세 조회
 * - POST   /shipping/orders       출하지시 생성
 * - PUT    /shipping/orders/:id   출하지시 수정
 * - DELETE /shipping/orders/:id   출하지시 삭제
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
import { ShipOrderService } from '../services/ship-order.service';
import { CreateShipOrderDto, UpdateShipOrderDto, ShipOrderQueryDto } from '../dto/ship-order.dto';
import { ResponseUtil } from '../../../common/dto/response.dto';

@ApiTags('출하관리 - 출하지시')
@Controller('shipping/orders')
export class ShipOrderController {
  constructor(private readonly shipOrderService: ShipOrderService) {}

  @Get()
  @ApiOperation({ summary: '출하지시 목록 조회' })
  @ApiResponse({ status: 200, description: '조회 성공' })
  async findAll(@Query() query: ShipOrderQueryDto, @Company() company: string, @Plant() plant: string) {
    const result = await this.shipOrderService.findAll(query, company, plant);
    return ResponseUtil.paged(result.data, result.total, result.page, result.limit);
  }

  @Get(':id')
  @ApiOperation({ summary: '출하지시 상세 조회' })
  @ApiParam({ name: 'id', description: '출하지시 ID' })
  async findById(@Param('id') id: string) {
    const data = await this.shipOrderService.findById(id);
    return ResponseUtil.success(data);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '출하지시 생성' })
  @ApiResponse({ status: 201, description: '생성 성공' })
  async create(@Body() dto: CreateShipOrderDto) {
    const data = await this.shipOrderService.create(dto);
    return ResponseUtil.success(data, '출하지시가 생성되었습니다.');
  }

  @Put(':id')
  @ApiOperation({ summary: '출하지시 수정' })
  @ApiParam({ name: 'id', description: '출하지시 ID' })
  async update(@Param('id') id: string, @Body() dto: UpdateShipOrderDto) {
    const data = await this.shipOrderService.update(id, dto);
    return ResponseUtil.success(data, '출하지시가 수정되었습니다.');
  }

  @Delete(':id')
  @ApiOperation({ summary: '출하지시 삭제' })
  @ApiParam({ name: 'id', description: '출하지시 ID' })
  async delete(@Param('id') id: string) {
    await this.shipOrderService.delete(id);
    return ResponseUtil.success(null, '출하지시가 삭제되었습니다.');
  }
}
