/**
 * @file src/modules/material/dto/mat-stock.dto.ts
 * @description 재고 관련 DTO 정의
 *
 * 초보자 가이드:
 * 1. **StockQueryDto**: 재고 목록 조회 필터
 * 2. **StockAdjustDto**: 재고 조정 (실사, 손실 등)
 * 3. **StockTransferDto**: 창고간 재고 이동
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsInt, Min, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';
import { BaseListQueryDto } from '@common/dto/base-query.dto';

/**
 * 재고 목록 조회 쿼리 DTO
 * - BaseListQueryDto에서 page, limit, search, status, fromDate, toDate 상속
 */
export class StockQueryDto extends BaseListQueryDto {
  @ApiPropertyOptional({ description: '품목 코드' })
  @IsOptional()
  @IsString()
  itemCode?: string;

  @ApiPropertyOptional({ description: '창고 코드' })
  @IsOptional()
  @IsString()
  warehouseCode?: string;

  @ApiPropertyOptional({ description: '위치 코드' })
  @IsOptional()
  @IsString()
  locationCode?: string;

  @ApiPropertyOptional({ description: '재고 부족만 조회', default: false })
  @IsOptional()
  @Type(() => Boolean)
  lowStockOnly?: boolean;
}

export class StockAdjustDto {
  @ApiProperty({ description: '품목 코드' })
  @IsString()
  itemCode: string;

  @ApiProperty({ description: '창고 코드' })
  @IsString()
  warehouseCode: string;

  @ApiPropertyOptional({ description: '위치 코드' })
  @IsOptional()
  @IsString()
  locationCode?: string;

  @ApiPropertyOptional({ description: '자재 UID' })
  @IsOptional()
  @IsString()
  matUid?: string;

  @ApiProperty({ description: '조정 수량 (양수: 증가, 음수: 감소)' })
  @IsNumber()
  adjustQty: number;

  @ApiProperty({ description: '조정 사유' })
  @IsOptional()
  @IsString()
  reason?: string;
}

export class StockTransferDto {
  @ApiProperty({ description: '품목 코드' })
  @IsString()
  itemCode: string;

  @ApiProperty({ description: '출고 창고 코드' })
  @IsString()
  fromWarehouseCode: string;

  @ApiProperty({ description: '입고 창고 코드' })
  @IsString()
  toWarehouseCode: string;

  @ApiProperty({ description: '이동 수량' })
  @IsInt()
  @Min(1)
  qty: number;

  @ApiPropertyOptional({ description: '자재 UID' })
  @IsOptional()
  @IsString()
  matUid?: string;
}
