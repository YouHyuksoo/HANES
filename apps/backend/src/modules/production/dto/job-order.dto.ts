/**
 * @file src/modules/production/dto/job-order.dto.ts
 * @description 작업지시 관련 DTO 정의
 *
 * 초보자 가이드:
 * 1. **CreateDto**: 작업지시 생성 시 필요한 필드 정의
 * 2. **UpdateDto**: 작업지시 수정 시 필요한 필드 (모두 선택적)
 * 3. **QueryDto**: 목록 조회 시 필터링/페이지네이션 옵션
 *
 * 실제 DB 스키마 (job_orders 테이블):
 * - orderNo가 유니크 키
 * - status: WAITING, RUNNING, PAUSED, DONE, CANCELED
 * - erpSyncYn: ERP 연동 여부 ('Y'/'N')
 */

import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsInt,
  IsDateString,
  IsNotEmpty,
  Min,
  Max,
  MaxLength,
  IsIn,
} from 'class-validator';
import { Type } from 'class-transformer';
import { JOB_ORDER_STATUS_VALUES, USE_YN_VALUES } from '@harness/shared';
import { PaginationQueryDto } from '../../../common/dto/base-query.dto';

export type JobOrderStatus = typeof JOB_ORDER_STATUS_VALUES[number];

/**
 * 작업지시 생성 DTO
 */
export class CreateJobOrderDto {
  @ApiPropertyOptional({ description: '작업지시 번호. 미입력 시 서버에서 자동 채번', example: 'JO-20250126-001', maxLength: 50 })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  orderNo?: string;

  @ApiProperty({ description: '품목 ID', example: 'clxxx...' })
  @IsString()
  itemCode: string;

  @ApiPropertyOptional({ description: '라인 코드', example: 'LINE-01', maxLength: 50 })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  lineCode?: string;

  @ApiProperty({ description: '계획 수량', example: 1000, minimum: 1 })
  @IsInt()
  @Min(1)
  planQty: number;

  @ApiProperty({ description: '계획일 (YYYY-MM-DD) — 필수', example: '2025-01-26' })
  @IsDateString()
  @IsNotEmpty({ message: '계획일은 필수입니다.' })
  planDate: string;

  @ApiPropertyOptional({ description: '우선순위 (1:최상 ~ 10:최하)', default: 5, minimum: 1, maximum: 10 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  priority?: number;

  @ApiPropertyOptional({ description: '생산계획번호', maxLength: 50 })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  planNo?: string;

  @ApiPropertyOptional({ description: '상위 작업지시 ID (반제품 자동생성 시)' })
  @IsOptional()
  @IsString()
  parentId?: string;

  @ApiPropertyOptional({ description: '고객 PO 번호', maxLength: 50 })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  custPoNo?: string;

  @ApiPropertyOptional({ description: '비고', maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  remark?: string;

  @ApiPropertyOptional({ description: 'BOM 기반 반제품 작업지시 자동생성 여부', default: false })
  @IsOptional()
  autoCreateChildren?: boolean;

  @ApiPropertyOptional({ description: '대표 공정 코드 (미입력 시 라우팅 첫 SEQ에서 자동)', maxLength: 50 })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  processCode?: string;

  @ApiPropertyOptional({ description: '작업 설비 코드 (미입력 시 null, 추후 수동 배정)', maxLength: 50 })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  equipCode?: string;
}

/**
 * 작업지시 수정 DTO
 */
export class UpdateJobOrderDto extends PartialType(CreateJobOrderDto) {
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

  @ApiPropertyOptional({
    description: '상태',
    enum: [...JOB_ORDER_STATUS_VALUES],
  })
  @IsOptional()
  @IsString()
  @IsIn([...JOB_ORDER_STATUS_VALUES])
  status?: JobOrderStatus;
}

/**
 * 작업지시 상태 변경 DTO
 */
export class ChangeJobOrderStatusDto {
  @ApiProperty({
    description: '변경할 상태',
    enum: [...JOB_ORDER_STATUS_VALUES],
    example: 'RUNNING',
  })
  @IsString()
  @IsIn([...JOB_ORDER_STATUS_VALUES])
  status: JobOrderStatus;

  @ApiPropertyOptional({ description: '비고', maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  remark?: string;
}

/**
 * 작업지시 목록 조회 쿼리 DTO
 */
export class JobOrderQueryDto extends PaginationQueryDto {


  @ApiPropertyOptional({ description: '통합 검색 (작업지시번호/품목코드/품목명)' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: '작업지시번호 검색' })
  @IsOptional()
  @IsString()
  orderNo?: string;

  @ApiPropertyOptional({ description: '품목 ID 필터' })
  @IsOptional()
  @IsString()
  itemCode?: string;

  @ApiPropertyOptional({ description: '라인 코드 필터' })
  @IsOptional()
  @IsString()
  lineCode?: string;

  @ApiPropertyOptional({ description: '설비 코드 필터 (생산실적 기준)' })
  @IsOptional()
  @IsString()
  equipCode?: string;

  @ApiPropertyOptional({
    description: '상태 필터 (단일 값)',
    enum: [...JOB_ORDER_STATUS_VALUES],
  })
  @IsOptional()
  @IsString()
  @IsIn([...JOB_ORDER_STATUS_VALUES])
  status?: JobOrderStatus;

  @ApiPropertyOptional({ description: '상태 다중 필터 (쉼표 구분, 예: WAITING,RUNNING)' })
  @IsOptional()
  @IsString()
  statuses?: string;

  @ApiPropertyOptional({ description: '계획일 시작 (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  planDateFrom?: string;

  @ApiPropertyOptional({ description: '계획일 종료 (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  planDateTo?: string;

  @ApiPropertyOptional({ description: 'ERP 동기화 여부', enum: [...USE_YN_VALUES] })
  @IsOptional()
  @IsString()
  @IsIn([...USE_YN_VALUES])
  erpSyncYn?: string;

  @ApiPropertyOptional({ description: '품목유형 필터 (SEMI_PRODUCT | FINISHED | RAW_MATERIAL)' })
  @IsOptional()
  @IsString()
  itemType?: string;
}

/**
 * ERP 동기화 플래그 변경 DTO
 */
export class UpdateErpSyncDto {
  @ApiProperty({ description: 'ERP 동기화 여부', enum: [...USE_YN_VALUES], example: 'Y' })
  @IsString()
  @IsIn([...USE_YN_VALUES])
  erpSyncYn: string;
}
