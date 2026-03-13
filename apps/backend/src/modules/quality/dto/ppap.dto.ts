/**
 * @file ppap.dto.ts
 * @description PPAP 제출 DTO — 생성, 수정, 조회 필터
 *
 * 초보자 가이드:
 * 1. **CreatePpapDto**: PPAP 등록 시 사용 (품목코드, 고객, PPAP Level, 사유 등)
 * 2. **UpdatePpapDto**: 수정 시 사용 (PartialType으로 전체 필드 선택적)
 * 3. **PpapFilterDto**: 목록 조회 필터/페이지네이션 (상태, 품목, 고객, 검색, 기간)
 */

import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsInt,
  IsIn,
  IsDateString,
  Min,
  Max,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * PPAP 등록 DTO
 */
export class CreatePpapDto {
  @ApiProperty({ description: '품목코드', maxLength: 50 })
  @IsString()
  @MaxLength(50)
  itemCode: string;

  @ApiPropertyOptional({ description: '품목명', maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  itemName?: string;

  @ApiPropertyOptional({ description: '고객코드', maxLength: 50 })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  customerCode?: string;

  @ApiPropertyOptional({ description: '고객명', maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  customerName?: string;

  @ApiPropertyOptional({
    description: 'PPAP Level (1~5)',
    default: 3,
    minimum: 1,
    maximum: 5,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  ppapLevel?: number;

  @ApiProperty({
    description: 'PPAP 사유',
    enum: ['NEW_PART', 'ECN', 'TOOLING', 'CORRECTION', 'OTHER'],
  })
  @IsIn(['NEW_PART', 'ECN', 'TOOLING', 'CORRECTION', 'OTHER'])
  reason: string;

  // 18 PPAP Elements (optional boolean flags)
  @ApiPropertyOptional({ description: '설계기록', default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  designRecords?: number;

  @ApiPropertyOptional({ description: 'ECN 문서', default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  ecnDocuments?: number;

  @ApiPropertyOptional({ description: '고객 승인', default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  customerApproval?: number;

  @ApiPropertyOptional({ description: 'DFMEA', default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  dfmea?: number;

  @ApiPropertyOptional({ description: '공정 흐름도', default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  processFlowDiagram?: number;

  @ApiPropertyOptional({ description: 'PFMEA', default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  pfmea?: number;

  @ApiPropertyOptional({ description: '관리계획서', default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  controlPlan?: number;

  @ApiPropertyOptional({ description: 'MSA 연구', default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  msaStudies?: number;

  @ApiPropertyOptional({ description: '치수 측정결과', default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  dimensionalResults?: number;

  @ApiPropertyOptional({ description: '재료 시험결과', default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  materialTestResults?: number;

  @ApiPropertyOptional({ description: '초기 공정능력 연구', default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  initialProcessStudies?: number;

  @ApiPropertyOptional({ description: '인정 시험소 문서', default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  qualifiedLabDoc?: number;

  @ApiPropertyOptional({ description: '외관 승인', default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  appearanceApproval?: number;

  @ApiPropertyOptional({ description: '샘플 제품', default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sampleProduct?: number;

  @ApiPropertyOptional({ description: '마스터 샘플', default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  masterSample?: number;

  @ApiPropertyOptional({ description: '검사 보조기구', default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  checkingAids?: number;

  @ApiPropertyOptional({ description: '고객 특수 요구사항', default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  customerSpecificReq?: number;

  @ApiPropertyOptional({ description: 'PSW (부품 제출 보증서)', default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  partSubmissionWarrant?: number;

  @ApiPropertyOptional({ description: '비고', maxLength: 1000 })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  remarks?: string;
}

/**
 * PPAP 수정 DTO (전체 필드 선택적)
 */
export class UpdatePpapDto extends PartialType(CreatePpapDto) {}

/**
 * PPAP 목록 조회 필터 DTO
 */
export class PpapFilterDto {
  @ApiPropertyOptional({ description: '페이지 번호', default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: '페이지 크기', default: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10000)
  limit?: number = 50;

  @ApiPropertyOptional({
    description: '상태 필터',
    enum: ['DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'INTERIM'],
  })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ description: '품목코드 필터' })
  @IsOptional()
  @IsString()
  itemCode?: string;

  @ApiPropertyOptional({ description: '고객코드 필터' })
  @IsOptional()
  @IsString()
  customerCode?: string;

  @ApiPropertyOptional({
    description: 'PPAP 사유 필터',
    enum: ['NEW_PART', 'ECN', 'TOOLING', 'CORRECTION', 'OTHER'],
  })
  @IsOptional()
  @IsString()
  reason?: string;

  @ApiPropertyOptional({ description: '검색어 (PPAP번호, 품목코드, 품목명)' })
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
