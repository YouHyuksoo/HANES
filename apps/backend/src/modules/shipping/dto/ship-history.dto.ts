/**
 * @file src/modules/shipping/dto/ship-history.dto.ts
 * @description 출하이력 조회 관련 DTO 정의
 *
 * 초보자 가이드:
 * 1. **ShipHistoryQueryDto**: 출하이력 목록 조회 필터링/페이지네이션
 * 2. ShipmentOrder + ShipmentLog 조인 조회 전용
 */

import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsInt, IsDateString, Min, Max, IsIn } from 'class-validator';
import { Type } from 'class-transformer';

const SHIP_ORDER_STATUS = ['DRAFT', 'CONFIRMED', 'SHIPPING', 'SHIPPED'] as const;

/** 출하이력 목록 조회 쿼리 DTO */
export class ShipHistoryQueryDto {
  @ApiPropertyOptional({ description: '페이지 번호', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: '페이지 크기', default: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10000)
  limit?: number = 50;

  @ApiPropertyOptional({ description: '검색어 (지시번호, 고객명)' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: '상태 필터', enum: SHIP_ORDER_STATUS })
  @IsOptional()
  @IsString()
  @IsIn([...SHIP_ORDER_STATUS])
  status?: string;

  @ApiPropertyOptional({ description: '출하일 시작 (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  shipDateFrom?: string;

  @ApiPropertyOptional({ description: '출하일 종료 (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  shipDateTo?: string;

  @ApiPropertyOptional({ description: '고객명 필터' })
  @IsOptional()
  @IsString()
  customerName?: string;
}
