/**
 * @file dto/vendor-barcode-mapping.dto.ts
 * @description 자재 제조사 바코드 매핑 DTO
 *
 * 초보자 가이드:
 * 1. CreateDto: 새 매핑 생성 시 필수/선택 필드 정의
 * 2. UpdateDto: 수정 시 모든 필드 optional
 * 3. QueryDto: 목록 조회 시 필터 조건
 * 4. ScanDto: 바코드 스캔 시 매칭 요청
 */
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsString, IsOptional, MaxLength, IsIn, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

const MATCH_TYPE_VALUES = ['EXACT', 'PREFIX', 'REGEX'] as const;

export class CreateVendorBarcodeMappingDto {
  @ApiProperty({ description: '제조사 바코드', example: 'JST-SVH-21T-P1.1' })
  @IsString()
  @MaxLength(200)
  vendorBarcode: string;

  @ApiPropertyOptional({ description: 'MES 품목 ID' })
  @IsOptional()
  @IsString()
  partId?: string;

  @ApiPropertyOptional({ description: 'MES 품번' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  partCode?: string;

  @ApiPropertyOptional({ description: 'MES 품명' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  partName?: string;

  @ApiPropertyOptional({ description: '제조사 코드' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  vendorCode?: string;

  @ApiPropertyOptional({ description: '제조사명' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  vendorName?: string;

  @ApiPropertyOptional({ description: '매핑 규칙 설명' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  mappingRule?: string;

  @ApiPropertyOptional({ description: '매칭 유형', enum: MATCH_TYPE_VALUES, default: 'EXACT' })
  @IsOptional()
  @IsString()
  @IsIn([...MATCH_TYPE_VALUES])
  matchType?: string;

  @ApiPropertyOptional({ description: '비고' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  remark?: string;

  @ApiPropertyOptional({ description: '사용여부', default: 'Y' })
  @IsOptional()
  @IsString()
  @IsIn(['Y', 'N'])
  useYn?: string;
}

export class UpdateVendorBarcodeMappingDto extends PartialType(CreateVendorBarcodeMappingDto) {}

export class VendorBarcodeMappingQueryDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number = 50;

  @ApiPropertyOptional({ description: '검색어 (바코드/품번/품명)' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: '제조사 코드' })
  @IsOptional()
  @IsString()
  vendorCode?: string;

  @ApiPropertyOptional({ description: '사용여부' })
  @IsOptional()
  @IsString()
  @IsIn(['Y', 'N'])
  useYn?: string;
}

export class BarcodeScanDto {
  @ApiProperty({ description: '스캔한 바코드 값', example: 'JST-SVH-21T-P1.1' })
  @IsString()
  @MaxLength(200)
  barcode: string;
}
