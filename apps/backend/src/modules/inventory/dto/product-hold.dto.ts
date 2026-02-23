/**
 * @file src/modules/inventory/dto/product-hold.dto.ts
 * @description 제품 재고 홀드 관련 DTO
 *
 * 초보자 가이드:
 * - 제품 재고(PRODUCT_STOCKS) 레벨에서 홀드/해제 처리
 * - 홀드된 제품은 출하 불가
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsInt, Min, Max, MaxLength, IsIn } from 'class-validator';
import { Type } from 'class-transformer';

export class ProductHoldActionDto {
  @ApiProperty({ description: '제품 재고 ID (PRODUCT_STOCKS.ID)' })
  @IsString()
  stockId: string;

  @ApiProperty({ description: '홀드 사유' })
  @IsString()
  @MaxLength(500)
  reason: string;
}

export class ProductReleaseHoldDto {
  @ApiProperty({ description: '제품 재고 ID (PRODUCT_STOCKS.ID)' })
  @IsString()
  stockId: string;

  @ApiPropertyOptional({ description: '해제 사유' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class ProductHoldQueryDto {
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

  @ApiPropertyOptional({ enum: ['HOLD', 'NORMAL'] })
  @IsOptional()
  @IsString()
  @IsIn(['HOLD', 'NORMAL'])
  status?: string;

  @ApiPropertyOptional({ enum: ['WIP', 'FG'] })
  @IsOptional()
  @IsString()
  @IsIn(['WIP', 'FG'])
  partType?: string;
}
