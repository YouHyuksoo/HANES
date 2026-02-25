/**
 * @file src/modules/master/dto/iqc-item-pool.dto.ts
 * @description IQC 검사항목 풀 CRUD DTO
 *
 * 초보자 가이드:
 * 1. **CreateIqcItemPoolDto**: 검사항목 생성 (항목코드, 이름, 판정방법, 규격)
 * 2. **UpdateIqcItemPoolDto**: 검사항목 수정 (모든 필드 optional)
 * 3. **IqcItemPoolQueryDto**: 목록 조회 필터 (검색, 판정방법, 사용여부)
 */

import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsInt,
  Min,
  Max,
  MaxLength,
  IsIn,
  IsNumber,
  IsDateString,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateIqcItemPoolDto {
  @ApiProperty({ description: '항목코드', example: 'IQC-001' })
  @IsString()
  @MaxLength(20)
  inspItemCode: string;

  @ApiProperty({ description: '항목명', example: '외관검사(전선)' })
  @IsString()
  @MaxLength(100)
  inspItemName: string;

  @ApiProperty({ description: '판정방법 (VISUAL/MEASURE)', example: 'VISUAL' })
  @IsString()
  @IsIn(['VISUAL', 'MEASURE'])
  judgeMethod: string;

  @ApiPropertyOptional({ description: '판정기준', example: '이물/손상 없을것' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  criteria?: string;

  @ApiPropertyOptional({ description: '하한값 (계측 시)', example: 0.4 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  lsl?: number;

  @ApiPropertyOptional({ description: '상한값 (계측 시)', example: 0.6 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  usl?: number;

  @ApiPropertyOptional({ description: '단위 (계측 시)', example: 'mm' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  unit?: string;

  @ApiPropertyOptional({ description: '리비전', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  revision?: number;

  @ApiPropertyOptional({ description: '시행일' })
  @IsOptional()
  @IsDateString()
  effectiveDate?: string;

  @ApiPropertyOptional({ description: '사용 여부', default: 'Y' })
  @IsOptional()
  @IsString()
  @IsIn(['Y', 'N'])
  useYn?: string;

  @ApiPropertyOptional({ description: '비고' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  remark?: string;
}

export class UpdateIqcItemPoolDto extends PartialType(CreateIqcItemPoolDto) {}

export class IqcItemPoolQueryDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10000)
  limit?: number = 50;

  @ApiPropertyOptional({ description: '검색 (항목코드/항목명)' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: '판정방법 필터' })
  @IsOptional()
  @IsString()
  @IsIn(['VISUAL', 'MEASURE'])
  judgeMethod?: string;

  @ApiPropertyOptional({ description: '사용여부' })
  @IsOptional()
  @IsString()
  @IsIn(['Y', 'N'])
  useYn?: string;
}
