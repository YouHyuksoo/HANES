/**
 * @file src/modules/material/dto/hold.dto.ts
 * @description 재고홀드 관련 DTO
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsInt, Min, Max, MaxLength, IsIn } from 'class-validator';
import { Type } from 'class-transformer';
import { PaginationQueryDto } from '../../../common/dto/base-query.dto';

export class HoldActionDto {
  @ApiProperty({ description: '자재 UID' })
  @IsString()
  matUid: string;

  @ApiProperty({ description: '홀드 사유' })
  @IsString()
  @MaxLength(500)
  reason: string;
}

export class ReleaseHoldDto {
  @ApiProperty({ description: '자재 UID' })
  @IsString()
  matUid: string;

  @ApiPropertyOptional({ description: '해제 사유' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class HoldQueryDto extends PaginationQueryDto {


  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: ['HOLD', 'NORMAL'] })
  @IsOptional()
  @IsString()
  @IsIn(['HOLD', 'NORMAL'])
  status?: string;
}
