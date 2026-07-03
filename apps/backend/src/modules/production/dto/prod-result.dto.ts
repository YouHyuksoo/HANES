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
 * - orderNo로 작업지시와 연결
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
  IsArray,
  ValidateNested,
  Min,
  Max,
  MaxLength,
  IsIn,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PROD_RESULT_STATUS_VALUES } from '@harness/shared';
import { PaginationQueryDto } from '../../../common/dto/base-query.dto';

export type ProdResultStatus = typeof PROD_RESULT_STATUS_VALUES[number];
export const PROD_RESULT_PRODUCTION_TYPE_VALUES = ['TRIAL', 'MASS'] as const;
export type ProdResultProductionType = typeof PROD_RESULT_PRODUCTION_TYPE_VALUES[number];

/**
 * 생산실적 불량 상세 (불량입력 모달에서 등록된 유형별 불량)
 * 생산실적 생성과 같은 트랜잭션에서 DefectLog로 저장된다.
 */
export class ProdResultDefectDto {
  @ApiProperty({ description: '불량 코드', example: 'DEF001', maxLength: 50 })
  @IsString()
  @MaxLength(50)
  defectCode: string;

  @ApiPropertyOptional({ description: '불량명', maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  defectName?: string;

  @ApiPropertyOptional({ description: '불량 수량', default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  qty?: number;
}

/**
 * 생산실적 생성 DTO
 */
export class CreateProdResultDto {
  @ApiProperty({ description: '작업지시 ID', example: 'clxxx...' })
  @IsString()
  orderNo: string;

  @ApiPropertyOptional({ description: '설비 ID', example: 'clxxx...' })
  @IsOptional()
  @IsString()
  equipCode?: string;

  @ApiPropertyOptional({ description: '작업자 ID', example: 'clxxx...' })
  @IsOptional()
  @IsString()
  workerId?: string;

  @ApiPropertyOptional({ description: '제품 UID', example: 'PRD-20250126-001', maxLength: 50 })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  prdUid?: string;

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

  @ApiPropertyOptional({ description: '교대 코드 (미지정 시 자동판별)', maxLength: 20 })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  shiftCode?: string;

  @ApiPropertyOptional({ description: '실적 묶음 수 (SFG 라벨 발행 시 묶음 개수)', minimum: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  bundleCount?: number;

  @ApiPropertyOptional({ description: '묶음당 가닥수 (SFG 라벨 발행 시 묶음당 수량)', minimum: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  qtyPerBundle?: number;

  @ApiPropertyOptional({
    type: [ProdResultDefectDto],
    description: '불량 상세 목록 (불량입력 시). 제공되면 합계로 defectQty를 산정하고 DefectLog를 함께 저장한다.',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProdResultDefectDto)
  defects?: ProdResultDefectDto[];
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
export class ProdResultQueryDto extends PaginationQueryDto {

  @ApiPropertyOptional({ description: '통합 검색어 (실적번호, 작업지시번호, 제품 UID)' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: '작업지시 ID 필터' })
  @IsOptional()
  @IsString()
  orderNo?: string;

  @ApiPropertyOptional({ description: '설비 ID 필터' })
  @IsOptional()
  @IsString()
  equipCode?: string;

  @ApiPropertyOptional({ description: '작업자 ID 필터' })
  @IsOptional()
  @IsString()
  workerId?: string;

  @ApiPropertyOptional({ description: '제품 UID 검색' })
  @IsOptional()
  @IsString()
  prdUid?: string;

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

  @ApiPropertyOptional({
    description: '생산유형 필터',
    enum: [...PROD_RESULT_PRODUCTION_TYPE_VALUES],
  })
  @IsOptional()
  @IsString()
  @IsIn([...PROD_RESULT_PRODUCTION_TYPE_VALUES])
  productionType?: ProdResultProductionType;

  @ApiPropertyOptional({ description: '교대 코드 필터' })
  @IsOptional()
  @IsString()
  shiftCode?: string;

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
 * 작업지시 대비 실적 조회 쿼리 DTO
 */
export class ProdOrderResultQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: '통합 검색어 (작업지시번호, 품목코드, 품목명)' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: '작업지시 번호 필터' })
  @IsOptional()
  @IsString()
  orderNo?: string;

  @ApiPropertyOptional({ description: '품목 코드 필터' })
  @IsOptional()
  @IsString()
  itemCode?: string;

  @ApiPropertyOptional({ description: '라인 코드 필터' })
  @IsOptional()
  @IsString()
  lineCode?: string;

  @ApiPropertyOptional({ description: '설비 코드 필터' })
  @IsOptional()
  @IsString()
  equipCode?: string;

  @ApiPropertyOptional({ description: '작업지시 상태 필터' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ description: '공정 코드 필터' })
  @IsOptional()
  @IsString()
  processCode?: string;

  @ApiPropertyOptional({ description: '작업지시 종류 필터' })
  @IsOptional()
  @IsString()
  orderKind?: string;

  @ApiPropertyOptional({ description: '계획일 시작 (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  planDateFrom?: string;

  @ApiPropertyOptional({ description: '계획일 종료 (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  planDateTo?: string;
}

/**
 * 생산실적 집계 응답 DTO
 */
export class ProdResultSummaryDto {
  @ApiProperty({ description: '작업지시 ID' })
  orderNo: string;

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
