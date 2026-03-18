/**
 * @file audit.dto.ts
 * @description 납품업체심사 DTO — 심사 계획 생성/수정, 발견사항 등록, 조회 필터
 *
 * 초보자 가이드:
 * 1. **CreateAuditPlanDto**: 심사 계획 등록 (유형, 범위, 심사원, 일정)
 * 2. **UpdateAuditPlanDto**: 수정 시 사용 (PartialType으로 전체 필드 선택적)
 * 3. **CreateAuditFindingDto**: 발견사항 등록 (카테고리, 조항 참조, 증거)
 * 4. **AuditQueryDto**: 목록 조회 필터/페이지네이션
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
 * 심사 계획 등록 DTO
 */
export class CreateAuditPlanDto {
  @ApiProperty({
    description: '심사 유형',
    enum: ['SYSTEM', 'PROCESS', 'PRODUCT', 'LAYERED'],
  })
  @IsIn(['SYSTEM', 'PROCESS', 'PRODUCT', 'LAYERED'])
  auditType: string;

  @ApiProperty({ description: '심사 범위', maxLength: 500 })
  @IsString()
  @MaxLength(500)
  auditScope: string;

  @ApiPropertyOptional({ description: '대상 부서', maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  targetDept?: string;

  @ApiProperty({ description: '주 심사원', maxLength: 100 })
  @IsString()
  @MaxLength(100)
  auditor: string;

  @ApiPropertyOptional({ description: '보조 심사원', maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  coAuditor?: string;

  @ApiProperty({ description: '예정일 (ISO 8601)' })
  @IsDateString()
  scheduledDate: string;

  @ApiPropertyOptional({ description: '요약', maxLength: 2000 })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  summary?: string;
}

/**
 * 심사 계획 수정 DTO (전체 필드 선택적)
 */
export class UpdateAuditPlanDto extends PartialType(CreateAuditPlanDto) {}

/**
 * 발견사항 등록 DTO
 */
export class CreateAuditFindingDto {
  @ApiProperty({ description: '심사 ID' })
  @Type(() => Number)
  @IsInt()
  auditId: number;

  @ApiPropertyOptional({ description: '조항 참조 (예: 8.7.1)', maxLength: 50 })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  clauseRef?: string;

  @ApiProperty({
    description: '카테고리',
    enum: ['NC_MAJOR', 'NC_MINOR', 'OBSERVATION', 'OFI'],
  })
  @IsIn(['NC_MAJOR', 'NC_MINOR', 'OBSERVATION', 'OFI'])
  category: string;

  @ApiProperty({ description: '발견사항 설명', maxLength: 2000 })
  @IsString()
  @MaxLength(2000)
  description: string;

  @ApiPropertyOptional({ description: '증거', maxLength: 1000 })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  evidence?: string;

  @ApiPropertyOptional({ description: '시정조치 기한 (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @ApiPropertyOptional({ description: '비고', maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  remarks?: string;
}

/**
 * 심사 계획 목록 조회 쿼리 DTO
 */
export class AuditQueryDto {
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

  @ApiPropertyOptional({ description: '상태 필터' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ description: '심사 유형 필터' })
  @IsOptional()
  @IsString()
  auditType?: string;

  @ApiPropertyOptional({ description: '검색어 (심사번호, 범위)' })
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
