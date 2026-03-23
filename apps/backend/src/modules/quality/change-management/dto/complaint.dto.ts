/**
 * @file complaint.dto.ts
 * @description 고객클�태 DTO — 생성, 수정, 조회, 조사, 대응, CAPA 연계
 *
 * 초보자 가이드:
 * 1. **CreateComplaintDto**: 클레임 접수 시 사용 (고객, 품목, 유형, 내용 등)
 * 2. **UpdateComplaintDto**: 수정 시 사용 (PartialType으로 전체 필드 선택적)
 * 3. **ComplaintQueryDto**: 목록 조회 필터/페이지네이션
 * 4. **InvestigateComplaintDto**: 조사 시작 시 원인분석/봉쇄조치 입력
 * 5. **RespondComplaintDto**: 대응 완료 시 시정/예방조치 입력
 * 6. **LinkCapaDto**: CAPA 연계 시 CAPA ID 입력
 *
 * 상태 흐름:
 * RECEIVED → INVESTIGATING → RESPONDING → RESOLVED → CLOSED
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
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * 고객클�태 등록 DTO
 */
export class CreateComplaintDto {
  @ApiProperty({ description: '고객 코드', maxLength: 50 })
  @IsString()
  @MaxLength(50)
  customerCode: string;

  @ApiPropertyOptional({ description: '고객명', maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  customerName?: string;

  @ApiProperty({ description: '접수일 (ISO 8601)' })
  @IsDateString()
  complaintDate: string;

  @ApiPropertyOptional({ description: '클�태 품목 코드', maxLength: 50 })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  itemCode?: string;

  @ApiPropertyOptional({ description: '관련 LOT 번호', maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  lotNo?: string;

  @ApiPropertyOptional({ description: '불량 수량', minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  defectQty?: number;

  @ApiProperty({ description: '클�태 유형 (QUALITY/DELIVERY/DAMAGE)', maxLength: 30 })
  @IsString()
  @MaxLength(30)
  complaintType: string;

  @ApiPropertyOptional({ description: '클�태 내용', maxLength: 2000 })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional({ description: '긴급도 (CRITICAL/HIGH/MEDIUM/LOW)', maxLength: 20 })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  urgency?: string;

  @ApiPropertyOptional({ description: '담당자 코드', maxLength: 50 })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  responsibleCode?: string;

  @ApiPropertyOptional({ description: '클�태 비용' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  costAmount?: number;
}

/**
 * 고객클�태 수정 DTO (전체 필드 선택적)
 */
export class UpdateComplaintDto extends PartialType(CreateComplaintDto) {}

/**
 * 고객클�태 목록 조회 쿼리 DTO
 */
export class ComplaintQueryDto {
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

  @ApiPropertyOptional({ description: '상태 필터' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ description: '클�태 유형 필터' })
  @IsOptional()
  @IsString()
  complaintType?: string;

  @ApiPropertyOptional({ description: '긴급도 필터' })
  @IsOptional()
  @IsString()
  urgency?: string;

  @ApiPropertyOptional({ description: '고객 코드 필터' })
  @IsOptional()
  @IsString()
  customerCode?: string;

  @ApiPropertyOptional({ description: '검색어 (클�태번호, 고객명, 품목코드)' })
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
 * 조사 시작 DTO (RECEIVED → INVESTIGATING)
 */
export class InvestigateComplaintDto {
  @ApiPropertyOptional({ description: '조사 내용', maxLength: 2000 })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  investigation?: string;

  @ApiPropertyOptional({ description: '근본 원인', maxLength: 2000 })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  rootCause?: string;

  @ApiPropertyOptional({ description: '긴급 봉쇄 조치', maxLength: 1000 })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  containmentAction?: string;
}

/**
 * 대응 완료 DTO (INVESTIGATING → RESPONDING)
 */
export class RespondComplaintDto {
  @ApiPropertyOptional({ description: '시정 조치', maxLength: 1000 })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  correctiveAction?: string;

  @ApiPropertyOptional({ description: '예방 조치', maxLength: 1000 })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  preventiveAction?: string;

  @ApiPropertyOptional({ description: '회신일 (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  responseDate?: string;
}

/**
 * CAPA 연계 DTO
 */
export class LinkCapaDto {
  @ApiProperty({ description: '연계할 CAPA ID' })
  @IsString()
  @MaxLength(30)
  capaId: string;
}
