/**
 * @file mold.dto.ts
 * @description 금형관리 DTO — 금형 마스터 생성/수정, 사용 이력 등록, 조회 필터
 *
 * 초보자 가이드:
 * 1. **CreateMoldDto**: 금형 등록 (코드, 명칭, 캐비티, 보증타수 등)
 * 2. **UpdateMoldDto**: 수정 시 사용 (PartialType으로 전체 필드 선택적)
 * 3. **CreateMoldUsageDto**: 사용 이력 등록 (타수, 작업지시, 설비, 작업자)
 * 4. **MoldQueryDto**: 목록 조회 필터/페이지네이션
 */

import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsInt,
  IsDateString,
  Min,
  Max,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * 금형 등록 DTO
 */
export class CreateMoldDto {
  @ApiProperty({ description: '금형 코드', maxLength: 50 })
  @IsString()
  @MaxLength(50)
  moldCode: string;

  @ApiProperty({ description: '금형 명칭', maxLength: 200 })
  @IsString()
  @MaxLength(200)
  moldName: string;

  @ApiPropertyOptional({ description: '금형 유형', maxLength: 50 })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  moldType?: string;

  @ApiPropertyOptional({ description: '품목 코드', maxLength: 50 })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  itemCode?: string;

  @ApiPropertyOptional({ description: '캐비티 수', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  cavity?: number;

  @ApiPropertyOptional({ description: '보증 타수' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  guaranteedShots?: number;

  @ApiPropertyOptional({ description: '보전 주기 (타수 기준)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  maintenanceCycle?: number;

  @ApiPropertyOptional({ description: '보관 위치', maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  location?: string;

  @ApiPropertyOptional({ description: '제작업체', maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  maker?: string;

  @ApiPropertyOptional({ description: '구입일 (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  purchaseDate?: string;

  @ApiPropertyOptional({ description: '비고', maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  remark?: string;
}

/**
 * 금형 수정 DTO (전체 필드 선택적)
 */
export class UpdateMoldDto extends PartialType(CreateMoldDto) {}

/**
 * 금형 사용 이력 등록 DTO
 */
export class CreateMoldUsageDto {
  @ApiProperty({ description: '사용일 (ISO 8601)' })
  @IsDateString()
  usageDate: string;

  @ApiProperty({ description: '타수' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  shotCount: number;

  @ApiPropertyOptional({ description: '작업지시 번호', maxLength: 50 })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  orderNo?: string;

  @ApiPropertyOptional({ description: '설비 코드', maxLength: 50 })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  equipCode?: string;

  @ApiPropertyOptional({ description: '작업자 코드', maxLength: 50 })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  workerCode?: string;

  @ApiPropertyOptional({ description: '비고', maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  remark?: string;
}

/**
 * 금형 목록 조회 쿼리 DTO
 */
export class MoldQueryDto {
  @ApiPropertyOptional({ description: '페이지 번호', default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: '페이지 크기', default: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10000)
  limit?: number = 50;

  @ApiPropertyOptional({ description: '상태 필터' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ description: '금형 유형 필터' })
  @IsOptional()
  @IsString()
  moldType?: string;

  @ApiPropertyOptional({ description: '검색어 (금형코드, 명칭)' })
  @IsOptional()
  @IsString()
  search?: string;
}
