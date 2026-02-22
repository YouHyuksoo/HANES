/**
 * @file src/modules/production/dto/sample-inspect.dto.ts
 * @description 반제품 샘플검사 입력/조회 DTO
 *
 * 초보자 가이드:
 * 1. **CreateSampleInspectDto**: 샘플검사 일괄 입력 (헤더 + 샘플 배열)
 * 2. **SampleInspectQueryDto**: 이력 조회 조건 (날짜, 합불, 검색어)
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsInt,
  IsDateString,
  IsArray,
  ValidateNested,
  IsIn,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';

/** 개별 샘플 측정값 */
export class SampleMeasurementDto {
  @ApiProperty({ description: '샘플 번호', example: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  sampleNo: number;

  @ApiPropertyOptional({ description: '측정값', example: '12.5' })
  @IsOptional()
  @IsString()
  measuredValue?: string;

  @ApiPropertyOptional({ description: '상한치', example: '13.0' })
  @IsOptional()
  @IsString()
  specUpper?: string;

  @ApiPropertyOptional({ description: '하한치', example: '12.0' })
  @IsOptional()
  @IsString()
  specLower?: string;

  @ApiProperty({ description: '합불 판정 (Y/N)', example: 'Y' })
  @IsString()
  @IsIn(['Y', 'N'])
  passYn: string;

  @ApiPropertyOptional({ description: '비고' })
  @IsOptional()
  @IsString()
  remark?: string;
}

/** 샘플검사 일괄 입력 DTO */
export class CreateSampleInspectDto {
  @ApiProperty({ description: '작업지시 ID' })
  @IsString()
  jobOrderId: string;

  @ApiProperty({ description: '검사일', example: '2026-02-21' })
  @IsDateString()
  inspectDate: string;

  @ApiProperty({ description: '검사자명', example: '검사원A' })
  @IsString()
  inspectorName: string;

  @ApiPropertyOptional({ description: '검사 유형', example: '치수검사' })
  @IsOptional()
  @IsString()
  inspectType?: string;

  @ApiProperty({ description: '샘플 측정값 배열', type: [SampleMeasurementDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SampleMeasurementDto)
  samples: SampleMeasurementDto[];
}

/** 샘플검사 이력 조회 DTO */
export class SampleInspectHistoryQueryDto {
  @ApiPropertyOptional({ description: '합격 여부 (Y/N)' })
  @IsOptional()
  @IsString()
  @IsIn(['Y', 'N'])
  passYn?: string;

  @ApiPropertyOptional({ description: '검사일 시작' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ description: '검사일 종료' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({ description: '검색어 (작업지시번호, 품목코드, 품목명, 검사자)' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: '조회 건수', default: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number = 50;
}
