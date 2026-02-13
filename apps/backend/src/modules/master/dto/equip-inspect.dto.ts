/**
 * @file src/modules/master/dto/equip-inspect.dto.ts
 * @description 설비점검항목마스터 관련 DTO 정의
 *
 * 초보자 가이드:
 * 1. **CreateEquipInspectItemDto**: 설비별 점검항목 생성 (유형, 주기)
 * 2. **EquipInspectItemQueryDto**: equipId, inspectType 필터 지원
 */

import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsString, IsOptional, IsInt, Min, Max, MaxLength, IsIn } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateEquipInspectItemDto {
  @ApiProperty({ description: '설비 ID' })
  @IsString()
  equipId: string;

  @ApiProperty({ description: '점검 유형', enum: ['DAILY', 'PERIODIC'] })
  @IsString()
  @IsIn(['DAILY', 'PERIODIC'])
  inspectType: string;

  @ApiProperty({ description: '점검 순서', example: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  seq: number;

  @ApiProperty({ description: '점검항목명', example: '유압 압력 확인' })
  @IsString()
  @MaxLength(200)
  itemName: string;

  @ApiPropertyOptional({ description: '판정기준' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  criteria?: string;

  @ApiPropertyOptional({ description: '주기', enum: ['DAILY', 'WEEKLY', 'MONTHLY'] })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  cycle?: string;

  @ApiPropertyOptional({ description: '사용 여부', default: 'Y' })
  @IsOptional()
  @IsString()
  @IsIn(['Y', 'N'])
  useYn?: string;
}

export class UpdateEquipInspectItemDto extends PartialType(CreateEquipInspectItemDto) {}

export class EquipInspectItemQueryDto {
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

  @ApiPropertyOptional({ description: '설비 ID 필터' })
  @IsOptional()
  @IsString()
  equipId?: string;

  @ApiPropertyOptional({ description: '점검 유형 필터' })
  @IsOptional()
  @IsString()
  @IsIn(['DAILY', 'PERIODIC'])
  inspectType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsIn(['Y', 'N'])
  useYn?: string;
}
