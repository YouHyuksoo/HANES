/**
 * @file src/modules/master/dto/transfer-rule.dto.ts
 * @description 창고이동규칙 관련 DTO 정의
 *
 * 초보자 가이드:
 * 1. **CreateTransferRuleDto**: 출발/도착 창고 간 이동 규칙 생성
 * 2. **TransferRuleQueryDto**: fromWarehouseId, toWarehouseId 필터 지원
 */

import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsString, IsOptional, IsInt, Min, Max, MaxLength, IsIn } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateTransferRuleDto {
  @ApiProperty({ description: '출발 창고 ID' })
  @IsString()
  fromWarehouseId: string;

  @ApiProperty({ description: '도착 창고 ID' })
  @IsString()
  toWarehouseId: string;

  @ApiPropertyOptional({ description: '허용 여부', default: 'Y' })
  @IsOptional()
  @IsString()
  @IsIn(['Y', 'N'])
  allowYn?: string;

  @ApiPropertyOptional({ description: '비고' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  remark?: string;
}

export class UpdateTransferRuleDto extends PartialType(CreateTransferRuleDto) {}

export class TransferRuleQueryDto {
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

  @ApiPropertyOptional({ description: '출발 창고 ID 필터' })
  @IsOptional()
  @IsString()
  fromWarehouseId?: string;

  @ApiPropertyOptional({ description: '도착 창고 ID 필터' })
  @IsOptional()
  @IsString()
  toWarehouseId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsIn(['Y', 'N'])
  allowYn?: string;
}
