/**
 * @file src/modules/material/dto/physical-inv.dto.ts
 * @description 재고실사 관련 DTO
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsInt, Min, Max, MaxLength, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class PhysicalInvItemDto {
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

export class CreatePhysicalInvDto {
  @ApiProperty({ description: '실사 항목 목록', type: [PhysicalInvItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PhysicalInvItemDto)
  items: PhysicalInvItemDto[];

  @ApiPropertyOptional({ description: '작성자' })
  @IsOptional()
  @IsString()
  createdBy?: string;
}

export class PhysicalInvQueryDto {
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

  @ApiPropertyOptional({ description: '창고 ID 필터' })
  @IsOptional()
  @IsString()
  warehouseId?: string;
}

export class PhysicalInvHistoryQueryDto {
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

  @ApiPropertyOptional({ description: '창고코드 필터' })
  @IsOptional()
  @IsString()
  warehouseCode?: string;

  @ApiPropertyOptional({ description: '시작일 (YYYY-MM-DD)' })
  @IsOptional()
  @IsString()
  startDate?: string;

  @ApiPropertyOptional({ description: '종료일 (YYYY-MM-DD)' })
  @IsOptional()
  @IsString()
  endDate?: string;
}
