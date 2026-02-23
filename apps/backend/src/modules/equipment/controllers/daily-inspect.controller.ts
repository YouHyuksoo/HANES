/**
 * @file src/modules/equipment/controllers/daily-inspect.controller.ts
 * @description 설비 일상점검 API 컨트롤러 (inspectType=DAILY 고정)
 *
 * 초보자 가이드:
 * 1. **엔드포인트**: /api/v1/equipment/daily-inspect
 * 2. inspectType을 'DAILY'로 고정하여 일상점검만 처리
 *
 * API 경로:
 * - GET    /equipment/daily-inspect       일상점검 목록 조회
 * - GET    /equipment/daily-inspect/:id   일상점검 상세 조회
 * - POST   /equipment/daily-inspect       일상점검 등록
 * - PUT    /equipment/daily-inspect/:id   일상점검 수정
 * - DELETE /equipment/daily-inspect/:id   일상점검 삭제
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
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Request } from 'express';
import { ApiTags, ApiOperation, ApiParam, ApiResponse } from '@nestjs/swagger';
import { EquipInspectService } from '../services/equip-inspect.service';
import {
  CreateEquipInspectDto, UpdateEquipInspectDto, EquipInspectQueryDto,
  InspectCalendarQueryDto, InspectDayScheduleQueryDto,
} from '../dto/equip-inspect.dto';
import { ResponseUtil } from '../../../common/dto/response.dto';

@ApiTags('설비관리 - 일상점검')
@Controller('equipment/daily-inspect')
export class DailyInspectController {
  constructor(private readonly equipInspectService: EquipInspectService) {}

  @Get('calendar')
  @ApiOperation({ summary: '일상점검 캘린더 월별 요약' })
  @ApiResponse({ status: 200, description: '조회 성공' })
  async getCalendarSummary(@Query() query: InspectCalendarQueryDto) {
    const data = await this.equipInspectService.getCalendarSummary(query.year, query.month, query.lineCode);
    return ResponseUtil.success(data);
  }

  @Get('calendar/day')
  @ApiOperation({ summary: '일상점검 캘린더 일별 스케줄' })
  @ApiResponse({ status: 200, description: '조회 성공' })
  async getDaySchedule(@Query() query: InspectDayScheduleQueryDto) {
    const data = await this.equipInspectService.getDaySchedule(query.date, query.lineCode);
    return ResponseUtil.success(data);
  }

  @Get()
  @ApiOperation({ summary: '일상점검 목록 조회' })
  @ApiResponse({ status: 200, description: '조회 성공' })
  async findAll(@Query() query: EquipInspectQueryDto) {
    const result = await this.equipInspectService.findAll({ ...query, inspectType: 'DAILY' });
    return ResponseUtil.paged(result.data, result.total, result.page, result.limit);
  }

  @Get(':id')
  @ApiOperation({ summary: '일상점검 상세 조회' })
  @ApiParam({ name: 'id', description: '점검 ID' })
  async findById(@Param('id') id: string) {
    const data = await this.equipInspectService.findById(id);
    return ResponseUtil.success(data);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '일상점검 등록' })
  @ApiResponse({ status: 201, description: '등록 성공' })
  async create(@Body() dto: CreateEquipInspectDto, @Req() req: Request) {
    const company = (req.headers['x-company'] as string) || '';
    const plant = (req.headers['x-plant'] as string) || '';
    const data = await this.equipInspectService.create(
      { ...dto, inspectType: 'DAILY' },
      { company, plant },
    );
    return ResponseUtil.success(data, '일상점검이 등록되었습니다.');
  }

  @Put(':id')
  @ApiOperation({ summary: '일상점검 수정' })
  @ApiParam({ name: 'id', description: '점검 ID' })
  async update(@Param('id') id: string, @Body() dto: UpdateEquipInspectDto) {
    const data = await this.equipInspectService.update(id, dto);
    return ResponseUtil.success(data, '일상점검이 수정되었습니다.');
  }

  @Delete(':id')
  @ApiOperation({ summary: '일상점검 삭제' })
  @ApiParam({ name: 'id', description: '점검 ID' })
  async delete(@Param('id') id: string) {
    await this.equipInspectService.delete(id);
    return ResponseUtil.success(null, '일상점검이 삭제되었습니다.');
  }
}
