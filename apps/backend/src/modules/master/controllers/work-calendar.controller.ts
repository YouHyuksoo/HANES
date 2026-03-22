/**
 * @file src/modules/master/controllers/work-calendar.controller.ts
 * @description 생산월력(Work Calendar) API 컨트롤러
 *
 * 초보자 가이드:
 * 1. GET/POST/PUT/DELETE /master/work-calendars       — 캘린더 CRUD
 * 2. POST /:id/generate                               — 연간 일정 자동 생성
 * 3. POST /:id/copy-from/:sourceId                    — 다른 캘린더에서 복사
 * 4. GET/PUT  /:id/days, /:id/days/bulk               — 일별 근무 조회/일괄 수정
 * 5. POST /:id/confirm, /:id/unconfirm                — 확정/취소
 * 6. GET  /:id/summary                                — 월별/연간 요약
 */
import {
  Controller, Get, Post, Put, Delete,
  Body, Param, Query, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Company, Plant } from '../../../common/decorators/tenant.decorator';
import { WorkCalendarService } from '../services/work-calendar.service';
import {
  CreateWorkCalendarDto, UpdateWorkCalendarDto, WorkCalendarQueryDto,
  BulkUpdateDaysDto, GenerateCalendarDto,
} from '../dto/work-calendar.dto';
import { ResponseUtil } from '../../../common/dto/response.dto';

@ApiTags('기준정보 - 생산월력')
@Controller('master/work-calendars')
export class WorkCalendarController {
  constructor(private readonly svc: WorkCalendarService) {}

  // ─── 캘린더 CRUD ───

  @Get()
  @ApiOperation({ summary: '캘린더 목록' })
  async findAll(@Query() q: WorkCalendarQueryDto, @Company() co: string, @Plant() pl: string) {
    const r = await this.svc.findAll(q, co, pl);
    return ResponseUtil.paged(r.data, r.total, r.page, r.limit);
  }

  @Get(':calendarId')
  @ApiOperation({ summary: '캘린더 상세' })
  async findOne(@Param('calendarId') calendarId: string) {
    return ResponseUtil.success(await this.svc.findById(calendarId));
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '캘린더 생성' })
  async create(@Body() dto: CreateWorkCalendarDto, @Company() co: string, @Plant() pl: string) {
    return ResponseUtil.success(await this.svc.create(dto, co, pl), '캘린더가 생성되었습니다.');
  }

  @Put(':calendarId')
  @ApiOperation({ summary: '캘린더 수정' })
  async update(@Param('calendarId') calendarId: string, @Body() dto: UpdateWorkCalendarDto) {
    return ResponseUtil.success(await this.svc.update(calendarId, dto), '캘린더가 수정되었습니다.');
  }

  @Delete(':calendarId')
  @ApiOperation({ summary: '캘린더 삭제 (하위 일자 포함)' })
  async delete(@Param('calendarId') calendarId: string) {
    await this.svc.delete(calendarId);
    return ResponseUtil.success(null, '캘린더가 삭제되었습니다.');
  }

  // ─── 연간 생성 / 복사 ───

  @Post(':calendarId/generate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '연간 일정 자동 생성' })
  async generate(
    @Param('calendarId') calendarId: string,
    @Body() dto: GenerateCalendarDto,
    @Company() co: string, @Plant() pl: string,
  ) {
    const data = await this.svc.generateYear(calendarId, dto, co, pl);
    return ResponseUtil.success(data, '연간 일정이 생성되었습니다.');
  }

  @Post(':calendarId/copy-from/:sourceId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '다른 캘린더에서 일정 복사' })
  async copyFrom(
    @Param('calendarId') calendarId: string,
    @Param('sourceId') sourceId: string,
    @Company() co: string, @Plant() pl: string,
  ) {
    const data = await this.svc.copyFrom(calendarId, sourceId, co, pl);
    return ResponseUtil.success(data, '일정이 복사되었습니다.');
  }

  // ─── 일별 근무 ───

  @Get(':calendarId/days')
  @ApiOperation({ summary: '월별 일자 조회 (query: month=YYYY-MM)' })
  async findDays(
    @Param('calendarId') calendarId: string,
    @Query('month') month: string,
  ) {
    return ResponseUtil.success(await this.svc.findDaysByMonth(calendarId, month));
  }

  @Put(':calendarId/days/bulk')
  @ApiOperation({ summary: '일별 근무 일괄 저장' })
  async bulkUpdateDays(
    @Param('calendarId') calendarId: string,
    @Body() dto: BulkUpdateDaysDto,
    @Company() co: string, @Plant() pl: string,
  ) {
    const data = await this.svc.bulkUpdateDays(calendarId, dto, co, pl);
    return ResponseUtil.success(data, '일별 근무가 저장되었습니다.');
  }

  // ─── 확정 / 취소 ───

  @Post(':calendarId/confirm')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '캘린더 확정' })
  async confirm(@Param('calendarId') calendarId: string) {
    return ResponseUtil.success(await this.svc.confirm(calendarId), '캘린더가 확정되었습니다.');
  }

  @Post(':calendarId/unconfirm')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '캘린더 확정 취소' })
  async unconfirm(@Param('calendarId') calendarId: string) {
    return ResponseUtil.success(await this.svc.unconfirm(calendarId), '확정이 취소되었습니다.');
  }

  // ─── 요약 ───

  @Get(':calendarId/summary')
  @ApiOperation({ summary: '월별/연간 근무 요약' })
  async getSummary(@Param('calendarId') calendarId: string) {
    return ResponseUtil.success(await this.svc.getSummary(calendarId));
  }
}
