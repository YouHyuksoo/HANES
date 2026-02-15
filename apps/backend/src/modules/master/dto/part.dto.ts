/**
 * @file src/modules/master/dto/part.dto.ts
 * @description 품목마스터 관련 DTO 정의 - Oracle TM_ITEMS 기준 10개 컬럼 보강
 */

import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsString, IsOptional, IsInt, Min, Max, MaxLength, IsIn } from 'class-validator';
import { Type } from 'class-transformer';
import { PART_TYPE_VALUES, USE_YN_VALUES } from '@harness/shared';

export class CreatePartDto {
  @ApiProperty({ description: '품목 코드', example: 'P-001' })
  @IsString()
  @MaxLength(50)
  partCode: string;

  @ApiProperty({ description: '품목명', example: '전선 A타입' })
  @IsString()
  @MaxLength(200)
  partName: string;

  @ApiProperty({ description: '품목 유형', enum: PART_TYPE_VALUES })
  @IsString()
  @IsIn([...PART_TYPE_VALUES])
  partType: string;

  @ApiPropertyOptional({ description: '품번 (Part Number)', example: 'WIRE-AWG18-R' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  partNo?: string;

  @ApiPropertyOptional({ description: '고객사 품번', example: 'HMC-001' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  custPartNo?: string;

  @ApiPropertyOptional({ description: '제품유형 코드', example: '2011' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  productType?: string;

  @ApiPropertyOptional({ description: '규격' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  spec?: string;

  @ApiPropertyOptional({ description: '리비전', example: 'A' })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  rev?: string;

  @ApiPropertyOptional({ description: '단위', default: 'EA' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  unit?: string;

  @ApiPropertyOptional({ description: '도면 번호' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  drawNo?: string;

  @ApiPropertyOptional({ description: '고객사' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  customer?: string;

  @ApiPropertyOptional({ description: '공급업체' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  vendor?: string;

  @ApiPropertyOptional({ description: '리드타임 (일)', default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  leadTime?: number;

  @ApiPropertyOptional({ description: '안전재고', default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  safetyStock?: number;

  @ApiPropertyOptional({ description: 'LOT 단위수량' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  lotUnitQty?: number;

  @ApiPropertyOptional({ description: '박스 입수량', default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  boxQty?: number;

  @ApiPropertyOptional({ description: 'IQC 대상여부', default: 'Y', enum: USE_YN_VALUES })
  @IsOptional()
  @IsString()
  @IsIn([...USE_YN_VALUES])
  iqcFlag?: string;

  @ApiPropertyOptional({ description: '택타임 (초)', default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  tactTime?: number;

  @ApiPropertyOptional({ description: '유효기간 (일)', default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  expiryDate?: number;

  @ApiPropertyOptional({ description: '비고' })
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  remarks?: string;

  @ApiPropertyOptional({ description: '사용 여부', default: 'Y', enum: USE_YN_VALUES })
  @IsOptional()
  @IsString()
  @IsIn([...USE_YN_VALUES])
  useYn?: string;
}

export class UpdatePartDto extends PartialType(CreatePartDto) {}

export class PartQueryDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  limit?: number = 20;

  @ApiPropertyOptional({ enum: PART_TYPE_VALUES })
  @IsOptional()
  @IsString()
  @IsIn([...PART_TYPE_VALUES])
  partType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  customer?: string;

  @ApiPropertyOptional({ enum: USE_YN_VALUES })
  @IsOptional()
  @IsString()
  @IsIn([...USE_YN_VALUES])
  useYn?: string;
}
