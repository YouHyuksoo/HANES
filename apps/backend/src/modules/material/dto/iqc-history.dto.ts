/**
 * @file src/modules/material/dto/iqc-history.dto.ts
 * @description IQC 이력 조회 전용 DTO
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsInt, Min, Max, IsDateString, IsIn, IsNotEmpty } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateIqcResultDto {
  @ApiProperty({ description: 'LOT ID' })
  @IsString()
  lotId: string;

  @ApiProperty({ description: '검사 결과', enum: ['PASS', 'FAIL'] })
  @IsString()
  @IsIn(['PASS', 'FAIL'])
  result: string;

  @ApiPropertyOptional({ description: '검사자' })
  @IsOptional()
  @IsString()
  inspectorName?: string;

  @ApiPropertyOptional({ description: '비고' })
  @IsOptional()
  @IsString()
  remark?: string;

  @ApiPropertyOptional({ description: '검사유형', enum: ['INITIAL', 'RETEST'], default: 'INITIAL' })
  @IsOptional()
  @IsString()
  @IsIn(['INITIAL', 'RETEST'])
  inspectType?: string;

  @ApiPropertyOptional({ description: '검사항목별 계측값 상세 (JSON)' })
  @IsOptional()
  @IsString()
  details?: string;
}

export class CancelIqcResultDto {
  @ApiProperty({ description: '취소 사유' })
  @IsString()
  @IsNotEmpty()
  reason: string;
}

export class IqcHistoryQueryDto {
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

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: ['INITIAL', 'RETEST'] })
  @IsOptional()
  @IsString()
  @IsIn(['INITIAL', 'RETEST'])
  inspectType?: string;

  @ApiPropertyOptional({ enum: ['PASS', 'FAIL'] })
  @IsOptional()
  @IsString()
  @IsIn(['PASS', 'FAIL'])
  result?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  toDate?: string;
}
