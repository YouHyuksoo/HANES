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
 * - PUT    /shipping/orders/:id/unconfirm 출하지시 확정취소
 * - POST   /shipping/orders/:id/cancel-ship-box  박스 단건 출하 취소
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
  UseGuards,
} from '@nestjs/common';
import { Company, Plant } from '../../../common/decorators/tenant.decorator';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { ApiTags, ApiOperation, ApiParam, ApiResponse } from '@nestjs/swagger';
import { ShipOrderService } from '../services/ship-order.service';
import {
  CreateShipOrderDto,
  UpdateShipOrderDto,
  ShipOrderQueryDto,
  CreateShipOrderPalletDto,
  ShipOrderPalletsDto,
} from '../dto/ship-order.dto';
import { ShipBoxDto } from '../dto/ship-box.dto';
import { AddBoxToPalletDto, RemoveBoxFromPalletDto } from '../dto/pallet.dto';
import { CancelOrderShipmentDto } from '../dto/cancel-shipment.dto';
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

  @Get('shipped')
  @ApiOperation({ summary: '출하분이 있는 출하지시 통합 이력(박스+팔레트)' })
  async findShipped(@Company() company: string, @Plant() plant: string) {
    const result = await this.shipOrderService.findShippedOrders(company, plant);
    return ResponseUtil.success(result.data);
  }

  @Get(':id')
  @ApiOperation({ summary: '출하지시 상세 조회' })
  @ApiParam({ name: 'id', description: '출하지시 ID' })
  async findById(@Param('id') id: string, @Company() company: string, @Plant() plant: string) {
    const data = await this.shipOrderService.findById(id, company, plant);
    return ResponseUtil.success(data);
  }

  @Get(':id/shipped-detail')
  @ApiOperation({ summary: '출하지시 출하 상세(팔레트/박스, 박스출하는 *)' })
  @ApiParam({ name: 'id', description: '출하지시 번호' })
  async getShippedDetail(@Param('id') id: string, @Company() company: string, @Plant() plant: string) {
    const data = await this.shipOrderService.getShippedDetail(id, company, plant);
    return ResponseUtil.success(data);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '출하지시 생성' })
  @ApiResponse({ status: 201, description: '생성 성공' })
  async create(@Body() dto: CreateShipOrderDto, @Company() company: string, @Plant() plant: string) {
    const data = await this.shipOrderService.create(dto, company, plant);
    return ResponseUtil.success(data, '출하지시가 생성되었습니다.');
  }

  @Put(':id')
  @ApiOperation({ summary: '출하지시 수정' })
  @ApiParam({ name: 'id', description: '출하지시 ID' })
  async update(@Param('id') id: string, @Body() dto: UpdateShipOrderDto, @Company() company: string, @Plant() plant: string) {
    const data = await this.shipOrderService.update(id, dto, company, plant);
    return ResponseUtil.success(data, '출하지시가 수정되었습니다.');
  }

  @Delete(':id')
  @ApiOperation({ summary: '출하지시 삭제' })
  @ApiParam({ name: 'id', description: '출하지시 ID' })
  async delete(@Param('id') id: string, @Company() company: string, @Plant() plant: string) {
    await this.shipOrderService.delete(id, company, plant);
    return ResponseUtil.success(null, '출하지시가 삭제되었습니다.');
  }

  @Put(':id/confirm')
  @ApiOperation({ summary: '출하지시 확정 (DRAFT → CONFIRMED)' })
  @ApiParam({ name: 'id', description: '출하지시 번호' })
  async confirm(@Param('id') id: string, @Company() company: string, @Plant() plant: string) {
    const data = await this.shipOrderService.confirm(id, company, plant);
    return ResponseUtil.success(data, '출하지시가 확정되었습니다.');
  }

  @Put(':id/unconfirm')
  @ApiOperation({ summary: '출하지시 확정취소 (CONFIRMED → DRAFT)' })
  @ApiParam({ name: 'id', description: '출하지시 번호' })
  async unconfirm(@Param('id') id: string, @Company() company: string, @Plant() plant: string) {
    const data = await this.shipOrderService.unconfirm(id, company, plant);
    return ResponseUtil.success(data, '출하지시 확정이 취소되었습니다.');
  }

  @Get(':id/fulfillment')
  @ApiOperation({ summary: '출하지시 중심 출하작업 현황' })
  @ApiParam({ name: 'id', description: '출하지시 번호' })
  async getFulfillment(@Param('id') id: string, @Company() company: string, @Plant() plant: string) {
    const data = await this.shipOrderService.getFulfillment(id, company, plant);
    return ResponseUtil.success(data);
  }

  @Post(':id/pallets')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '출하지시 팔레트 생성' })
  @ApiParam({ name: 'id', description: '출하지시 번호' })
  async createOrderPallet(
    @Param('id') id: string,
    @Body() dto: CreateShipOrderPalletDto,
    @Company() company: string,
    @Plant() plant: string,
  ) {
    const data = await this.shipOrderService.createPalletForOrder(id, dto, company, plant);
    return ResponseUtil.success(data, '출하지시 팔레트가 생성되었습니다.');
  }

  @Post(':id/pallets/:palletNo/boxes')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '출하지시 팔레트 박스 적재' })
  async addBoxesToOrderPallet(
    @Param('id') id: string,
    @Param('palletNo') palletNo: string,
    @Body() dto: AddBoxToPalletDto,
    @Company() company: string,
    @Plant() plant: string,
  ) {
    const data = await this.shipOrderService.addBoxesToOrderPallet(id, palletNo, dto, company, plant);
    return ResponseUtil.success(data, '박스가 출하지시 팔레트에 적재되었습니다.');
  }

  @Delete(':id/pallets/:palletNo/boxes')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '출하지시 팔레트 박스 제거' })
  async removeBoxesFromOrderPallet(
    @Param('id') id: string,
    @Param('palletNo') palletNo: string,
    @Body() dto: RemoveBoxFromPalletDto,
    @Company() company: string,
    @Plant() plant: string,
  ) {
    const data = await this.shipOrderService.removeBoxesFromOrderPallet(id, palletNo, dto, company, plant);
    return ResponseUtil.success(data, '박스가 출하지시 팔레트에서 제거되었습니다.');
  }

  @Post(':id/pallets/:palletNo/close')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '팔레트 라벨 발행 완료' })
  async closeOrderPallet(
    @Param('id') id: string,
    @Param('palletNo') palletNo: string,
    @Company() company: string,
    @Plant() plant: string,
  ) {
    const data = await this.shipOrderService.closeOrderPallet(id, palletNo, company, plant);
    return ResponseUtil.success(data, '팔레트 라벨 발행이 완료되었습니다.');
  }

  @Post(':id/ship-pallets')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '출하지시 팔레트 바코드 제품출하 확정' })
  async shipOrderPallets(
    @Param('id') id: string,
    @Body() dto: ShipOrderPalletsDto,
    @Company() company: string,
    @Plant() plant: string,
  ) {
    const data = await this.shipOrderService.shipOrderPallets(id, dto, company, plant);
    return ResponseUtil.success(data, '제품출하가 확정되었습니다.');
  }

  @Post(':id/ship-box')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '박스 단건 출하 (출하지시 기반)', description: '박스를 스캔해 즉시 출하 처리(SHIPPED + FG_MAIN 차감 + shippedQty 갱신)' })
  @ApiParam({ name: 'id', description: '출하지시 번호' })
  async shipBox(@Param('id') id: string, @Body() dto: ShipBoxDto, @Company() company: string, @Plant() plant: string) {
    const data = await this.shipOrderService.shipBox(id, dto, company, plant);
    return ResponseUtil.success(data, '박스가 출하되었습니다.');
  }

  @Post(':id/cancel-ship-box')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '박스 단건 출하 취소', description: '출하된 박스를 출하 직전 상태(CLOSED/PACKED)로 되돌리고 제품재고를 복원한다.' })
  @ApiParam({ name: 'id', description: '출하지시 번호' })
  async cancelShipBox(@Param('id') id: string, @Body() dto: ShipBoxDto, @Company() company: string, @Plant() plant: string) {
    const data = await this.shipOrderService.cancelShipBox(id, dto, company, plant);
    return ResponseUtil.success(data, '박스 출하가 취소되었습니다.');
  }

  @Post(':id/cancel-shipment')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '출하지시 단위 출하취소(상태전이+재고복원+취소이력)' })
  @ApiParam({ name: 'id', description: '출하지시 번호' })
  async cancelOrderShipment(
    @Param('id') id: string,
    @Body() dto: CancelOrderShipmentDto,
    @Company() company: string,
    @Plant() plant: string,
  ) {
    const data = await this.shipOrderService.cancelOrderShipment(id, dto, company, plant);
    return ResponseUtil.success(data, '출하가 취소되었습니다.');
  }
}
