/**
 * @file src/modules/master/dto/iqc-item.dto.ts
 * @description IQC 검사항목마스터 관련 DTO 정의
 *
 * 초보자 가이드:
 * 1. **CreateIqcItemDto**: 품목별 IQC 검사항목 생성 (LSL/USL 규격)
 * 2. **IqcItemQueryDto**: itemCode 기반 필터링 지원
 */

import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsString, IsOptional, IsInt, Min, Max, MaxLength, IsIn, IsNumber, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateIqcItemDto {
  @ApiProperty({ description: '품목 코드' })
  @IsString()
  itemCode: string;

  @ApiProperty({ description: '검사 순서', example: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  seq: number;

  @ApiProperty({ description: '검사항목명', example: '외관검사' })
  @IsString()
  @MaxLength(200)
  inspectItem: string;

  @ApiPropertyOptional({ description: '규격' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  spec?: string;

  @ApiPropertyOptional({ description: '하한 규격' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  lsl?: number;

  @ApiPropertyOptional({ description: '상한 규격' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  usl?: number;

  @ApiPropertyOptional({ description: '단위' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  unit?: string;

  @ApiPropertyOptional({ description: '유수명 여부', default: false })
  @IsOptional()
  @IsBoolean()
  isShelfLife?: boolean;

  @ApiPropertyOptional({ description: '재검사 주기 (일)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  retestCycle?: number;

  @ApiPropertyOptional({ description: '사용 여부', default: 'Y' })
  @IsOptional()
  @IsString()
  @IsIn(['Y', 'N'])
  useYn?: string;
}

export class UpdateIqcItemDto extends PartialType(CreateIqcItemDto) {}

export class IqcItemQueryDto {
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

  @ApiPropertyOptional({ description: '품목 코드 필터' })
  @IsOptional()
  @IsString()
  itemCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsIn(['Y', 'N'])
  useYn?: string;
}
