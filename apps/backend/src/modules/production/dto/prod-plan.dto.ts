/**
 * @file src/modules/production/dto/prod-plan.dto.ts
 * @description 월간생산계획 관련 DTO 정의
 *
 * 초보자 가이드:
 * 1. **CreateProdPlanDto**: 계획 개별 생성 시 필요한 필드
 * 2. **BulkCreateProdPlanDto**: 엑셀 일괄 등록 시 사용
 * 3. **UpdateProdPlanDto**: 계획 수정 시 (모두 선택적)
 * 4. **ProdPlanQueryDto**: 목록 조회 시 필터/페이지네이션
 */

import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsInt,
  IsIn,
  IsArray,
  ValidateNested,
  Min,
  Max,
  MaxLength,
  Matches,
} from 'class-validator';
import { Type } from 'class-transformer';

/** 생산계획 개별 생성 DTO */
export class CreateProdPlanDto {
  @ApiProperty({ description: '계획월 (YYYY-MM)', example: '2026-03' })
  @IsString()
  @Matches(/^\d{4}-\d{2}$/, { message: 'planMonth는 YYYY-MM 형식이어야 합니다.' })
  planMonth: string;

  @ApiProperty({ description: '품목코드', example: 'HNS-001' })
  @IsString()
  @MaxLength(50)
  itemCode: string;

  @ApiProperty({ description: '품목유형 (FG/WIP)', example: 'FG' })
  @IsString()
  @IsIn(['FG', 'WIP'])
  itemType: string;

  @ApiProperty({ description: '계획수량', example: 1000, minimum: 1 })
  @IsInt()
  @Min(1)
  planQty: number;

  @ApiPropertyOptional({ description: '고객사', example: 'HMC' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  customer?: string;

  @ApiPropertyOptional({ description: '라인코드', example: 'LINE-01' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  lineCode?: string;

  @ApiPropertyOptional({ description: '우선순위 (1~10)', default: 5 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  priority?: number;

  @ApiPropertyOptional({ description: '비고' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  remark?: string;
}

/** 엑셀 일괄 등록용 아이템 DTO */
export class BulkProdPlanItemDto {
  @ApiProperty({ description: '품목코드' })
  @IsString()
  @MaxLength(50)
  itemCode: string;

  @ApiProperty({ description: '품목유형 (FG/WIP)' })
  @IsString()
  @IsIn(['FG', 'WIP'])
  itemType: string;

  @ApiProperty({ description: '계획수량', minimum: 1 })
  @IsInt()
  @Min(1)
  planQty: number;

  @ApiPropertyOptional({ description: '고객사' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  customer?: string;

  @ApiPropertyOptional({ description: '라인코드' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  lineCode?: string;

  @ApiPropertyOptional({ description: '우선순위' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  priority?: number;

  @ApiPropertyOptional({ description: '비고' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  remark?: string;
}

/** 엑셀 일괄 등록 DTO */
export class BulkCreateProdPlanDto {
  @ApiProperty({ description: '계획월 (YYYY-MM)', example: '2026-03' })
  @IsString()
  @Matches(/^\d{4}-\d{2}$/, { message: 'planMonth는 YYYY-MM 형식이어야 합니다.' })
  planMonth: string;

  @ApiProperty({ description: '계획 아이템 배열', type: [BulkProdPlanItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BulkProdPlanItemDto)
  items: BulkProdPlanItemDto[];
}

/** 계획 수정 DTO */
export class UpdateProdPlanDto extends PartialType(CreateProdPlanDto) {
  @ApiPropertyOptional({ description: '상태', enum: ['DRAFT', 'CONFIRMED', 'CLOSED'] })
  @IsOptional()
  @IsString()
  @IsIn(['DRAFT', 'CONFIRMED', 'CLOSED'])
  status?: string;
}

/** 목록 조회 쿼리 DTO */
export class ProdPlanQueryDto {
  @ApiPropertyOptional({ description: '페이지 번호', default: 1 })
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

  @ApiPropertyOptional({ description: '계획월 필터 (YYYY-MM)' })
  @IsOptional()
  @IsString()
  planMonth?: string;

  @ApiPropertyOptional({ description: '품목유형 필터 (FG/WIP)' })
  @IsOptional()
  @IsString()
  @IsIn(['FG', 'WIP'])
  itemType?: string;

  @ApiPropertyOptional({ description: '상태 필터' })
  @IsOptional()
  @IsString()
  @IsIn(['DRAFT', 'CONFIRMED', 'CLOSED'])
  status?: string;

  @ApiPropertyOptional({ description: '시작일 (YYYY-MM-DD)' })
  @IsOptional()
  @IsString()
  startDate?: string;

  @ApiPropertyOptional({ description: '종료일 (YYYY-MM-DD)' })
  @IsOptional()
  @IsString()
  endDate?: string;

  @ApiPropertyOptional({ description: '통합 검색 (계획번호/품목코드/품목명)' })
  @IsOptional()
  @IsString()
  search?: string;
}
