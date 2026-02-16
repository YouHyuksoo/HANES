/**
 * @file src/modules/quality/dto/inspect-result.dto.ts
 * @description 검사실적 관련 DTO 정의
 *
 * 초보자 가이드:
 * 1. **CreateDto**: 검사 결과 등록 시 필요한 필드
 * 2. **UpdateDto**: 검사 결과 수정 시 필요한 필드 (모두 선택적)
 * 3. **QueryDto**: 목록 조회 시 필터링/페이지네이션 옵션
 *
 * 실제 DB 스키마 (inspect_results 테이블):
 * - prodResultId: 생산실적 ID (외래키)
 * - serialNo: 개별 제품 시리얼 번호 (선택)
 * - inspectType: 검사 유형 (CONTINUITY, VISUAL, DIMENSION)
 * - passYn: 합격 여부 ('Y'/'N')
 * - inspectData: 검사 데이터 (JSON)
 */

import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsInt,
  IsObject,
  IsDateString,
  Min,
  Max,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * 검사실적 생성 DTO
 */
export class CreateInspectResultDto {
  @ApiProperty({ description: '생산실적 ID', example: 'clx1234567890' })
  @IsString()
  prodResultId: string;

  @ApiPropertyOptional({ description: '시리얼 번호', maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  serialNo?: string;

  @ApiPropertyOptional({
    description: '검사 유형',
    example: 'CONTINUITY',
    enum: ['CONTINUITY', 'VISUAL', 'DIMENSION', 'FUNCTION'],
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  inspectType?: string;

  @ApiPropertyOptional({ description: '합격 여부', default: 'Y', enum: ['Y', 'N'] })
  @IsOptional()
  @IsString()
  passYn?: string;

  @ApiPropertyOptional({ description: '에러 코드', maxLength: 50 })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  errorCode?: string;

  @ApiPropertyOptional({ description: '에러 상세', maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  errorDetail?: string;

  @ApiPropertyOptional({
    description: '검사 데이터 (JSON)',
    example: { resistance: 0.5, voltage: 12.3 },
  })
  @IsOptional()
  @IsObject()
  inspectData?: Record<string, unknown>;

  @ApiPropertyOptional({ description: '검사 시간 (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  inspectAt?: string;

  @ApiPropertyOptional({ description: '검사자 ID' })
  @IsOptional()
  @IsString()
  inspectorId?: string;
}

/**
 * 검사실적 수정 DTO
 */
export class UpdateInspectResultDto extends PartialType(CreateInspectResultDto) {}

/**
 * 검사실적 목록 조회 쿼리 DTO
 */
export class InspectResultQueryDto {
  @ApiPropertyOptional({ description: '페이지 번호', default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: '페이지 크기', default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({ description: '생산실적 ID로 필터링' })
  @IsOptional()
  @IsString()
  prodResultId?: string;

  @ApiPropertyOptional({ description: '시리얼 번호로 검색' })
  @IsOptional()
  @IsString()
  serialNo?: string;

  @ApiPropertyOptional({ description: '검사 유형으로 필터링', enum: ['CONTINUITY', 'VISUAL', 'DIMENSION', 'FUNCTION'] })
  @IsOptional()
  @IsString()
  inspectType?: string;

  @ApiPropertyOptional({ description: '합격 여부 필터', enum: ['Y', 'N'] })
  @IsOptional()
  @IsString()
  passYn?: string;

  @ApiPropertyOptional({ description: '검사 시작 날짜 (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ description: '검사 종료 날짜 (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  endDate?: string;
}

/**
 * 검사 합격률 통계 응답 DTO
 */
export class InspectPassRateDto {
  @ApiProperty({ description: '전체 검사 수' })
  totalCount: number;

  @ApiProperty({ description: '합격 수' })
  passCount: number;

  @ApiProperty({ description: '불합격 수' })
  failCount: number;

  @ApiProperty({ description: '합격률 (%)' })
  passRate: number;
}

/**
 * 검사 유형별 통계 응답 DTO
 */
export class InspectTypeStatsDto {
  @ApiProperty({ description: '검사 유형' })
  inspectType: string;

  @ApiProperty({ description: '전체 검사 수' })
  totalCount: number;

  @ApiProperty({ description: '합격 수' })
  passCount: number;

  @ApiProperty({ description: '합격률 (%)' })
  passRate: number;
}
