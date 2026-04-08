/**
 * @file fai.dto.ts
 * @description 초물검사(FAI) DTO — 생성, 수정, 조회, 완료, 승인, 검사항목
 *
 * 초보자 가이드:
 * 1. **CreateFaiDto**: FAI 요청 등록 (트리거 유형, 품목, 샘플 수량 등)
 * 2. **UpdateFaiDto**: 수정 (PartialType으로 전체 필드 선택적)
 * 3. **FaiQueryDto**: 목록 조회 필터/페이지네이션
 * 4. **CompleteFaiDto**: 검사 완료 시 최종 판정 (PASS/FAIL/CONDITIONAL)
 * 5. **FaiItemDto**: 검사항목 개별 측정 데이터
 *
 * 상태 흐름: REQUESTED → SAMPLING → INSPECTING → PASS / FAIL / CONDITIONAL
 */

import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsNumber,
  IsInt,
  IsIn,
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
 * 검사항목 DTO — 항목별 규격/측정값/판정
 */
export class FaiItemDto {
  @ApiProperty({ description: '검사 순서' })
  @Type(() => Number)
  @IsInt()
  seq: number;

  @ApiProperty({ description: '검사 항목명', maxLength: 200 })
  @IsString()
  @MaxLength(200)
  inspectItem: string;

  @ApiPropertyOptional({ description: '규격 하한' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  specMin?: number;

  @ApiPropertyOptional({ description: '규격 상한' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  specMax?: number;

  @ApiPropertyOptional({ description: '측정값' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  measuredValue?: number;

  @ApiPropertyOptional({ description: '단위', maxLength: 20 })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  unit?: string;

  @ApiPropertyOptional({ description: '판정 (OK/NG)', enum: ['OK', 'NG'] })
  @IsOptional()
  @IsIn(['OK', 'NG'])
  result?: string;

  @ApiPropertyOptional({ description: '비고', maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  remark?: string;
}

/**
 * 초물검사 요청 생성 DTO
 */
export class CreateFaiDto {
  @ApiProperty({
    description: '트리거 유형',
    enum: ['NEW_PART', 'ECN', 'PROCESS_CHANGE', 'LONG_STOP'],
  })
  @IsIn(['NEW_PART', 'ECN', 'PROCESS_CHANGE', 'LONG_STOP'])
  triggerType: string;

  @ApiPropertyOptional({ description: '변경점 참조 번호', maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  triggerRef?: string;

  @ApiProperty({ description: '검사 품목 코드', maxLength: 50 })
  @IsString()
  @MaxLength(50)
  itemCode: string;

  @ApiPropertyOptional({ description: '작업지시 번호', maxLength: 50 })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  orderNo?: string;

  @ApiPropertyOptional({ description: '라인 코드', maxLength: 50 })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  lineCode?: string;

  @ApiProperty({ description: '샘플 수량', minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  sampleQty: number;

  @ApiPropertyOptional({ description: '검사자 코드', maxLength: 50 })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  inspectorCode?: string;

  @ApiPropertyOptional({ description: '비고', maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  remark?: string;

  @ApiPropertyOptional({ description: '검사항목 목록', type: [FaiItemDto] })
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => FaiItemDto)
  @IsArray()
  items?: FaiItemDto[];
}

/**
 * 초물검사 수정 DTO (전체 필드 선택적)
 */
export class UpdateFaiDto extends PartialType(CreateFaiDto) {}

/**
 * 초물검사 목록 조회 쿼리 DTO
 */
export class FaiQueryDto extends PaginationQueryDto {


  @ApiPropertyOptional({ description: '상태 필터' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ description: '트리거 유형 필터' })
  @IsOptional()
  @IsString()
  triggerType?: string;

  @ApiPropertyOptional({ description: '검색어 (FAI번호, 품목코드)' })
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
 * 초물검사 완료 DTO — 최종 판정
 */
export class CompleteFaiDto {
  @ApiProperty({
    description: '최종 판정',
    enum: ['PASS', 'FAIL', 'CONDITIONAL'],
  })
  @IsIn(['PASS', 'FAIL', 'CONDITIONAL'])
  result: string;

  @ApiPropertyOptional({ description: '비고', maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  remark?: string;
}
