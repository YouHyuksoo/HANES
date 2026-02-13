/**
 * @file src/modules/material/dto/iqc-history.dto.ts
 * @description IQC 이력 조회 전용 DTO
 */

import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsInt, Min, Max, IsDateString, IsIn } from 'class-validator';
import { Type } from 'class-transformer';

export class IqcHistoryQueryDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 10;

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
