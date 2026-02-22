/**
 * @file src/modules/shipping/controllers/pallet.controller.ts
 * @description 팔레트 CRUD 및 상태 관리 API 컨트롤러
 *
 * 초보자 가이드:
 * 1. **엔드포인트**: /api/v1/shipping/pallets
 * 2. **Swagger**: @ApiTags, @ApiOperation 등으로 문서화
 * 3. **인증**: 필요시 @UseGuards(JwtAuthGuard) 적용
 *
 * API 구조:
 * - GET    /                    : 팔레트 목록 (페이지네이션)
 * - GET    /:id                 : 팔레트 단건 조회
 * - GET    /pallet-no/:palletNo : 팔레트번호로 조회
 * - POST   /                    : 팔레트 생성
 * - PUT    /:id                 : 팔레트 수정
 * - DELETE /:id                 : 팔레트 삭제
 * - POST   /:id/boxes           : 박스 추가
 * - DELETE /:id/boxes           : 박스 제거
 * - POST   /:id/close           : 팔레트 닫기
 * - POST   /:id/reopen          : 팔레트 다시 열기
 * - POST   /:id/assign-shipment : 출하 할당
 * - POST   /:id/remove-shipment : 출하에서 제거
 * - GET    /:id/summary         : 팔레트 요약
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
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
} from '@nestjs/swagger';
import { PalletService } from '../services/pallet.service';
import {
  CreatePalletDto,
  UpdatePalletDto,
  PalletQueryDto,
  AddBoxToPalletDto,
  RemoveBoxFromPalletDto,
  AssignPalletToShipmentDto,
} from '../dto/pallet.dto';
import { ResponseUtil } from '../../../common/dto/response.dto';

@ApiTags('출하관리 - 팔레트')
@Controller('shipping/pallets')
export class PalletController {
  constructor(private readonly palletService: PalletService) {}

  // ===== 기본 CRUD =====

  @Get()
  @ApiOperation({ summary: '팔레트 목록 조회', description: '페이지네이션 및 필터링 지원' })
  @ApiResponse({ status: 200, description: '조회 성공' })
  async findAll(@Query() query: PalletQueryDto, @Company() company: string, @Plant() plant: string) {
    const result = await this.palletService.findAll(query, company, plant);
    return ResponseUtil.paged(result.data, result.total, result.page, result.limit);
  }

  @Get('unassigned')
  @ApiOperation({ summary: '미할당 팔레트 목록', description: '출하에 할당되지 않은 CLOSED 상태 팔레트 목록' })
  @ApiResponse({ status: 200, description: '조회 성공' })
  async findUnassignedPallets() {
    const data = await this.palletService.findUnassignedPallets();
    return ResponseUtil.success(data);
  }

  @Get('pallet-no/:palletNo')
  @ApiOperation({ summary: '팔레트번호로 조회' })
  @ApiParam({ name: 'palletNo', description: '팔레트 번호', example: 'PLT-20250126-001' })
  @ApiResponse({ status: 200, description: '조회 성공' })
  @ApiResponse({ status: 404, description: '팔레트 없음' })
  async findByPalletNo(@Param('palletNo') palletNo: string) {
    const data = await this.palletService.findByPalletNo(palletNo);
    return ResponseUtil.success(data);
  }

  @Get('shipment/:shipmentId')
  @ApiOperation({ summary: '출하별 팔레트 목록 조회' })
  @ApiParam({ name: 'shipmentId', description: '출하 ID' })
  @ApiResponse({ status: 200, description: '조회 성공' })
  async findByShipmentId(@Param('shipmentId') shipmentId: string) {
    const data = await this.palletService.findByShipmentId(shipmentId);
    return ResponseUtil.success(data);
  }

  @Get(':id')
  @ApiOperation({ summary: '팔레트 상세 조회' })
  @ApiParam({ name: 'id', description: '팔레트 ID' })
  @ApiResponse({ status: 200, description: '조회 성공' })
  @ApiResponse({ status: 404, description: '팔레트 없음' })
  async findById(@Param('id') id: string) {
    const data = await this.palletService.findById(id);
    return ResponseUtil.success(data);
  }

  @Get(':id/summary')
  @ApiOperation({ summary: '팔레트 요약 정보', description: '팔레트 내 품목별 수량 집계 정보' })
  @ApiParam({ name: 'id', description: '팔레트 ID' })
  @ApiResponse({ status: 200, description: '조회 성공' })
  @ApiResponse({ status: 404, description: '팔레트 없음' })
  async getPalletSummary(@Param('id') id: string) {
    const data = await this.palletService.getPalletSummary(id);
    return ResponseUtil.success(data);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '팔레트 생성' })
  @ApiResponse({ status: 201, description: '생성 성공' })
  @ApiResponse({ status: 409, description: '중복 팔레트번호' })
  async create(@Body() dto: CreatePalletDto) {
    const data = await this.palletService.create(dto);
    return ResponseUtil.success(data, '팔레트가 생성되었습니다.');
  }

  @Put(':id')
  @ApiOperation({ summary: '팔레트 수정' })
  @ApiParam({ name: 'id', description: '팔레트 ID' })
  @ApiResponse({ status: 200, description: '수정 성공' })
  @ApiResponse({ status: 404, description: '팔레트 없음' })
  @ApiResponse({ status: 400, description: '수정 불가 상태' })
  async update(@Param('id') id: string, @Body() dto: UpdatePalletDto) {
    const data = await this.palletService.update(id, dto);
    return ResponseUtil.success(data, '팔레트가 수정되었습니다.');
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '팔레트 삭제' })
  @ApiParam({ name: 'id', description: '팔레트 ID' })
  @ApiResponse({ status: 200, description: '삭제 성공' })
  @ApiResponse({ status: 404, description: '팔레트 없음' })
  @ApiResponse({ status: 400, description: '삭제 불가 상태' })
  async delete(@Param('id') id: string) {
    await this.palletService.delete(id);
    return ResponseUtil.success(null, '팔레트가 삭제되었습니다.');
  }

  // ===== 박스 관리 =====

  @Post(':id/boxes')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '박스 추가', description: 'OPEN 상태 팔레트에 CLOSED 상태 박스 추가' })
  @ApiParam({ name: 'id', description: '팔레트 ID' })
  @ApiResponse({ status: 200, description: '추가 성공' })
  @ApiResponse({ status: 400, description: '상태 오류' })
  @ApiResponse({ status: 404, description: '박스 없음' })
  async addBox(@Param('id') id: string, @Body() dto: AddBoxToPalletDto) {
    const data = await this.palletService.addBox(id, dto);
    return ResponseUtil.success(data, '박스가 추가되었습니다.');
  }

  @Delete(':id/boxes')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '박스 제거', description: 'OPEN 상태 팔레트에서 박스 제거' })
  @ApiParam({ name: 'id', description: '팔레트 ID' })
  @ApiResponse({ status: 200, description: '제거 성공' })
  @ApiResponse({ status: 400, description: '상태 오류' })
  @ApiResponse({ status: 404, description: '박스 없음' })
  async removeBox(@Param('id') id: string, @Body() dto: RemoveBoxFromPalletDto) {
    const data = await this.palletService.removeBox(id, dto);
    return ResponseUtil.success(data, '박스가 제거되었습니다.');
  }

  // ===== 상태 관리 =====

  @Post(':id/close')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '팔레트 닫기', description: 'OPEN -> CLOSED 상태로 변경' })
  @ApiParam({ name: 'id', description: '팔레트 ID' })
  @ApiResponse({ status: 200, description: '닫기 성공' })
  @ApiResponse({ status: 400, description: '상태 변경 불가' })
  async closePallet(@Param('id') id: string) {
    const data = await this.palletService.closePallet(id);
    return ResponseUtil.success(data, '팔레트가 닫혔습니다.');
  }

  @Post(':id/reopen')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '팔레트 다시 열기', description: 'CLOSED -> OPEN 상태로 변경 (출하 미할당 시)' })
  @ApiParam({ name: 'id', description: '팔레트 ID' })
  @ApiResponse({ status: 200, description: '열기 성공' })
  @ApiResponse({ status: 400, description: '상태 변경 불가' })
  async reopenPallet(@Param('id') id: string) {
    const data = await this.palletService.reopenPallet(id);
    return ResponseUtil.success(data, '팔레트가 다시 열렸습니다.');
  }

  // ===== 출하 할당 =====

  @Post(':id/assign-shipment')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '출하 할당', description: 'CLOSED 상태 팔레트를 PREPARING 상태 출하에 할당' })
  @ApiParam({ name: 'id', description: '팔레트 ID' })
  @ApiResponse({ status: 200, description: '할당 성공' })
  @ApiResponse({ status: 400, description: '상태 오류' })
  @ApiResponse({ status: 404, description: '출하 없음' })
  async assignToShipment(@Param('id') id: string, @Body() dto: AssignPalletToShipmentDto) {
    const data = await this.palletService.assignToShipment(id, dto);
    return ResponseUtil.success(data, '팔레트가 출하에 할당되었습니다.');
  }

  @Post(':id/remove-shipment')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '출하에서 제거', description: 'PREPARING 상태 출하에서 팔레트 제거' })
  @ApiParam({ name: 'id', description: '팔레트 ID' })
  @ApiResponse({ status: 200, description: '제거 성공' })
  @ApiResponse({ status: 400, description: '상태 오류' })
  async removeFromShipment(@Param('id') id: string) {
    const data = await this.palletService.removeFromShipment(id);
    return ResponseUtil.success(data, '팔레트가 출하에서 제거되었습니다.');
  }
}
