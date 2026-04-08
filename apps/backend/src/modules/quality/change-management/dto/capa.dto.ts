/**
 * @file capa.dto.ts
 * @description CAPA 시정/예방조치 DTO — 생성, 수정, 조회, 상태 전이 요청
 *
 * 초보자 가이드:
 * 1. **CreateCapaDto**: CAPA 등록 (제목, 유형, 출처, 조치항목 포함)
 * 2. **UpdateCapaDto**: 수정 (PartialType으로 전체 필드 선택적)
 * 3. **CapaQueryDto**: 목록 조회 필터/페이지네이션
 * 4. **AnalyzeCapaDto**: 근본 원인 분석 완료 (OPEN → ANALYZING)
 * 5. **PlanCapaDto**: 조치 계획 등록 (ANALYZING → ACTION_PLANNED)
 * 6. **VerifyCapaDto**: 유효성 검증 (IN_PROGRESS → VERIFYING → CLOSED)
 */

import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsNumber,
  IsInt,
  IsDateString,
  Min,
  Max,
  MaxLength,
  ValidateNested,
  IsArray,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PaginationQueryDto } from '../../../../common/dto/base-query.dto';

/**
 * CAPA 조치 항목 DTO (생성/수정 시 사용)
 */
export class CAPAActionItemDto {
  @ApiPropertyOptional({ description: '조치항목 ID (수정 시)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  id?: number;

  @ApiProperty({ description: '순서' })
  @Type(() => Number)
  @IsInt()
  seq: number;

  @ApiProperty({ description: '조치 내용', maxLength: 1000 })
  @IsString()
  @MaxLength(1000)
  actionDesc: string;

  @ApiPropertyOptional({ description: '담당자 코드', maxLength: 50 })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  responsibleCode?: string;

  @ApiPropertyOptional({ description: '기한 (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @ApiPropertyOptional({ description: '상태', example: 'PENDING' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  status?: string;

  @ApiPropertyOptional({ description: '조치 결과', maxLength: 1000 })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  result?: string;
}

/**
 * CAPA 생성 DTO
 */
export class CreateCapaDto {
  @ApiProperty({ description: 'CAPA 유형', example: 'CORRECTIVE', enum: ['CORRECTIVE', 'PREVENTIVE'] })
  @IsString()
  @MaxLength(20)
  capaType: string;

  @ApiPropertyOptional({ description: '출처 유형', example: 'DEFECT' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  sourceType?: string;

  @ApiPropertyOptional({ description: '출처 레코드 ID' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  sourceId?: number;

  @ApiProperty({ description: '제목', maxLength: 200 })
  @IsString()
  @MaxLength(200)
  title: string;

  @ApiPropertyOptional({ description: '부적합 내용 상세', maxLength: 2000 })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional({ description: '목표 완료일 (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  targetDate?: string;

  @ApiPropertyOptional({ description: '담당자 코드', maxLength: 50 })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  responsibleCode?: string;

  @ApiPropertyOptional({ description: '우선순위', example: 'HIGH' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  priority?: string;

  @ApiPropertyOptional({ description: '관련 품목 코드', maxLength: 50 })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  itemCode?: string;

  @ApiPropertyOptional({ description: '관련 라인 코드', maxLength: 50 })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  lineCode?: string;

  @ApiPropertyOptional({ description: '조치 항목 목록', type: [CAPAActionItemDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CAPAActionItemDto)
  actions?: CAPAActionItemDto[];
}

/**
 * CAPA 수정 DTO (전체 필드 선택적)
 */
export class UpdateCapaDto extends PartialType(CreateCapaDto) {}

/**
 * CAPA 목록 조회 쿼리 DTO
 */
export class CapaQueryDto extends PaginationQueryDto {


  @ApiPropertyOptional({ description: '상태 필터' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ description: 'CAPA 유형 필터' })
  @IsOptional()
  @IsString()
  capaType?: string;

  @ApiPropertyOptional({ description: '출처 유형 필터' })
  @IsOptional()
  @IsString()
  sourceType?: string;

  @ApiPropertyOptional({ description: '우선순위 필터' })
  @IsOptional()
  @IsString()
  priority?: string;

  @ApiPropertyOptional({ description: '검색어 (CAPA번호, 제목)' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: '조회 시작일 (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ description: '조회 종료일 (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  endDate?: string;
}

/**
 * 원인 분석 완료 DTO (OPEN → ANALYZING)
 */
export class AnalyzeCapaDto {
  @ApiProperty({ description: '근본 원인 분석 (5Why, FTA 등)', maxLength: 2000 })
  @IsString()
  @MaxLength(2000)
  rootCause: string;
}

/**
 * 조치 계획 등록 DTO (ANALYZING → ACTION_PLANNED)
 */
export class PlanCapaDto {
  @ApiProperty({ description: '시정/예방 조치 계획', maxLength: 2000 })
  @IsString()
  @MaxLength(2000)
  actionPlan: string;

  @ApiPropertyOptional({ description: '목표 완료일 (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  targetDate?: string;
}

/**
 * 유효성 검증 DTO (IN_PROGRESS → VERIFYING)
 */
export class VerifyCapaDto {
  @ApiProperty({ description: '유효성 검증 결과', maxLength: 1000 })
  @IsString()
  @MaxLength(1000)
  verificationResult: string;
}
