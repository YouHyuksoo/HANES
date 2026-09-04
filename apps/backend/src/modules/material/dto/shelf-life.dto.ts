/**
 * @file src/modules/material/dto/shelf-life.dto.ts
 * @description 유수명자재 조회 DTO - 유효기한이 있는 LOT 필터링
 *
 * 기본 조건(조건 없는 전량 조회 금지):
 * - expiryStatus 생략 시 관리 대상(만료됨 + 만료임박)만 조회한다. VALID/DISCARDED는 명시 지정 시에만.
 * - hasStockYn 기본 'Y' — 현재 잔량이 있는 LOT만 조회한다.
 */

import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsInt, Min, IsIn, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';
import { PaginationQueryDto } from '../../../common/dto/base-query.dto';

export const SHELF_LIFE_EXPIRY_STATUSES = ['EXPIRED', 'NEAR_EXPIRY', 'VALID', 'DISCARDED'] as const;
export type ShelfLifeExpiryStatus = (typeof SHELF_LIFE_EXPIRY_STATUSES)[number];

export class ShelfLifeQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: '검색어 (LOT번호 / 품목코드 / 품목명, DB LIKE)' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({ description: '품목코드 (정확히 일치)' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  itemCode?: string;

  @ApiPropertyOptional({
    description: '만료 상태 필터. 생략 시 관리 대상(EXPIRED + NEAR_EXPIRY)만 조회',
    enum: SHELF_LIFE_EXPIRY_STATUSES,
  })
  @IsOptional()
  @IsString()
  @IsIn(SHELF_LIFE_EXPIRY_STATUSES)
  expiryStatus?: ShelfLifeExpiryStatus;

  @ApiPropertyOptional({ description: '잔량 있는 LOT만 조회 (기본 Y)', enum: ['Y', 'N'], default: 'Y' })
  @IsOptional()
  @IsString()
  @IsIn(['Y', 'N'])
  hasStockYn?: 'Y' | 'N' = 'Y';

  @ApiPropertyOptional({ description: '만료 임박 일수 (기본 10일)', default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  nearExpiryDays?: number = 10;
}
