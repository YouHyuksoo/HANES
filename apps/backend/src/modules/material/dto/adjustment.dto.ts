/**
 * @file src/modules/material/dto/adjustment.dto.ts
 * @description 재고보정 관련 DTO
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsInt, Min, Max, MaxLength, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateAdjustmentDto {
  @ApiProperty({ description: '창고 코드' })
  @IsString()
  warehouseCode: string;

  @ApiProperty({ description: '품목 코드' })
  @IsString()
  itemCode: string;

  @ApiPropertyOptional({ description: 'LOT ID' })
  @IsOptional()
  @IsString()
  lotId?: string;

  @ApiProperty({ description: '보정 후 수량' })
  @IsInt()
  @Min(0)
  afterQty: number;

  @ApiProperty({ description: '보정 사유' })
  @IsString()
  @MaxLength(500)
  reason: string;

  @ApiPropertyOptional({ description: '작성자' })
  @IsOptional()
  @IsString()
  createdBy?: string;
}

export class AdjustmentQueryDto {
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

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  toDate?: string;
}
