/**
 * @file src/modules/master/dto/equip-bom.dto.ts
 * @description 설비 BOM 관련 DTO 정의
 *
 * 초보자 가이드:
 * 1. **CreateEquipBomItemDto**: BOM 품목 등록
 * 2. **UpdateEquipBomItemDto**: BOM 품목 수정
 * 3. **CreateEquipBomRelDto**: 설비-BOM 연결 등록
 * 4. **UpdateEquipBomRelDto**: 설비-BOM 연결 수정
 */

import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsNumber,
  IsDateString,
  IsIn,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

// ========================================
// BOM 품목 마스터 DTO
// ========================================

export class CreateEquipBomItemDto {
  @ApiProperty({ description: '품목 코드', example: 'PART-001', maxLength: 50 })
  @IsString()
  @MaxLength(50)
  itemCode: string;

  @ApiProperty({ description: '품목명', example: '커팅 블레이드', maxLength: 200 })
  @IsString()
  @MaxLength(200)
  itemName: string;

  @ApiProperty({
    description: '품목 유형',
    enum: ['PART', 'CONSUMABLE'],
    example: 'PART',
  })
  @IsString()
  @IsIn(['PART', 'CONSUMABLE'])
  itemType: 'PART' | 'CONSUMABLE';

  @ApiPropertyOptional({ description: '규격', example: '100x50x2mm', maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  spec?: string;

  @ApiPropertyOptional({ description: '제조사', example: '日本特殊鋼', maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  maker?: string;

  @ApiPropertyOptional({ description: '단위', example: 'EA', maxLength: 20 })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  unit?: string;

  @ApiPropertyOptional({ description: '단가', example: 150000 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  unitPrice?: number;

  @ApiPropertyOptional({ description: '교체 주기 (일)', example: 90 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  replacementCycle?: number;

  @ApiPropertyOptional({ description: '현재 재고 수량', example: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  stockQty?: number;

  @ApiPropertyOptional({ description: '안전 재고 수량', example: 2 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  safetyStock?: number;

  @ApiPropertyOptional({ description: '사용 여부', enum: ['Y', 'N'], default: 'Y' })
  @IsOptional()
  @IsString()
  @IsIn(['Y', 'N'])
  useYn?: string;
}

export class UpdateEquipBomItemDto extends PartialType(CreateEquipBomItemDto) {}

export class EquipBomItemQueryDto {
  @ApiPropertyOptional({ description: '페이지 번호', default: 1 })
  @IsOptional()
  @Type(() => Number)
  page?: number = 1;

  @ApiPropertyOptional({ description: '페이지 크기', default: 20 })
  @IsOptional()
  @Type(() => Number)
  limit?: number = 20;

  @ApiPropertyOptional({ description: '품목 유형', enum: ['PART', 'CONSUMABLE'] })
  @IsOptional()
  @IsString()
  @IsIn(['PART', 'CONSUMABLE'])
  itemType?: string;

  @ApiPropertyOptional({ description: '사용 여부', enum: ['Y', 'N'] })
  @IsOptional()
  @IsString()
  @IsIn(['Y', 'N'])
  useYn?: string;

  @ApiPropertyOptional({ description: '검색어 (코드, 이름)' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: '회사 코드' })
  @IsOptional()
  @IsString()
  company?: string;
}

// ========================================
// 설비-BOM 연결 DTO
// ========================================

export class CreateEquipBomRelDto {
  @ApiProperty({ description: '설비 ID', example: '550e8400-e29b-41d4-a716-446655440000' })
  @IsString()
  equipId: string;

  @ApiProperty({ description: 'BOM 품목 ID', example: '550e8400-e29b-41d4-a716-446655440001' })
  @IsString()
  bomItemId: string;

  @ApiPropertyOptional({ description: '필요 수량', example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  quantity?: number;

  @ApiPropertyOptional({ description: '설치일 (ISO 8601)', example: '2024-01-15' })
  @IsOptional()
  @IsDateString()
  installDate?: string;

  @ApiPropertyOptional({ description: '유효기한 (ISO 8601)', example: '2025-01-15' })
  @IsOptional()
  @IsDateString()
  expireDate?: string;

  @ApiPropertyOptional({ description: '비고', maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  remark?: string;

  @ApiPropertyOptional({ description: '사용 여부', enum: ['Y', 'N'], default: 'Y' })
  @IsOptional()
  @IsString()
  @IsIn(['Y', 'N'])
  useYn?: string;
}

export class UpdateEquipBomRelDto extends PartialType(CreateEquipBomRelDto) {}

export class EquipBomRelQueryDto {
  @ApiPropertyOptional({ description: '페이지 번호', default: 1 })
  @IsOptional()
  @Type(() => Number)
  page?: number = 1;

  @ApiPropertyOptional({ description: '페이지 크기', default: 20 })
  @IsOptional()
  @Type(() => Number)
  limit?: number = 20;

  @ApiPropertyOptional({ description: '설비 ID' })
  @IsOptional()
  @IsString()
  equipId?: string;

  @ApiPropertyOptional({ description: 'BOM 품목 ID' })
  @IsOptional()
  @IsString()
  bomItemId?: string;

  @ApiPropertyOptional({ description: '품목 유형', enum: ['PART', 'CONSUMABLE'] })
  @IsOptional()
  @IsString()
  @IsIn(['PART', 'CONSUMABLE'])
  itemType?: string;

  @ApiPropertyOptional({ description: '사용 여부', enum: ['Y', 'N'] })
  @IsOptional()
  @IsString()
  @IsIn(['Y', 'N'])
  useYn?: string;
}
