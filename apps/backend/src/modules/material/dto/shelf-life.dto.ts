/**
 * @file src/modules/material/dto/shelf-life.dto.ts
 * @description 유수명자재 조회 DTO - 유효기한이 있는 LOT 필터링
 */

import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsInt, Min, Max, IsIn } from 'class-validator';
import { Type } from 'class-transformer';

export class ShelfLifeQueryDto {
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

  @ApiPropertyOptional({ description: '만료 상태 필터', enum: ['EXPIRED', 'NEAR_EXPIRY', 'VALID'] })
  @IsOptional()
  @IsString()
  @IsIn(['EXPIRED', 'NEAR_EXPIRY', 'VALID'])
  expiryStatus?: string;

  @ApiPropertyOptional({ description: '만료 임박 일수 (기본 30일)', default: 30 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  nearExpiryDays?: number = 30;
}
