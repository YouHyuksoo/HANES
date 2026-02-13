/**
 * @file src/modules/production/dto/production-views.dto.ts
 * @description 생산관리 조회 전용 API (작업진행현황, 샘플검사이력, 포장실적, 반제품/제품재고) DTO
 *
 * 초보자 가이드:
 * 1. **ProgressQueryDto**: 작업진행현황 대시보드 조회 조건
 * 2. **SampleInspectQueryDto**: 샘플검사이력 조회 조건
 * 3. **PackResultQueryDto**: 포장실적 조회 조건
 * 4. **WipStockQueryDto**: 반제품/제품재고 조회 조건
 */

import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsInt,
  IsDateString,
  Min,
  Max,
  IsIn,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * 작업지시 진행현황 조회 DTO
 */
export class ProgressQueryDto {
  @ApiPropertyOptional({ description: '페이지 번호', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: '페이지 크기', default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({ description: '상태 필터 (WAITING, RUNNING, PAUSED, DONE, CANCELED)' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ description: '계획일 시작' })
  @IsOptional()
  @IsDateString()
  planDateFrom?: string;

  @ApiPropertyOptional({ description: '계획일 종료' })
  @IsOptional()
  @IsDateString()
  planDateTo?: string;

  @ApiPropertyOptional({ description: '검색어 (지시번호, 품목코드)' })
  @IsOptional()
  @IsString()
  search?: string;
}

/**
 * 샘플검사이력 조회 DTO
 */
export class SampleInspectQueryDto {
  @ApiPropertyOptional({ description: '페이지 번호', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: '페이지 크기', default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 10;

  @ApiPropertyOptional({ description: '합격 여부 (Y/N)' })
  @IsOptional()
  @IsString()
  @IsIn(['Y', 'N'])
  passYn?: string;

  @ApiPropertyOptional({ description: '검사일 시작' })
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @ApiPropertyOptional({ description: '검사일 종료' })
  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @ApiPropertyOptional({ description: '검색어 (LOT번호, 품목코드)' })
  @IsOptional()
  @IsString()
  search?: string;
}

/**
 * 포장실적 조회 DTO
 */
export class PackResultQueryDto {
  @ApiPropertyOptional({ description: '페이지 번호', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: '페이지 크기', default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 10;

  @ApiPropertyOptional({ description: '포장일 시작' })
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @ApiPropertyOptional({ description: '포장일 종료' })
  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @ApiPropertyOptional({ description: '검색어 (박스번호, LOT번호)' })
  @IsOptional()
  @IsString()
  search?: string;
}

/**
 * 반제품/제품재고 조회 DTO
 */
export class WipStockQueryDto {
  @ApiPropertyOptional({ description: '페이지 번호', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: '페이지 크기', default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 10;

  @ApiPropertyOptional({ description: '품목 유형 (WIP/FG)', enum: ['WIP', 'FG'] })
  @IsOptional()
  @IsString()
  @IsIn(['WIP', 'FG'])
  partType?: string;

  @ApiPropertyOptional({ description: '검색어 (품목코드, 품목명)' })
  @IsOptional()
  @IsString()
  search?: string;
}
