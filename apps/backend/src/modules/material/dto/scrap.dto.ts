/**
 * @file src/modules/material/dto/scrap.dto.ts
 * @description 자재폐기 관련 DTO
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsInt, Min, Max, MaxLength, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateScrapDto {
  @ApiProperty({ description: 'LOT ID' })
  @IsString()
  lotId: string;

  @ApiProperty({ description: '창고 ID (출고 창고)' })
  @IsString()
  warehouseId: string;

  @ApiProperty({ description: '폐기 수량' })
  @IsInt()
  @Min(1)
  qty: number;

  @ApiProperty({ description: '폐기 사유' })
  @IsString()
  @MaxLength(500)
  reason: string;

  @ApiPropertyOptional({ description: '작업자 ID' })
  @IsOptional()
  @IsString()
  workerId?: string;
}

export class ScrapQueryDto {
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

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  toDate?: string;
}
