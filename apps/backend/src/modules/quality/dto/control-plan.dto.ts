/**
 * @file control-plan.dto.ts
 * @description 관리계획서(Control Plan) DTO — 생성, 수정, 항목, 조회 필터
 *
 * 초보자 가이드:
 * 1. **CreateControlPlanDto**: 관리계획서 등록 (품목, 단계, 비고 + 항목 배열)
 * 2. **UpdateControlPlanDto**: 수정 (PartialType으로 전체 필드 선택적)
 * 3. **CreateControlPlanItemDto**: 개별 관리 항목 (공정, 특성, 규격, 관리방법 등)
 * 4. **ControlPlanFilterDto**: 목록 조회 필터/페이지네이션
 */

import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsInt,
  IsIn,
  IsDateString,
  IsArray,
  ValidateNested,
  Min,
  Max,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * 관리계획서 항목 DTO
 */
export class CreateControlPlanItemDto {
  @ApiProperty({ description: '순번' })
  @IsInt()
  seq: number;

  @ApiPropertyOptional({ description: '공정코드', maxLength: 50 })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  processCode?: string;

  @ApiProperty({ description: '공정명', maxLength: 200 })
  @IsString()
  @MaxLength(200)
  processName: string;

  @ApiPropertyOptional({ description: '특성번호', maxLength: 30 })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  characteristicNo?: string;

  @ApiPropertyOptional({ description: '제품특성', maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  productCharacteristic?: string;

  @ApiPropertyOptional({ description: '공정특성', maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  processCharacteristic?: string;

  @ApiPropertyOptional({
    description: '특별특성 분류',
    enum: ['CC', 'SC', 'HI', ''],
  })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  specialCharClass?: string;

  @ApiPropertyOptional({ description: '규격', maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  specification?: string;

  @ApiPropertyOptional({ description: '평가방법', maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  evalMethod?: string;

  @ApiPropertyOptional({ description: '시료수', maxLength: 50 })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  sampleSize?: string;

  @ApiPropertyOptional({ description: '시료주기', maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  sampleFreq?: string;

  @ApiPropertyOptional({ description: '관리방법', maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  controlMethod?: string;

  @ApiPropertyOptional({ description: '이상 시 대응계획', maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reactionPlan?: string;

  @ApiPropertyOptional({ description: '비고', maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  remarks?: string;
}

/**
 * 관리계획서 등록 DTO
 */
export class CreateControlPlanDto {
  @ApiProperty({ description: '품목코드', maxLength: 50 })
  @IsString()
  @MaxLength(50)
  itemCode: string;

  @ApiPropertyOptional({ description: '품목명', maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  itemName?: string;

  @ApiProperty({
    description: '단계',
    enum: ['PROTOTYPE', 'PRE_LAUNCH', 'PRODUCTION'],
  })
  @IsIn(['PROTOTYPE', 'PRE_LAUNCH', 'PRODUCTION'])
  phase: string;

  @ApiPropertyOptional({ description: '비고', maxLength: 1000 })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  remarks?: string;

  @ApiPropertyOptional({
    description: '관리 항목 배열',
    type: [CreateControlPlanItemDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateControlPlanItemDto)
  items?: CreateControlPlanItemDto[];
}

/**
 * 관리계획서 수정 DTO (전체 필드 선택적)
 */
export class UpdateControlPlanDto extends PartialType(CreateControlPlanDto) {}

/**
 * 관리계획서 목록 조회 필터 DTO
 */
export class ControlPlanFilterDto {
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
    enum: ['DRAFT', 'REVIEW', 'APPROVED', 'OBSOLETE'],
  })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({
    description: '단계 필터',
    enum: ['PROTOTYPE', 'PRE_LAUNCH', 'PRODUCTION'],
  })
  @IsOptional()
  @IsString()
  phase?: string;

  @ApiPropertyOptional({ description: '품목코드 필터' })
  @IsOptional()
  @IsString()
  itemCode?: string;

  @ApiPropertyOptional({ description: '검색어 (관리계획번호, 품목명)' })
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
