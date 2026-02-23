/**
 * @file src/modules/equipment/controllers/pm-plan.controller.ts
 * @description PM 계획 및 Work Order API 컨트롤러
 *
 * 초보자 가이드:
 * 1. **PmPlanController**: /api/v1/equipment/pm-plans — PM 계획 CRUD
 * 2. **PmWorkOrderController**: /api/v1/equipment/pm-work-orders — WO 관리 + 캘린더
 *
 * API 경로:
 * - GET/POST /equipment/pm-plans — 계획 목록/생성
 * - GET/PUT/DELETE /equipment/pm-plans/:id — 계획 상세/수정/삭제
 * - GET /equipment/pm-work-orders/calendar — 캘린더 월별 요약
 * - GET /equipment/pm-work-orders/calendar/day — 일별 상세
 * - POST /equipment/pm-work-orders/generate — WO 일괄생성
 * - POST /equipment/pm-work-orders/:id/execute — WO 실행
 * - PATCH /equipment/pm-work-orders/:id/cancel — WO 취소
 */

import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Patch,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam, ApiResponse } from '@nestjs/swagger';
import { PmPlanService } from '../services/pm-plan.service';
import {
  CreatePmPlanDto,
  UpdatePmPlanDto,
  PmPlanQueryDto,
  CreatePmWorkOrderDto,
  ExecutePmWorkOrderDto,
  PmCalendarQueryDto,
  PmDayScheduleQueryDto,
  GenerateWorkOrdersDto,
  PmWorkOrderQueryDto,
} from '../dto/pm-plan.dto';
import { ResponseUtil } from '../../../common/dto/response.dto';

@ApiTags('설비관리 - PM 계획')
@Controller('equipment/pm-plans')
export class PmPlanController {
  constructor(private readonly pmPlanService: PmPlanService) {}

  @Get()
  @ApiOperation({ summary: 'PM 계획 목록 조회' })
  @ApiResponse({ status: 200, description: '조회 성공' })
  async findAll(@Query() query: PmPlanQueryDto) {
    const result = await this.pmPlanService.findAllPlans(query);
    return ResponseUtil.paged(result.data, result.total, result.page, result.limit);
  }

  @Get(':id')
  @ApiOperation({ summary: 'PM 계획 상세 조회' })
  @ApiParam({ name: 'id', description: 'PM 계획 ID' })
  async findById(@Param('id') id: string) {
    const data = await this.pmPlanService.findPlanById(id);
    return ResponseUtil.success(data);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'PM 계획 생성' })
  @ApiResponse({ status: 201, description: '생성 성공' })
  async create(@Body() dto: CreatePmPlanDto) {
    const data = await this.pmPlanService.createPlan(dto);
    return ResponseUtil.success(data, 'PM 계획이 등록되었습니다.');
  }

  @Put(':id')
  @ApiOperation({ summary: 'PM 계획 수정' })
  @ApiParam({ name: 'id', description: 'PM 계획 ID' })
  async update(@Param('id') id: string, @Body() dto: UpdatePmPlanDto) {
    const data = await this.pmPlanService.updatePlan(id, dto);
    return ResponseUtil.success(data, 'PM 계획이 수정되었습니다.');
  }

  @Delete(':id')
  @ApiOperation({ summary: 'PM 계획 삭제' })
  @ApiParam({ name: 'id', description: 'PM 계획 ID' })
  async delete(@Param('id') id: string) {
    await this.pmPlanService.deletePlan(id);
    return ResponseUtil.success(null, 'PM 계획이 삭제되었습니다.');
  }
}

@ApiTags('설비관리 - PM Work Order')
@Controller('equipment/pm-work-orders')
export class PmWorkOrderController {
  constructor(private readonly pmPlanService: PmPlanService) {}

  @Get('calendar')
  @ApiOperation({ summary: 'PM 캘린더 월별 요약' })
  @ApiResponse({ status: 200, description: '조회 성공' })
  async getCalendarSummary(@Query() query: PmCalendarQueryDto) {
    const data = await this.pmPlanService.getCalendarSummary(
      query.year, query.month, query.lineCode, query.equipType,
    );
    return ResponseUtil.success(data);
  }

  @Get('calendar/day')
  @ApiOperation({ summary: 'PM 캘린더 일별 상세' })
  @ApiResponse({ status: 200, description: '조회 성공' })
  async getDaySchedule(@Query() query: PmDayScheduleQueryDto) {
    const data = await this.pmPlanService.getDaySchedule(
      query.date, query.lineCode, query.equipType,
    );
    return ResponseUtil.success(data);
  }

  @Post('generate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'WO 일괄생성' })
  async generateWorkOrders(@Body() dto: GenerateWorkOrdersDto) {
    const data = await this.pmPlanService.generateWorkOrders(dto.year, dto.month);
    return ResponseUtil.success(data, `WO ${data.created}건 생성 (중복 스킵 ${data.skipped}건)`);
  }

  @Get()
  @ApiOperation({ summary: 'WO 목록 조회' })
  @ApiResponse({ status: 200, description: '조회 성공' })
  async findAll(@Query() query: PmWorkOrderQueryDto) {
    const result = await this.pmPlanService.findAllWorkOrders(query);
    return ResponseUtil.paged(result.data, result.total, result.page, result.limit);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'WO 수동생성' })
  @ApiResponse({ status: 201, description: '생성 성공' })
  async create(@Body() dto: CreatePmWorkOrderDto) {
    const data = await this.pmPlanService.createWorkOrder(dto);
    return ResponseUtil.success(data, 'Work Order가 생성되었습니다.');
  }

  @Post(':id/execute')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'WO 실행' })
  @ApiParam({ name: 'id', description: 'WO ID' })
  async execute(@Param('id') id: string, @Body() dto: ExecutePmWorkOrderDto) {
    const data = await this.pmPlanService.executeWorkOrder(id, dto);
    return ResponseUtil.success(data, 'Work Order가 완료되었습니다.');
  }

  @Patch(':id/cancel')
  @ApiOperation({ summary: 'WO 취소' })
  @ApiParam({ name: 'id', description: 'WO ID' })
  async cancel(@Param('id') id: string) {
    const data = await this.pmPlanService.cancelWorkOrder(id);
    return ResponseUtil.success(data, 'Work Order가 취소되었습니다.');
  }
}
