/**
 * @file src/modules/scheduler/controllers/scheduler-log.controller.ts
 * @description 스케줄러 실행 로그 API 컨트롤러
 *
 * 초보자 가이드:
 * 1. **GET /scheduler/logs**: 실행 로그 목록 조회 (필터: 작업코드, 상태, 날짜범위)
 * 2. **GET /scheduler/logs/summary**: 대시보드용 통계 (성공률, 일별 추이 등)
 * 3. 모든 인증된 사용자가 조회 가능 (역할 제한 없음)
 */

import {
  Controller,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Company, Plant } from '../../../common/decorators/tenant.decorator';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { ResponseUtil } from '../../../common/dto/response.dto';
import { SchedulerLogService } from '../services/scheduler-log.service';
import { SchedulerLogFilterDto } from '../dto/scheduler-log.dto';

@ApiTags('Scheduler')
@Controller('scheduler/logs')
@UseGuards(JwtAuthGuard)
export class SchedulerLogController {
  constructor(private readonly logService: SchedulerLogService) {}

  @Get()
  @ApiOperation({ summary: '스케줄러 실행 로그 목록 조회' })
  @ApiResponse({ status: 200, description: '조회 성공' })
  async findAll(
    @Query() filter: SchedulerLogFilterDto,
    @Company() company: string,
    @Plant() plant: string,
  ) {
    const result = await this.logService.findAll(filter, company, plant);
    return ResponseUtil.paged(result.data, result.total, result.page, result.limit);
  }

  @Get('summary')
  @ApiOperation({ summary: '스케줄러 실행 통계 요약', description: '대시보드용 통계 (오늘 건수, 성공률, 7일 추이, 작업별 비율)' })
  @ApiResponse({ status: 200, description: '조회 성공' })
  async getSummary(
    @Company() company: string,
    @Plant() plant: string,
  ) {
    const data = await this.logService.getSummary(company, plant);
    return ResponseUtil.success(data);
  }
}
