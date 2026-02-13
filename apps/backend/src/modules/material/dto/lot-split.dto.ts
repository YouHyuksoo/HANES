/**
 * @file src/modules/material/dto/lot-split.dto.ts
 * @description 자재 LOT 분할 관련 DTO
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsInt, Min, Max, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';

export class LotSplitDto {
  @ApiProperty({ description: '원본 LOT ID' })
  @IsString()
  sourceLotId: string;

  @ApiProperty({ description: '분할 수량' })
  @IsInt()
  @Min(1)
  splitQty: number;

  @ApiPropertyOptional({ description: '새 LOT 번호 (미지정 시 자동 생성)' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  newLotNo?: string;

  @ApiPropertyOptional({ description: '비고' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  remark?: string;
}

export class LotSplitQueryDto {
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
}
