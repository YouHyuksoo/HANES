/**
 * @file src/modules/material/dto/lot-merge.dto.ts
 * @description 자재 LOT 병합 관련 DTO
 *
 * 초보자 가이드:
 * 1. 같은 LOT 번호(기본단위)의 자재만 병합 가능
 * 2. 2개 이상의 LOT ID를 선택하여 하나의 LOT으로 합산
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsArray, ArrayMinSize, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';
import { IsInt, Min, Max } from 'class-validator';

export class LotMergeDto {
  @ApiProperty({ description: '병합할 LOT ID 목록 (2개 이상)', type: [String] })
  @IsArray()
  @ArrayMinSize(2)
  @IsString({ each: true })
  sourceLotIds: string[];

  @ApiPropertyOptional({ description: '병합 대상(수신) LOT ID — 미지정 시 첫 번째 LOT이 대상' })
  @IsOptional()
  @IsString()
  targetLotId?: string;

  @ApiPropertyOptional({ description: '비고' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  remark?: string;
}

export class LotMergeQueryDto {
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

  @ApiPropertyOptional({ description: '검색 (로트번호, 품목코드)' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: '품목 ID 필터' })
  @IsOptional()
  @IsString()
  partId?: string;
}
