/**
 * @file msa.dto.ts
 * @description MSA(측정시스템분석) DTO — 계측기 마스터 및 교정 이력
 *
 * 초보자 가이드:
 * 1. **CreateGaugeDto**: 계측기 등록 시 사용 (코드, 명칭, 유형, 교정주기 등)
 * 2. **UpdateGaugeDto**: 수정 시 사용 (PartialType으로 전체 필드 선택적)
 * 3. **CreateCalibrationDto**: 교정 이력 등록 (계측기ID, 교정일, 유형, 결과 등)
 * 4. **GaugeFilterDto**: 계측기 목록 조회 필터/페이지네이션
 * 5. **CalibrationFilterDto**: 교정 이력 목록 조회 필터/페이지네이션
 */

import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsInt,
  IsIn,
  IsDateString,
  IsNumber,
  Min,
  Max,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PaginationQueryDto } from '../../../../common/dto/base-query.dto';

// =============================================
// 계측기 마스터 DTO
// =============================================

/**
 * 계측기 등록 DTO
 */
export class CreateGaugeDto {
  @ApiProperty({ description: '계측기 코드', maxLength: 50 })
  @IsString()
  @MaxLength(50)
  gaugeCode: string;

  @ApiProperty({ description: '계측기 명칭', maxLength: 200 })
  @IsString()
  @MaxLength(200)
  gaugeName: string;

  @ApiProperty({ description: '계측기 유형', maxLength: 50 })
  @IsString()
  @MaxLength(50)
  gaugeType: string;

  @ApiPropertyOptional({ description: '제조사', maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  manufacturer?: string;

  @ApiPropertyOptional({ description: '모델명', maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  model?: string;

  @ApiPropertyOptional({ description: '시리얼 번호', maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  serialNo?: string;

  @ApiPropertyOptional({ description: '분해능' })
  @IsOptional()
  @IsNumber()
  resolution?: number;

  @ApiPropertyOptional({ description: '측정 범위', maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  measureRange?: string;

  @ApiProperty({ description: '교정 주기 (개월)', minimum: 1 })
  @IsInt()
  @Min(1)
  calibrationCycle: number;

  @ApiPropertyOptional({ description: '최종 교정일 (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  lastCalibrationDate?: string;

  @ApiPropertyOptional({ description: '다음 교정일 (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  nextCalibrationDate?: string;

  @ApiPropertyOptional({
    description: '상태',
    enum: ['ACTIVE', 'EXPIRED', 'SCRAPPED'],
    default: 'ACTIVE',
  })
  @IsOptional()
  @IsIn(['ACTIVE', 'EXPIRED', 'SCRAPPED'])
  status?: string;

  @ApiPropertyOptional({ description: '보관 위치', maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  location?: string;

  @ApiPropertyOptional({ description: '담당자', maxLength: 50 })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  responsiblePerson?: string;
}

/**
 * 계측기 수정 DTO (전체 필드 선택적)
 */
export class UpdateGaugeDto extends PartialType(CreateGaugeDto) {}

/**
 * 계측기 목록 조회 필터 DTO
 */
export class GaugeFilterDto extends PaginationQueryDto {


  @ApiPropertyOptional({ description: '상태 필터 (ACTIVE/EXPIRED/SCRAPPED)' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ description: '계측기 유형 필터' })
  @IsOptional()
  @IsString()
  gaugeType?: string;

  @ApiPropertyOptional({ description: '검색어 (코드, 명칭)' })
  @IsOptional()
  @IsString()
  search?: string;
}

// =============================================
// 교정 이력 DTO
// =============================================

/**
 * 교정 이력 등록 DTO
 */
export class CreateCalibrationDto {
  @ApiProperty({ description: '계측기 코드' })
  @IsString()
  gaugeId: string;

  @ApiProperty({ description: '교정일 (ISO 8601)' })
  @IsDateString()
  calibrationDate: string;

  @ApiProperty({
    description: '교정 유형',
    enum: ['INTERNAL', 'EXTERNAL'],
  })
  @IsIn(['INTERNAL', 'EXTERNAL'])
  calibrationType: string;

  @ApiPropertyOptional({ description: '교정 수행자', maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  calibrator?: string;

  @ApiPropertyOptional({ description: '교정 기관', maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  calibrationOrg?: string;

  @ApiPropertyOptional({ description: '사용 표준기', maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  standardUsed?: string;

  @ApiProperty({
    description: '교정 결과',
    enum: ['PASS', 'FAIL', 'CONDITIONAL'],
  })
  @IsIn(['PASS', 'FAIL', 'CONDITIONAL'])
  result: string;

  @ApiPropertyOptional({ description: '측정값' })
  @IsOptional()
  @IsNumber()
  measuredValue?: number;

  @ApiPropertyOptional({ description: '기준값' })
  @IsOptional()
  @IsNumber()
  referenceValue?: number;

  @ApiPropertyOptional({ description: '편차' })
  @IsOptional()
  @IsNumber()
  deviation?: number;

  @ApiPropertyOptional({ description: '불확도' })
  @IsOptional()
  @IsNumber()
  uncertainty?: number;

  @ApiPropertyOptional({ description: '다음 교정 예정일 (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  nextDueDate?: string;

  @ApiPropertyOptional({ description: '성적서 번호', maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  certificateNo?: string;

  @ApiPropertyOptional({ description: '비고', maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  remark?: string;
}

/**
 * 교정 이력 목록 조회 필터 DTO
 */
export class CalibrationFilterDto extends PaginationQueryDto {


  @ApiPropertyOptional({ description: '계측기 코드 필터' })
  @IsOptional()
  @IsString()
  gaugeId?: string;

  @ApiPropertyOptional({ description: '교정 유형 필터 (INTERNAL/EXTERNAL)' })
  @IsOptional()
  @IsString()
  calibrationType?: string;

  @ApiPropertyOptional({ description: '결과 필터 (PASS/FAIL/CONDITIONAL)' })
  @IsOptional()
  @IsString()
  result?: string;

  @ApiPropertyOptional({ description: '조회 시작일 (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ description: '조회 종료일 (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  endDate?: string;
}
