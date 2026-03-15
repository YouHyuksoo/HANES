/**
 * @file src/modules/equipment/controllers/periodic-inspect.controller.ts
 * @description 설비 정기점검 API 컨트롤러 (inspectType=PERIODIC 고정)
 *
 * 초보자 가이드:
 * 1. **엔드포인트**: /api/v1/equipment/periodic-inspect
 * 2. inspectType을 'PERIODIC'으로 고정하여 정기점검만 처리
 * 3. 복합키: equipCode + inspectType(PERIODIC) + inspectDate
 *
 * API 경로:
 * - GET    /equipment/periodic-inspect                         정기점검 목록 조회
 * - GET    /equipment/periodic-inspect/:equipCode/:inspectDate 정기점검 상세 조회
 * - POST   /equipment/periodic-inspect                         정기점검 등록
 * - PUT    /equipment/periodic-inspect/:equipCode/:inspectDate 정기점검 수정
 * - DELETE /equipment/periodic-inspect/:equipCode/:inspectDate 정기점검 삭제
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
import { ApiTags, ApiOperation, ApiParam, ApiResponse } from '@nestjs/swagger';
import { EquipInspectService } from '../services/equip-inspect.service';
import {
  CreateEquipInspectDto, UpdateEquipInspectDto, EquipInspectQueryDto,
  InspectCalendarQueryDto, InspectDayScheduleQueryDto,
} from '../dto/equip-inspect.dto';
import { ResponseUtil } from '../../../common/dto/response.dto';

@ApiTags('설비관리 - 정기점검')
@Controller('equipment/periodic-inspect')
export class PeriodicInspectController {
  constructor(private readonly equipInspectService: EquipInspectService) {}

  @Get('calendar')
  @ApiOperation({ summary: '정기점검 캘린더 월별 요약' })
  @ApiResponse({ status: 200, description: '조회 성공' })
  async getCalendarSummary(@Query() query: InspectCalendarQueryDto) {
    const data = await this.equipInspectService.getCalendarSummary(query.year, query.month, query.processCode, 'PERIODIC');
    return ResponseUtil.success(data);
  }

  @Get('calendar/day')
  @ApiOperation({ summary: '정기점검 캘린더 일별 스케줄' })
  @ApiResponse({ status: 200, description: '조회 성공' })
  async getDaySchedule(@Query() query: InspectDayScheduleQueryDto) {
    const data = await this.equipInspectService.getDaySchedule(query.date, query.processCode, 'PERIODIC');
    return ResponseUtil.success(data);
  }

  @Get()
  @ApiOperation({ summary: '정기점검 목록 조회' })
  @ApiResponse({ status: 200, description: '조회 성공' })
  async findAll(@Query() query: EquipInspectQueryDto) {
    const result = await this.equipInspectService.findAll({ ...query, inspectType: 'PERIODIC' });
    return ResponseUtil.paged(result.data, result.total, result.page, result.limit);
  }

  @Get(':equipCode/:inspectDate')
  @ApiOperation({ summary: '정기점검 상세 조회' })
  @ApiParam({ name: 'equipCode', description: '설비코드' })
  @ApiParam({ name: 'inspectDate', description: '점검일 (YYYY-MM-DD)' })
  async findByKey(
    @Param('equipCode') equipCode: string,
    @Param('inspectDate') inspectDate: string,
  ) {
    const data = await this.equipInspectService.findByKey(equipCode, 'PERIODIC', inspectDate);
    return ResponseUtil.success(data);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '정기점검 등록' })
  @ApiResponse({ status: 201, description: '등록 성공' })
  async create(@Body() dto: CreateEquipInspectDto) {
    const data = await this.equipInspectService.create({ ...dto, inspectType: 'PERIODIC' });
    return ResponseUtil.success(data, '정기점검이 등록되었습니다.');
  }

  @Put(':equipCode/:inspectDate')
  @ApiOperation({ summary: '정기점검 수정' })
  @ApiParam({ name: 'equipCode', description: '설비코드' })
  @ApiParam({ name: 'inspectDate', description: '점검일 (YYYY-MM-DD)' })
  async update(
    @Param('equipCode') equipCode: string,
    @Param('inspectDate') inspectDate: string,
    @Body() dto: UpdateEquipInspectDto,
  ) {
    const data = await this.equipInspectService.update(equipCode, 'PERIODIC', inspectDate, dto);
    return ResponseUtil.success(data, '정기점검이 수정되었습니다.');
  }

  @Delete(':equipCode/:inspectDate')
  @ApiOperation({ summary: '정기점검 삭제' })
  @ApiParam({ name: 'equipCode', description: '설비코드' })
  @ApiParam({ name: 'inspectDate', description: '점검일 (YYYY-MM-DD)' })
  async delete(
    @Param('equipCode') equipCode: string,
    @Param('inspectDate') inspectDate: string,
  ) {
    await this.equipInspectService.deleteByKey(equipCode, 'PERIODIC', inspectDate);
    return ResponseUtil.success(null, '정기점검이 삭제되었습니다.');
  }
}
