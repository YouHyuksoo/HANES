/**
 * @file src/modules/production/dto/prod-result.dto.ts
 * @description 생산실적 관련 DTO 정의
 *
 * 초보자 가이드:
 * 1. **CreateDto**: 생산실적 생성 시 필요한 필드 정의
 * 2. **UpdateDto**: 생산실적 수정 시 필요한 필드 (모두 선택적)
 * 3. **QueryDto**: 목록 조회 시 필터링/페이지네이션 옵션
 *
 * 실제 DB 스키마 (prod_results 테이블):
 * - jobOrderId로 작업지시와 연결
 * - status: RUNNING, DONE, CANCELED
 * - cycleTime: 사이클 타임 (초)
 */

import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsInt,
  IsNumber,
  IsDateString,
  Min,
  Max,
  MaxLength,
  IsIn,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PROD_RESULT_STATUS_VALUES } from '@harness/shared';

export type ProdResultStatus = typeof PROD_RESULT_STATUS_VALUES[number];

/**
 * 생산실적 생성 DTO
 */
export class CreateProdResultDto {
  @ApiProperty({ description: '작업지시 ID', example: 'clxxx...' })
  @IsString()
  jobOrderId: string;

  @ApiPropertyOptional({ description: '설비 ID', example: 'clxxx...' })
  @IsOptional()
  @IsString()
  equipId?: string;

  @ApiPropertyOptional({ description: '작업자 ID', example: 'clxxx...' })
  @IsOptional()
  @IsString()
  workerId?: string;

  @ApiPropertyOptional({ description: 'LOT 번호', example: 'LOT-20250126-001', maxLength: 50 })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  lotNo?: string;

  @ApiPropertyOptional({ description: '공정 코드', example: 'CUT', maxLength: 50 })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  processCode?: string;

  @ApiPropertyOptional({ description: '양품 수량', default: 0, minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  goodQty?: number;

  @ApiPropertyOptional({ description: '불량 수량', default: 0, minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  defectQty?: number;

  @ApiPropertyOptional({ description: '시작 시간 (ISO 8601)', example: '2025-01-26T08:00:00Z' })
  @IsOptional()
  @IsDateString()
  startAt?: string;

  @ApiPropertyOptional({ description: '종료 시간 (ISO 8601)', example: '2025-01-26T17:00:00Z' })
  @IsOptional()
  @IsDateString()
  endAt?: string;

  @ApiPropertyOptional({ description: '사이클 타임 (초)', example: 30.5, minimum: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  cycleTime?: number;

  @ApiPropertyOptional({ description: '비고', maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  remark?: string;
}

/**
 * 생산실적 수정 DTO
 */
export class UpdateProdResultDto extends PartialType(CreateProdResultDto) {
  @ApiPropertyOptional({
    description: '상태',
    enum: [...PROD_RESULT_STATUS_VALUES],
  })
  @IsOptional()
  @IsString()
  @IsIn([...PROD_RESULT_STATUS_VALUES])
  status?: ProdResultStatus;
}

/**
 * 생산실적 목록 조회 쿼리 DTO
 */
export class ProdResultQueryDto {
  @ApiPropertyOptional({ description: '페이지 번호', default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: '페이지 크기', default: 50, minimum: 1, maximum: 10000 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10000)
  limit?: number = 50;

  @ApiPropertyOptional({ description: '작업지시 ID 필터' })
  @IsOptional()
  @IsString()
  jobOrderId?: string;

  @ApiPropertyOptional({ description: '설비 ID 필터' })
  @IsOptional()
  @IsString()
  equipId?: string;

  @ApiPropertyOptional({ description: '작업자 ID 필터' })
  @IsOptional()
  @IsString()
  workerId?: string;

  @ApiPropertyOptional({ description: 'LOT 번호 검색' })
  @IsOptional()
  @IsString()
  lotNo?: string;

  @ApiPropertyOptional({ description: '공정 코드 필터' })
  @IsOptional()
  @IsString()
  processCode?: string;

  @ApiPropertyOptional({
    description: '상태 필터',
    enum: [...PROD_RESULT_STATUS_VALUES],
  })
  @IsOptional()
  @IsString()
  @IsIn([...PROD_RESULT_STATUS_VALUES])
  status?: ProdResultStatus;

  @ApiPropertyOptional({ description: '시작 시간 (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  startTimeFrom?: string;

  @ApiPropertyOptional({ description: '종료 시간 (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  startTimeTo?: string;
}

/**
 * 생산실적 집계 응답 DTO
 */
export class ProdResultSummaryDto {
  @ApiProperty({ description: '작업지시 ID' })
  jobOrderId: string;

  @ApiProperty({ description: '총 양품 수량' })
  totalGoodQty: number;

  @ApiProperty({ description: '총 불량 수량' })
  totalDefectQty: number;

  @ApiProperty({ description: '총 생산 수량' })
  totalQty: number;

  @ApiProperty({ description: '불량률 (%)' })
  defectRate: number;

  @ApiProperty({ description: '실적 건수' })
  resultCount: number;

  @ApiPropertyOptional({ description: '평균 사이클 타임 (초)' })
  avgCycleTime?: number;
}

/**
 * 실적 완료 DTO
 */
export class CompleteProdResultDto {
  @ApiPropertyOptional({ description: '양품 수량', minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  goodQty?: number;

  @ApiPropertyOptional({ description: '불량 수량', minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  defectQty?: number;

  @ApiPropertyOptional({ description: '종료 시간 (ISO 8601)', example: '2025-01-26T17:00:00Z' })
  @IsOptional()
  @IsDateString()
  endAt?: string;

  @ApiPropertyOptional({ description: '비고', maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  remark?: string;
}
