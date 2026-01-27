/**
 * @file src/modules/outsourcing/controllers/outsourcing.controller.ts
 * @description 외주관리 API 컨트롤러
 *
 * API 구조:
 * - GET  /outsourcing/vendors         : 외주처 목록
 * - GET  /outsourcing/vendors/:id     : 외주처 상세
 * - POST /outsourcing/vendors         : 외주처 등록
 * - PUT  /outsourcing/vendors/:id     : 외주처 수정
 * - DELETE /outsourcing/vendors/:id   : 외주처 삭제
 * - GET  /outsourcing/orders          : 외주발주 목록
 * - GET  /outsourcing/orders/:id      : 외주발주 상세
 * - POST /outsourcing/orders          : 외주발주 등록
 * - PUT  /outsourcing/orders/:id      : 외주발주 수정
 * - POST /outsourcing/orders/:id/cancel : 외주발주 취소
 * - POST /outsourcing/deliveries      : 외주 출고 등록
 * - POST /outsourcing/receives        : 외주 입고 등록
 * - GET  /outsourcing/summary         : 현황 요약
 * - GET  /outsourcing/vendor-stock    : 외주처별 재고
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
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
} from '@nestjs/swagger';
import { OutsourcingService } from '../services/outsourcing.service';
import {
  CreateVendorDto,
  UpdateVendorDto,
  VendorQueryDto,
  CreateSubconOrderDto,
  UpdateSubconOrderDto,
  SubconOrderQueryDto,
  CreateSubconDeliveryDto,
  CreateSubconReceiveDto,
} from '../dto/outsourcing.dto';
import { ResponseUtil } from '../../../common/dto/response.dto';

@ApiTags('외주관리')
@Controller('outsourcing')
export class OutsourcingController {
  constructor(private readonly outsourcingService: OutsourcingService) {}

  // ===== 외주처 마스터 =====

  @Get('vendors')
  @ApiOperation({ summary: '외주처 목록 조회' })
  @ApiResponse({ status: 200, description: '조회 성공' })
  async findAllVendors(@Query() query: VendorQueryDto) {
    const result = await this.outsourcingService.findAllVendors(query);
    return ResponseUtil.paged(result.data, result.total, result.page, result.limit);
  }

  @Get('vendors/:id')
  @ApiOperation({ summary: '외주처 상세 조회' })
  @ApiParam({ name: 'id', description: '외주처 ID' })
  @ApiResponse({ status: 200, description: '조회 성공' })
  async findVendorById(@Param('id') id: string) {
    const data = await this.outsourcingService.findVendorById(id);
    return ResponseUtil.success(data);
  }

  @Post('vendors')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '외주처 등록' })
  @ApiResponse({ status: 201, description: '등록 성공' })
  async createVendor(@Body() dto: CreateVendorDto) {
    const data = await this.outsourcingService.createVendor(dto);
    return ResponseUtil.success(data, '외주처가 등록되었습니다.');
  }

  @Put('vendors/:id')
  @ApiOperation({ summary: '외주처 수정' })
  @ApiParam({ name: 'id', description: '외주처 ID' })
  @ApiResponse({ status: 200, description: '수정 성공' })
  async updateVendor(@Param('id') id: string, @Body() dto: UpdateVendorDto) {
    const data = await this.outsourcingService.updateVendor(id, dto);
    return ResponseUtil.success(data, '외주처가 수정되었습니다.');
  }

  @Delete('vendors/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '외주처 삭제' })
  @ApiParam({ name: 'id', description: '외주처 ID' })
  @ApiResponse({ status: 200, description: '삭제 성공' })
  async deleteVendor(@Param('id') id: string) {
    await this.outsourcingService.deleteVendor(id);
    return ResponseUtil.success(null, '외주처가 삭제되었습니다.');
  }

  // ===== 외주발주 =====

  @Get('orders')
  @ApiOperation({ summary: '외주발주 목록 조회' })
  @ApiResponse({ status: 200, description: '조회 성공' })
  async findAllOrders(@Query() query: SubconOrderQueryDto) {
    const result = await this.outsourcingService.findAllOrders(query);
    return ResponseUtil.paged(result.data, result.total, result.page, result.limit);
  }

  @Get('orders/:id')
  @ApiOperation({ summary: '외주발주 상세 조회' })
  @ApiParam({ name: 'id', description: '외주발주 ID' })
  @ApiResponse({ status: 200, description: '조회 성공' })
  async findOrderById(@Param('id') id: string) {
    const data = await this.outsourcingService.findOrderById(id);
    return ResponseUtil.success(data);
  }

  @Post('orders')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '외주발주 등록' })
  @ApiResponse({ status: 201, description: '등록 성공' })
  async createOrder(@Body() dto: CreateSubconOrderDto) {
    const data = await this.outsourcingService.createOrder(dto);
    return ResponseUtil.success(data, '외주발주가 등록되었습니다.');
  }

  @Put('orders/:id')
  @ApiOperation({ summary: '외주발주 수정' })
  @ApiParam({ name: 'id', description: '외주발주 ID' })
  @ApiResponse({ status: 200, description: '수정 성공' })
  async updateOrder(@Param('id') id: string, @Body() dto: UpdateSubconOrderDto) {
    const data = await this.outsourcingService.updateOrder(id, dto);
    return ResponseUtil.success(data, '외주발주가 수정되었습니다.');
  }

  @Post('orders/:id/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '외주발주 취소' })
  @ApiParam({ name: 'id', description: '외주발주 ID' })
  @ApiResponse({ status: 200, description: '취소 성공' })
  async cancelOrder(@Param('id') id: string) {
    const data = await this.outsourcingService.cancelOrder(id);
    return ResponseUtil.success(data, '외주발주가 취소되었습니다.');
  }

  // ===== 외주 출고/입고 =====

  @Post('deliveries')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '외주 출고 등록' })
  @ApiResponse({ status: 201, description: '등록 성공' })
  async createDelivery(@Body() dto: CreateSubconDeliveryDto) {
    const data = await this.outsourcingService.createDelivery(dto);
    return ResponseUtil.success(data, '외주 출고가 등록되었습니다.');
  }

  @Get('deliveries/order/:orderId')
  @ApiOperation({ summary: '외주발주별 출고 이력' })
  @ApiParam({ name: 'orderId', description: '외주발주 ID' })
  @ApiResponse({ status: 200, description: '조회 성공' })
  async findDeliveriesByOrderId(@Param('orderId') orderId: string) {
    const data = await this.outsourcingService.findDeliveriesByOrderId(orderId);
    return ResponseUtil.success(data);
  }

  @Post('receives')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '외주 입고 등록' })
  @ApiResponse({ status: 201, description: '등록 성공' })
  async createReceive(@Body() dto: CreateSubconReceiveDto) {
    const data = await this.outsourcingService.createReceive(dto);
    return ResponseUtil.success(data, '외주 입고가 등록되었습니다.');
  }

  @Get('receives/order/:orderId')
  @ApiOperation({ summary: '외주발주별 입고 이력' })
  @ApiParam({ name: 'orderId', description: '외주발주 ID' })
  @ApiResponse({ status: 200, description: '조회 성공' })
  async findReceivesByOrderId(@Param('orderId') orderId: string) {
    const data = await this.outsourcingService.findReceivesByOrderId(orderId);
    return ResponseUtil.success(data);
  }

  // ===== 통계 =====

  @Get('summary')
  @ApiOperation({ summary: '외주관리 현황 요약' })
  @ApiResponse({ status: 200, description: '조회 성공' })
  async getSummary() {
    const data = await this.outsourcingService.getSummary();
    return ResponseUtil.success(data);
  }

  @Get('vendor-stock')
  @ApiOperation({ summary: '외주처별 재고 현황' })
  @ApiResponse({ status: 200, description: '조회 성공' })
  async getVendorStock() {
    const data = await this.outsourcingService.getVendorStock();
    return ResponseUtil.success(data);
  }
}
