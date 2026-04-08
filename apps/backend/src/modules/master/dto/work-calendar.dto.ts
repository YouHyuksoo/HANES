/**
 * @file src/modules/master/dto/work-calendar.dto.ts
 * @description 근무 캘린더 + 교대 패턴 + 일별 근무 설정 DTO
 *
 * 초보자 가이드:
 * 1. CreateShiftPatternDto: 교대(주간/야간 등) 패턴 생성
 * 2. CreateWorkCalendarDto: 연간 근무 캘린더 생성
 * 3. WorkCalendarDayItemDto: 일별 근무 유형 설정 (근무/휴무/반일 등)
 * 4. BulkUpdateDaysDto: 여러 날짜의 근무 설정 일괄 변경
 * 5. GenerateCalendarDto: 캘린더 자동 생성 옵션 (주말 휴무, 공휴일 적용)
 */
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsString, IsOptional, IsInt, IsIn, IsBoolean,
  IsArray, ValidateNested, Min, Max, MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PaginationQueryDto } from '../../../common/dto/base-query.dto';

// ─── 교대 패턴 ───

export class CreateShiftPatternDto {
  @ApiProperty({ description: '교대 코드', maxLength: 20 })
  @IsString() @MaxLength(20)
  shiftCode: string;

  @ApiProperty({ description: '교대명', maxLength: 100 })
  @IsString() @MaxLength(100)
  shiftName: string;

  @ApiProperty({ description: '시작 시간 (HH:MM)', maxLength: 5 })
  @IsString() @MaxLength(5)
  startTime: string;

  @ApiProperty({ description: '종료 시간 (HH:MM)', maxLength: 5 })
  @IsString() @MaxLength(5)
  endTime: string;

  @ApiPropertyOptional({ description: '휴게 시간(분)', default: 60 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(0)
  breakMinutes?: number;

  @ApiPropertyOptional({ description: '실 근무 시간(분)' })
  @IsOptional() @Type(() => Number) @IsInt() @Min(0)
  workMinutes?: number;

  @ApiPropertyOptional({ description: '정렬 순서' })
  @IsOptional() @Type(() => Number) @IsInt() @Min(0)
  sortOrder?: number;
}

export class UpdateShiftPatternDto extends PartialType(CreateShiftPatternDto) {}

// ─── 근무 캘린더 ───

export class CreateWorkCalendarDto {
  @ApiProperty({ description: '캘린더 ID', maxLength: 50 })
  @IsString() @MaxLength(50)
  calendarId: string;

  @ApiProperty({ description: '캘린더 연도 (YYYY)', maxLength: 4 })
  @IsString() @MaxLength(4)
  calendarYear: string;

  @ApiPropertyOptional({ description: '공정 코드 (null = 공장 기본)', maxLength: 50 })
  @IsOptional() @IsString() @MaxLength(50)
  processCd?: string;

  @ApiPropertyOptional({ description: '기본 교대 횟수 (1~3)', default: 1 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(3)
  defaultShiftCount?: number;

  @ApiPropertyOptional({ description: '기본 교대 목록 (CSV, 예: "DAY,NIGHT")', maxLength: 100 })
  @IsOptional() @IsString() @MaxLength(100)
  defaultShifts?: string;

  @ApiPropertyOptional({ description: '비고', maxLength: 500 })
  @IsOptional() @IsString() @MaxLength(500)
  remark?: string;
}

export class UpdateWorkCalendarDto extends PartialType(CreateWorkCalendarDto) {}

export class WorkCalendarQueryDto extends PaginationQueryDto {


  @ApiPropertyOptional({ description: '캘린더 연도' })
  @IsOptional() @IsString()
  calendarYear?: string;

  @ApiPropertyOptional({ description: '공정 코드' })
  @IsOptional() @IsString()
  processCd?: string;

  @ApiPropertyOptional({ description: '상태' })
  @IsOptional() @IsString()
  status?: string;

  @ApiPropertyOptional({ description: '검색어' })
  @IsOptional() @IsString()
  search?: string;
}

// ─── 일별 근무 설정 ───

export class WorkCalendarDayItemDto {
  @ApiProperty({ description: '근무 일자 (YYYY-MM-DD)' })
  @IsString()
  workDate: string;

  @ApiProperty({ description: '일자 유형', enum: ['WORK', 'OFF', 'HALF', 'SPECIAL'] })
  @IsString() @IsIn(['WORK', 'OFF', 'HALF', 'SPECIAL'])
  dayType: string;

  @ApiPropertyOptional({ description: '휴무 사유 코드', maxLength: 20 })
  @IsOptional() @IsString() @MaxLength(20)
  offReason?: string;

  @ApiPropertyOptional({ description: '교대 횟수' })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(3)
  shiftCount?: number;

  @ApiPropertyOptional({ description: '교대 목록 (CSV)', maxLength: 100 })
  @IsOptional() @IsString() @MaxLength(100)
  shifts?: string;

  @ApiPropertyOptional({ description: '근무 시간(분)' })
  @IsOptional() @Type(() => Number) @IsInt() @Min(0)
  workMinutes?: number;

  @ApiPropertyOptional({ description: '잔업 시간(분)', default: 0 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(0)
  otMinutes?: number;

  @ApiPropertyOptional({ description: '비고', maxLength: 500 })
  @IsOptional() @IsString() @MaxLength(500)
  remark?: string;
}

export class BulkUpdateDaysDto {
  @ApiProperty({ type: [WorkCalendarDayItemDto], description: '일별 근무 설정 목록' })
  @IsArray() @ValidateNested({ each: true }) @Type(() => WorkCalendarDayItemDto)
  days: WorkCalendarDayItemDto[];
}

export class GenerateCalendarDto {
  @ApiPropertyOptional({ description: '토요일 근무 여부', default: false })
  @IsOptional() @Type(() => Boolean) @IsBoolean()
  saturdayWork?: boolean;

  @ApiPropertyOptional({ description: '일요일 근무 여부', default: false })
  @IsOptional() @Type(() => Boolean) @IsBoolean()
  sundayWork?: boolean;

  @ApiPropertyOptional({ description: '공휴일 적용 여부', default: true })
  @IsOptional() @Type(() => Boolean) @IsBoolean()
  applyHolidays?: boolean;
}
