/**
 * @file src/modules/scheduler/dto/scheduler-log.dto.ts
 * @description 스케줄러 실행 로그 관련 DTO 정의
 *
 * 초보자 가이드:
 * 1. **SchedulerLogFilterDto**: 실행 로그 목록 조회 필터
 * 2. **필터**: 작업코드, 실행상태, 시작일/종료일 기간 검색
 * 3. **페이지네이션**: page(기본 1), limit(기본 50)
 */

import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsInt,
  Min,
  Max,
  IsIn,
  IsDateString,
} from 'class-validator';
import { Type } from 'class-transformer';

/** 허용되는 실행 상태값 */
const SCHED_STATUSES = [
  'SUCCESS',
  'FAIL',
  'RUNNING',
  'RETRYING',
  'TIMEOUT',
  'SKIPPED',
] as const;

export class SchedulerLogFilterDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10000)
  limit?: number = 50;

  @ApiPropertyOptional({ description: '작업코드 필터' })
  @IsOptional()
  @IsString()
  jobCode?: string;

  @ApiPropertyOptional({ description: '실행 상태 필터', enum: SCHED_STATUSES })
  @IsOptional()
  @IsString()
  @IsIn(SCHED_STATUSES)
  status?: string;

  @ApiPropertyOptional({ description: '시작일 (ISO 8601)', example: '2026-03-01' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ description: '종료일 (ISO 8601)', example: '2026-03-18' })
  @IsOptional()
  @IsDateString()
  endDate?: string;
}
