/**
 * @file src/modules/material/dto/lot-split.dto.ts
 * @description 자재 LOT 분할 관련 DTO
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsInt, Min, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/base-query.dto';

export class LotSplitDto {
  @ApiProperty({ description: '원본 LOT 시리얼(MAT_UID)' })
  @IsString()
  sourceLotId: string;

  @ApiProperty({ description: '분할 수량 (원본 재고보다 작아야 함)' })
  @IsInt()
  @Min(1)
  splitQty: number;

  @ApiPropertyOptional({ description: '비고' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  remark?: string;
}

export class LotSplitQueryDto extends PaginationQueryDto {


  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;
}
