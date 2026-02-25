/**
 * @file src/modules/quality/dto/oqc.dto.ts
 * @description OQC(출하검사) 관련 DTO 정의
 *
 * 초보자 가이드:
 * 1. **CreateOqcRequestDto**: OQC 의뢰 생성 시 사용
 * 2. **ExecuteOqcInspectionDto**: 검사 실행 및 판정 시 사용
 * 3. **UpdateOqcResultDto**: 결과 수정 시 사용
 * 4. **OqcRequestQueryDto**: 목록 조회 필터/페이지네이션
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsInt,
  IsDateString,
  IsArray,
  IsIn,
  Min,
  Max,
  MaxLength,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';

/** OQC 의뢰 생성 DTO */
export class CreateOqcRequestDto {
  @ApiProperty({ description: '품목 ID' })
  @IsString()
  itemCode: string;

  @ApiProperty({ description: '박스 ID 배열', type: [String] })
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  boxIds: string[];

  @ApiPropertyOptional({ description: '고객사', maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  customer?: string;

  @ApiPropertyOptional({ description: '의뢰일 (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  requestDate?: string;

  @ApiPropertyOptional({ description: '샘플 수량' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  sampleSize?: number;
}

/** OQC 검사 실행 DTO */
export class ExecuteOqcInspectionDto {
  @ApiProperty({ description: '판정 결과', enum: ['PASS', 'FAIL'] })
  @IsIn(['PASS', 'FAIL'])
  result: string;

  @ApiPropertyOptional({ description: '검사 상세 데이터 (JSON 문자열)' })
  @IsOptional()
  @IsString()
  details?: string;

  @ApiPropertyOptional({ description: '검사자명', maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  inspectorName?: string;

  @ApiPropertyOptional({ description: '샘플 박스 ID 배열', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  sampleBoxIds?: string[];
}

/** OQC 결과 수정 DTO */
export class UpdateOqcResultDto {
  @ApiPropertyOptional({ description: '판정 결과', enum: ['PASS', 'FAIL'] })
  @IsOptional()
  @IsIn(['PASS', 'FAIL'])
  result?: string;

  @ApiPropertyOptional({ description: '검사 상세 데이터 (JSON 문자열)' })
  @IsOptional()
  @IsString()
  details?: string;

  @ApiPropertyOptional({ description: '검사자명', maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  inspectorName?: string;

  @ApiPropertyOptional({ description: '비고', maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  remark?: string;
}

/** OQC 의뢰 목록 조회 쿼리 DTO */
export class OqcRequestQueryDto {
  @ApiPropertyOptional({ description: '페이지 번호', default: 1 })
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

  @ApiPropertyOptional({ description: '검색어 (의뢰번호, 품번, 품명)' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: '상태 필터', enum: ['PENDING', 'IN_PROGRESS', 'PASS', 'FAIL'] })
  @IsOptional()
  @IsIn(['PENDING', 'IN_PROGRESS', 'PASS', 'FAIL'])
  status?: string;

  @ApiPropertyOptional({ description: '고객사 필터' })
  @IsOptional()
  @IsString()
  customer?: string;

  @ApiPropertyOptional({ description: '시작일 (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @ApiPropertyOptional({ description: '종료일 (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  toDate?: string;
}
