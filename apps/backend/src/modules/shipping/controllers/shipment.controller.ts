/**
 * @file src/modules/shipping/controllers/shipment.controller.ts
 * @description 출하 CRUD 및 상태 관리 API 컨트롤러
 *
 * 초보자 가이드:
 * 1. **엔드포인트**: /api/v1/shipping/shipments
 * 2. **Swagger**: @ApiTags, @ApiOperation 등으로 문서화
 * 3. **인증**: 필요시 @UseGuards(JwtAuthGuard) 적용
 *
 * API 구조:
 * - GET    /                    : 출하 목록 (페이지네이션)
 * - GET    /:id                 : 출하 단건 조회
 * - GET    /ship-no/:shipNo     : 출하번호로 조회
 * - POST   /                    : 출하 생성
 * - PUT    /:id                 : 출하 수정
 * - DELETE /:id                 : 출하 삭제
 * - POST   /:id/pallets         : 팔레트 적재
 * - DELETE /:id/pallets         : 팔레트 하차
 * - POST   /:id/mark-loaded     : 적재완료 처리
 * - POST   /:id/mark-shipped    : 출하 처리
 * - POST   /:id/mark-delivered  : 배송완료 처리
 * - POST   /:id/cancel          : 출하 취소
 * - PUT    /:id/erp-sync        : ERP 동기화 플래그 변경
 * - GET    /erp/unsynced        : ERP 미동기화 목록
 * - GET    /:id/summary         : 출하 요약
 * - GET    /stats/daily         : 일자별 통계
 * - GET    /stats/customer      : 고객사별 통계
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
  ApiBody,
  ApiQuery,
} from '@nestjs/swagger';
import { ShipmentService } from '../services/shipment.service';
import {
  CreateShipmentDto,
  UpdateShipmentDto,
  ShipmentQueryDto,
  LoadPalletsDto,
  UnloadPalletsDto,
  ChangeShipmentStatusDto,
  UpdateErpSyncDto,
  ShipmentStatsQueryDto,
  SHIPMENT_STATUS,
} from '../dto/shipment.dto';
import { ResponseUtil } from '../../../common/dto/response.dto';

@ApiTags('출하관리 - 출하')
@Controller('shipping/shipments')
export class ShipmentController {
  constructor(private readonly shipmentService: ShipmentService) {}

  // ===== 기본 CRUD =====

  @Get()
  @ApiOperation({ summary: '출하 목록 조회', description: '페이지네이션 및 필터링 지원' })
  @ApiResponse({ status: 200, description: '조회 성공' })
  async findAll(@Query() query: ShipmentQueryDto) {
    const result = await this.shipmentService.findAll(query);
    return ResponseUtil.paged(result.data, result.total, result.page, result.limit);
  }

  @Get('erp/unsynced')
  @ApiOperation({ summary: 'ERP 미동기화 출하 목록', description: '출하 완료된 건 중 ERP에 동기화되지 않은 목록' })
  @ApiResponse({ status: 200, description: '조회 성공' })
  async findUnsyncedForErp() {
    const data = await this.shipmentService.findUnsyncedForErp();
    return ResponseUtil.success(data);
  }

  @Get('stats/daily')
  @ApiOperation({ summary: '일자별 출하 통계', description: '기간 내 일자별 출하 집계' })
  @ApiResponse({ status: 200, description: '조회 성공' })
  async getShipmentStats(@Query() query: ShipmentStatsQueryDto) {
    const data = await this.shipmentService.getShipmentStats(query);
    return ResponseUtil.success(data);
  }

  @Get('stats/customer')
  @ApiOperation({ summary: '고객사별 출하 통계', description: '기간 내 고객사별 출하 집계' })
  @ApiQuery({ name: 'startDate', required: true, description: '시작일 (YYYY-MM-DD)' })
  @ApiQuery({ name: 'endDate', required: true, description: '종료일 (YYYY-MM-DD)' })
  @ApiResponse({ status: 200, description: '조회 성공' })
  async getCustomerStats(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    const data = await this.shipmentService.getCustomerStats(startDate, endDate);
    return ResponseUtil.success(data);
  }

  @Get('ship-no/:shipNo')
  @ApiOperation({ summary: '출하번호로 조회' })
  @ApiParam({ name: 'shipNo', description: '출하 번호', example: 'SHP-20250126-001' })
  @ApiResponse({ status: 200, description: '조회 성공' })
  @ApiResponse({ status: 404, description: '출하 없음' })
  async findByShipNo(@Param('shipNo') shipNo: string) {
    const data = await this.shipmentService.findByShipNo(shipNo);
    return ResponseUtil.success(data);
  }

  @Get(':id')
  @ApiOperation({ summary: '출하 상세 조회' })
  @ApiParam({ name: 'id', description: '출하 ID' })
  @ApiResponse({ status: 200, description: '조회 성공' })
  @ApiResponse({ status: 404, description: '출하 없음' })
  async findById(@Param('id') id: string) {
    const data = await this.shipmentService.findById(id);
    return ResponseUtil.success(data);
  }

  @Get(':id/summary')
  @ApiOperation({ summary: '출하 요약 정보', description: '출하 내 품목별 수량 집계 정보' })
  @ApiParam({ name: 'id', description: '출하 ID' })
  @ApiResponse({ status: 200, description: '조회 성공' })
  @ApiResponse({ status: 404, description: '출하 없음' })
  async getShipmentSummary(@Param('id') id: string) {
    const data = await this.shipmentService.getShipmentSummary(id);
    return ResponseUtil.success(data);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '출하 생성' })
  @ApiResponse({ status: 201, description: '생성 성공' })
  @ApiResponse({ status: 409, description: '중복 출하번호' })
  async create(@Body() dto: CreateShipmentDto) {
    const data = await this.shipmentService.create(dto);
    return ResponseUtil.success(data, '출하가 생성되었습니다.');
  }

  @Put(':id')
  @ApiOperation({ summary: '출하 수정' })
  @ApiParam({ name: 'id', description: '출하 ID' })
  @ApiResponse({ status: 200, description: '수정 성공' })
  @ApiResponse({ status: 404, description: '출하 없음' })
  @ApiResponse({ status: 400, description: '수정 불가 상태' })
  async update(@Param('id') id: string, @Body() dto: UpdateShipmentDto) {
    const data = await this.shipmentService.update(id, dto);
    return ResponseUtil.success(data, '출하가 수정되었습니다.');
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '출하 삭제' })
  @ApiParam({ name: 'id', description: '출하 ID' })
  @ApiResponse({ status: 200, description: '삭제 성공' })
  @ApiResponse({ status: 404, description: '출하 없음' })
  @ApiResponse({ status: 400, description: '삭제 불가 상태' })
  async delete(@Param('id') id: string) {
    await this.shipmentService.delete(id);
    return ResponseUtil.success(null, '출하가 삭제되었습니다.');
  }

  // ===== 팔레트 관리 =====

  @Post(':id/pallets')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '팔레트 적재', description: 'PREPARING 상태 출하에 CLOSED 상태 팔레트 적재' })
  @ApiParam({ name: 'id', description: '출하 ID' })
  @ApiResponse({ status: 200, description: '적재 성공' })
  @ApiResponse({ status: 400, description: '상태 오류' })
  @ApiResponse({ status: 404, description: '팔레트 없음' })
  async loadPallets(@Param('id') id: string, @Body() dto: LoadPalletsDto) {
    const data = await this.shipmentService.loadPallets(id, dto);
    return ResponseUtil.success(data, '팔레트가 적재되었습니다.');
  }

  @Delete(':id/pallets')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '팔레트 하차', description: 'PREPARING 상태 출하에서 팔레트 하차' })
  @ApiParam({ name: 'id', description: '출하 ID' })
  @ApiResponse({ status: 200, description: '하차 성공' })
  @ApiResponse({ status: 400, description: '상태 오류' })
  @ApiResponse({ status: 404, description: '팔레트 없음' })
  async unloadPallets(@Param('id') id: string, @Body() dto: UnloadPalletsDto) {
    const data = await this.shipmentService.unloadPallets(id, dto);
    return ResponseUtil.success(data, '팔레트가 하차되었습니다.');
  }

  // ===== 상태 관리 =====

  @Post(':id/mark-loaded')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '적재완료 처리', description: 'PREPARING -> LOADED 상태로 변경' })
  @ApiParam({ name: 'id', description: '출하 ID' })
  @ApiResponse({ status: 200, description: '적재완료 성공' })
  @ApiResponse({ status: 400, description: '상태 변경 불가' })
  async markAsLoaded(@Param('id') id: string) {
    const data = await this.shipmentService.markAsLoaded(id);
    return ResponseUtil.success(data, '적재가 완료되었습니다.');
  }

  @Post(':id/mark-shipped')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '출하 처리', description: 'LOADED -> SHIPPED 상태로 변경, 팔레트/박스 상태도 함께 변경' })
  @ApiParam({ name: 'id', description: '출하 ID' })
  @ApiResponse({ status: 200, description: '출하 성공' })
  @ApiResponse({ status: 400, description: '상태 변경 불가' })
  async markAsShipped(@Param('id') id: string) {
    const data = await this.shipmentService.markAsShipped(id);
    return ResponseUtil.success(data, '출하되었습니다.');
  }

  @Post(':id/mark-delivered')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '배송완료 처리', description: 'SHIPPED -> DELIVERED 상태로 변경' })
  @ApiParam({ name: 'id', description: '출하 ID' })
  @ApiResponse({ status: 200, description: '배송완료 성공' })
  @ApiResponse({ status: 400, description: '상태 변경 불가' })
  async markAsDelivered(@Param('id') id: string) {
    const data = await this.shipmentService.markAsDelivered(id);
    return ResponseUtil.success(data, '배송이 완료되었습니다.');
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '출하 취소', description: 'PREPARING/LOADED -> CANCELED 상태로 변경, 팔레트 할당 해제' })
  @ApiParam({ name: 'id', description: '출하 ID' })
  @ApiBody({ schema: { type: 'object', properties: { remark: { type: 'string', description: '취소 사유' } } } })
  @ApiResponse({ status: 200, description: '취소 성공' })
  @ApiResponse({ status: 400, description: '상태 변경 불가' })
  async cancel(@Param('id') id: string, @Body('remark') remark?: string) {
    const data = await this.shipmentService.cancel(id, remark);
    return ResponseUtil.success(data, '출하가 취소되었습니다.');
  }

  @Put(':id/status')
  @ApiOperation({ summary: '상태 직접 변경 (관리자용)', description: '상태를 직접 변경 (주의: 워크플로우 무시)' })
  @ApiParam({ name: 'id', description: '출하 ID' })
  @ApiResponse({ status: 200, description: '변경 성공' })
  async changeStatus(@Param('id') id: string, @Body() dto: ChangeShipmentStatusDto) {
    const data = await this.shipmentService.changeStatus(id, dto);
    return ResponseUtil.success(data, '상태가 변경되었습니다.');
  }

  // ===== ERP 연동 =====

  @Put(':id/erp-sync')
  @ApiOperation({ summary: 'ERP 동기화 플래그 변경' })
  @ApiParam({ name: 'id', description: '출하 ID' })
  @ApiResponse({ status: 200, description: '변경 성공' })
  async updateErpSyncYn(@Param('id') id: string, @Body() dto: UpdateErpSyncDto) {
    const data = await this.shipmentService.updateErpSyncYn(id, dto);
    return ResponseUtil.success(data, 'ERP 동기화 상태가 변경되었습니다.');
  }

  @Post('erp/mark-synced')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'ERP 동기화 완료 처리 (일괄)', description: '여러 출하를 동기화 완료 처리' })
  @ApiBody({ schema: { type: 'object', properties: { ids: { type: 'array', items: { type: 'string' } } } } })
  @ApiResponse({ status: 200, description: '처리 성공' })
  async markAsSynced(@Body('ids') ids: string[]) {
    const result = await this.shipmentService.markAsSynced(ids);
    return ResponseUtil.success(result, `${result.count}건의 출하가 동기화 완료 처리되었습니다.`);
  }
}
