/**
 * @file src/modules/master/dto/equip-inspect.dto.ts
 * @description 설비점검항목마스터 관련 DTO 정의
 *
 * 초보자 가이드:
 * 1. **CreateEquipInspectItemDto**: 설비별 점검항목 생성 (유형, 주기)
 * 2. **EquipInspectItemQueryDto**: equipCode, inspectType 필터 지원
 */

import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsString, IsOptional, IsInt, Min, Max, MaxLength, IsIn } from 'class-validator';
import { Type } from 'class-transformer';
import { PaginationQueryDto } from '../../../common/dto/base-query.dto';

export class CreateEquipInspectItemDto {
  @ApiProperty({ description: '설비 ID' })
  @IsString()
  equipCode: string;

  @ApiPropertyOptional({ description: '점검항목 Pool 코드', example: 'EIP-001' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  itemCode?: string;

  @ApiProperty({ description: '점검 유형', enum: ['DAILY', 'PERIODIC', 'PM', 'WORKER'] })
  @IsOptional()
  @IsString()
  @IsIn(['DAILY', 'PERIODIC', 'PM', 'WORKER'])
  inspectType?: string;

  @ApiProperty({ description: '점검 순서', example: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  seq: number;

  @ApiProperty({ description: '점검항목명', example: '유압 압력 확인' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  itemName?: string;

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

  @ApiPropertyOptional({ description: '점검 유형 (MEASURE|VISUAL)', default: 'VISUAL' })
  @IsOptional()
  @IsString()
  @IsIn(['MEASURE', 'VISUAL'])
  itemType?: string;

  @ApiPropertyOptional({ description: '측정 단위 (bar, ℃, mm 등)' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  unit?: string;

  @ApiPropertyOptional({ description: '하한값 (측정형만)' })
  @IsOptional()
  @Type(() => Number)
  lslValue?: number;

  @ApiPropertyOptional({ description: '상한값 (측정형만)' })
  @IsOptional()
  @Type(() => Number)
  uslValue?: number;

  @ApiPropertyOptional({ description: '작업자점검 QR 코드값' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  workerQrCode?: string;
}

export class UpdateEquipInspectItemDto extends PartialType(CreateEquipInspectItemDto) {}

export class EquipInspectItemQueryDto extends PaginationQueryDto {


  @ApiPropertyOptional({ description: '설비 ID 필터' })
  @IsOptional()
  @IsString()
  equipCode?: string;

  @ApiPropertyOptional({ description: '점검 유형 필터' })
  @IsOptional()
  @IsString()
  @IsIn(['DAILY', 'PERIODIC', 'PM', 'WORKER'])
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
