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
import { PaginationQueryDto } from '../../../common/dto/base-query.dto';

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

export class ProductHoldQueryDto extends PaginationQueryDto {


  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: ['HOLD', 'NORMAL'] })
  @IsOptional()
  @IsString()
  @IsIn(['HOLD', 'NORMAL'])
  status?: string;

  @ApiPropertyOptional({ enum: ['SEMI_PRODUCT', 'FINISHED'] })
  @IsOptional()
  @IsString()
  @IsIn(['SEMI_PRODUCT', 'FINISHED'])
  itemType?: string;
}
