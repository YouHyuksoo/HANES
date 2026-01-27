/**
 * @file src/modules/equipment/controllers/equip-master.controller.ts
 * @description 설비마스터 CRUD API 컨트롤러
 *
 * 초보자 가이드:
 * 1. **기본 CRUD**: GET, POST, PUT, DELETE 엔드포인트
 * 2. **필터링**: 라인별, 유형별, 상태별 조회
 * 3. **상태 변경**: PATCH /status 엔드포인트
 *
 * API 경로:
 * - GET    /equipment/equips           설비 목록 조회
 * - GET    /equipment/equips/:id       설비 상세 조회
 * - POST   /equipment/equips           설비 생성
 * - PUT    /equipment/equips/:id       설비 수정
 * - DELETE /equipment/equips/:id       설비 삭제
 * - PATCH  /equipment/equips/:id/status 설비 상태 변경
 * - GET    /equipment/equips/line/:lineCode      라인별 설비 조회
 * - GET    /equipment/equips/type/:equipType     유형별 설비 조회
 * - GET    /equipment/equips/status/:status      상태별 설비 조회
 */

import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam, ApiResponse as SwaggerResponse } from '@nestjs/swagger';
import { EquipMasterService } from '../services/equip-master.service';
import {
  CreateEquipMasterDto,
  UpdateEquipMasterDto,
  EquipMasterQueryDto,
  ChangeEquipStatusDto,
} from '../dto/equip-master.dto';
import { EQUIP_TYPE_VALUES, EQUIP_STATUS_VALUES } from '@hanes/shared';
import { ResponseUtil } from '../../../common/dto/response.dto';

@ApiTags('설비관리 - 설비마스터')
@Controller('equipment/equips')
export class EquipMasterController {
  constructor(private readonly equipMasterService: EquipMasterService) {}

  // =============================================
  // 조회 API
  // =============================================

  @Get('stats')
  @ApiOperation({ summary: '설비 현황 통계' })
  @SwaggerResponse({ status: 200, description: '설비 현황 통계 조회 성공' })
  async getStats() {
    const data = await this.equipMasterService.getEquipmentStats();
    return ResponseUtil.success(data);
  }

  @Get('maintenance')
  @ApiOperation({ summary: '정비중/중지 설비 목록 조회' })
  @SwaggerResponse({ status: 200, description: '정비중/중지 설비 목록 조회 성공' })
  async getMaintenanceEquipments() {
    const data = await this.equipMasterService.getMaintenanceEquipments();
    return ResponseUtil.success(data);
  }

  @Get('line/:lineCode')
  @ApiOperation({ summary: '라인별 설비 목록 조회' })
  @ApiParam({ name: 'lineCode', description: '라인 코드', example: 'LINE-01' })
  async findByLineCode(@Param('lineCode') lineCode: string) {
    const data = await this.equipMasterService.findByLineCode(lineCode);
    return ResponseUtil.success(data);
  }

  @Get('type/:equipType')
  @ApiOperation({ summary: '설비 유형별 목록 조회' })
  @ApiParam({ name: 'equipType', description: '설비 유형', enum: EQUIP_TYPE_VALUES })
  async findByType(@Param('equipType') equipType: string) {
    const data = await this.equipMasterService.findByType(equipType);
    return ResponseUtil.success(data);
  }

  @Get('status/:status')
  @ApiOperation({ summary: '설비 상태별 목록 조회' })
  @ApiParam({ name: 'status', description: '설비 상태', enum: EQUIP_STATUS_VALUES })
  async findByStatus(@Param('status') status: string) {
    const data = await this.equipMasterService.findByStatus(status);
    return ResponseUtil.success(data);
  }

  @Get('code/:equipCode')
  @ApiOperation({ summary: '설비 코드로 조회' })
  @ApiParam({ name: 'equipCode', description: '설비 코드', example: 'EQ-001' })
  async findByCode(@Param('equipCode') equipCode: string) {
    const data = await this.equipMasterService.findByCode(equipCode);
    return ResponseUtil.success(data);
  }

  @Get()
  @ApiOperation({ summary: '설비 목록 조회' })
  @SwaggerResponse({ status: 200, description: '설비 목록 조회 성공' })
  async findAll(@Query() query: EquipMasterQueryDto) {
    const result = await this.equipMasterService.findAll(query);
    return ResponseUtil.paged(result.data, result.total, result.page, result.limit);
  }

  @Get(':id')
  @ApiOperation({ summary: '설비 상세 조회' })
  @ApiParam({ name: 'id', description: '설비 ID' })
  async findById(@Param('id') id: string) {
    const data = await this.equipMasterService.findById(id);
    return ResponseUtil.success(data);
  }

  // =============================================
  // 생성/수정/삭제 API
  // =============================================

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '설비 생성' })
  @SwaggerResponse({ status: 201, description: '설비 생성 성공' })
  @SwaggerResponse({ status: 409, description: '중복된 설비 코드' })
  async create(@Body() dto: CreateEquipMasterDto) {
    const data = await this.equipMasterService.create(dto);
    return ResponseUtil.success(data, '설비가 생성되었습니다.');
  }

  @Put(':id')
  @ApiOperation({ summary: '설비 수정' })
  @ApiParam({ name: 'id', description: '설비 ID' })
  @SwaggerResponse({ status: 200, description: '설비 수정 성공' })
  @SwaggerResponse({ status: 404, description: '설비를 찾을 수 없음' })
  async update(@Param('id') id: string, @Body() dto: UpdateEquipMasterDto) {
    const data = await this.equipMasterService.update(id, dto);
    return ResponseUtil.success(data, '설비가 수정되었습니다.');
  }

  @Delete(':id')
  @ApiOperation({ summary: '설비 삭제' })
  @ApiParam({ name: 'id', description: '설비 ID' })
  @SwaggerResponse({ status: 200, description: '설비 삭제 성공' })
  @SwaggerResponse({ status: 404, description: '설비를 찾을 수 없음' })
  async delete(@Param('id') id: string) {
    await this.equipMasterService.delete(id);
    return ResponseUtil.success(null, '설비가 삭제되었습니다.');
  }

  // =============================================
  // 상태 변경 API
  // =============================================

  @Patch(':id/status')
  @ApiOperation({ summary: '설비 상태 변경' })
  @ApiParam({ name: 'id', description: '설비 ID' })
  @SwaggerResponse({ status: 200, description: '설비 상태 변경 성공' })
  @SwaggerResponse({ status: 404, description: '설비를 찾을 수 없음' })
  async changeStatus(@Param('id') id: string, @Body() dto: ChangeEquipStatusDto) {
    const data = await this.equipMasterService.changeStatus(id, dto);
    return ResponseUtil.success(data, '설비 상태가 변경되었습니다.');
  }
}
