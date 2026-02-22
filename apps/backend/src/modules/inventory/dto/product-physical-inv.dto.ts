/**
 * @file src/modules/inventory/dto/product-physical-inv.dto.ts
 * @description 제품 재고실사 관련 DTO
 *
 * 초보자 가이드:
 * 1. ProductPhysicalInvItemDto: 개별 재고 실사 항목 (stockId + countedQty)
 * 2. CreateProductPhysicalInvDto: 실사 결과 일괄 반영 요청
 * 3. ProductPhysicalInvQueryDto: 실사 대상 Stock 조회 파라미터
 * 4. ProductPhysicalInvHistoryQueryDto: InvAdjLog 이력 조회 파라미터
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsInt, Min, Max, MaxLength, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class ProductPhysicalInvItemDto {
  @ApiProperty({ description: 'Stock ID' })
  @IsString()
  stockId: string;

  @ApiProperty({ description: '실사 수량' })
  @IsInt()
  @Min(0)
  countedQty: number;

  @ApiPropertyOptional({ description: '비고' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  remark?: string;
}

export class CreateProductPhysicalInvDto {
  @ApiProperty({ description: '실사 항목 목록', type: [ProductPhysicalInvItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductPhysicalInvItemDto)
  items: ProductPhysicalInvItemDto[];

  @ApiPropertyOptional({ description: '작성자' })
  @IsOptional()
  @IsString()
  createdBy?: string;
}

export class ProductPhysicalInvQueryDto {
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

  @ApiPropertyOptional({ description: '검색어 (품목코드/품목명)' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: '창고 ID 필터' })
  @IsOptional()
  @IsString()
  warehouseId?: string;
}

export class ProductPhysicalInvHistoryQueryDto {
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

  @ApiPropertyOptional({ description: '검색어 (품목코드/품목명)' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: '창고 ID 필터' })
  @IsOptional()
  @IsString()
  warehouseId?: string;

  @ApiPropertyOptional({ description: '시작일 (YYYY-MM-DD)' })
  @IsOptional()
  @IsString()
  startDate?: string;

  @ApiPropertyOptional({ description: '종료일 (YYYY-MM-DD)' })
  @IsOptional()
  @IsString()
  endDate?: string;
}
