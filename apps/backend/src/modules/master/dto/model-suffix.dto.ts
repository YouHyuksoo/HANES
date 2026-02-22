/**
 * @file src/modules/master/dto/model-suffix.dto.ts
 * @description 모델접미사 관련 DTO 정의
 *
 * 초보자 가이드:
 * 1. **CreateModelSuffixDto**: 모델 코드별 접미사 코드 생성
 * 2. **ModelSuffixQueryDto**: modelCode, customer 필터 지원
 */

import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsString, IsOptional, IsInt, Min, Max, MaxLength, IsIn } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateModelSuffixDto {
  @ApiProperty({ description: '모델 코드', example: 'MAIN-A' })
  @IsString()
  @MaxLength(100)
  modelCode: string;

  @ApiProperty({ description: '접미사 코드', example: 'LHD' })
  @IsString()
  @MaxLength(50)
  suffixCode: string;

  @ApiProperty({ description: '접미사명', example: '좌핸들' })
  @IsString()
  @MaxLength(200)
  suffixName: string;

  @ApiPropertyOptional({ description: '고객사' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  customer?: string;

  @ApiPropertyOptional({ description: '비고' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  remark?: string;

  @ApiPropertyOptional({ description: '사용 여부', default: 'Y' })
  @IsOptional()
  @IsString()
  @IsIn(['Y', 'N'])
  useYn?: string;
}

export class UpdateModelSuffixDto extends PartialType(CreateModelSuffixDto) {}

export class ModelSuffixQueryDto {
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
  @Max(200)
  limit?: number = 50;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  modelCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  customer?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsIn(['Y', 'N'])
  useYn?: string;
}
