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

  @ApiPropertyOptional({ default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 10;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: '창고 ID 필터' })
  @IsOptional()
  @IsString()
  warehouseId?: string;
}
