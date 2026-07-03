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
import { PaginationQueryDto } from '../../../common/dto/base-query.dto';

import { PRODUCT_STOCK_ITEM_TYPE_VALUES, PRODUCT_STOCK_QUALITY_STATUS_VALUES, USE_YN_VALUES } from '@harness/shared';
/**
 * 작업지시 진행현황 조회 DTO
 */
export class ProgressQueryDto extends PaginationQueryDto {


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

  @ApiPropertyOptional({ description: '교대 코드 필터 (예: DAY, NIGHT)' })
  @IsOptional()
  @IsString()
  shift?: string;
}

/**
 * 샘플검사이력 조회 DTO
 */
export class SampleInspectQueryDto extends PaginationQueryDto {


  @ApiPropertyOptional({ description: '합격 여부 (Y/N)' })
  @IsOptional()
  @IsString()
  @IsIn([...USE_YN_VALUES])
  passYn?: string;

  @ApiPropertyOptional({ description: '검사일 시작' })
  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @ApiPropertyOptional({ description: '검사일 종료' })
  @IsOptional()
  @IsDateString()
  toDate?: string;

  @ApiPropertyOptional({ description: '검색어 (LOT번호, 품목코드)' })
  @IsOptional()
  @IsString()
  search?: string;
}

/**
 * 포장실적 조회 DTO
 */
export class PackResultQueryDto extends PaginationQueryDto {


  @ApiPropertyOptional({ description: '포장일 시작' })
  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @ApiPropertyOptional({ description: '포장일 종료' })
  @IsOptional()
  @IsDateString()
  toDate?: string;

  @ApiPropertyOptional({ description: '검색어 (박스번호, LOT번호)' })
  @IsOptional()
  @IsString()
  search?: string;
}

/**
 * 반제품/제품재고 조회 DTO
 */
export class WipStockQueryDto extends PaginationQueryDto {


  @ApiPropertyOptional({ description: '품목 유형 (SEMI_PRODUCT/FINISHED)', enum: PRODUCT_STOCK_ITEM_TYPE_VALUES })
  @IsOptional()
  @IsString()
  @IsIn([...PRODUCT_STOCK_ITEM_TYPE_VALUES])
  itemType?: string;

  @ApiPropertyOptional({ description: '재고 품질상태 (GOOD/DEFECT)', enum: PRODUCT_STOCK_QUALITY_STATUS_VALUES })
  @IsOptional()
  @IsString()
  @IsIn([...PRODUCT_STOCK_QUALITY_STATUS_VALUES])
  qualityStatus?: string;

  @ApiPropertyOptional({ description: '검색어 (품목코드, 품목명)' })
  @IsOptional()
  @IsString()
  search?: string;
}
