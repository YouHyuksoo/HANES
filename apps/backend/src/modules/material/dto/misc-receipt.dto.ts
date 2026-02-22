/**
 * @file src/modules/material/dto/misc-receipt.dto.ts
 * @description 기타입고 관련 DTO
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsInt, Min, Max, MaxLength, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateMiscReceiptDto {
  @ApiProperty({ description: '입고 창고 ID' })
  @IsString()
  warehouseId: string;

  @ApiProperty({ description: '품목 ID' })
  @IsString()
  partId: string;

  @ApiPropertyOptional({ description: 'LOT ID' })
  @IsOptional()
  @IsString()
  lotId?: string;

  @ApiProperty({ description: '입고 수량' })
  @IsInt()
  @Min(1)
  qty: number;

  @ApiPropertyOptional({ description: '비고' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  remark?: string;

  @ApiPropertyOptional({ description: '작업자 ID' })
  @IsOptional()
  @IsString()
  workerId?: string;
}

export class MiscReceiptQueryDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 5000 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10000)
  limit?: number = 5000;

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
