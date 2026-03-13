/**
 * @file src/modules/material/dto/physical-inv.dto.ts
 * @description 재고실사 관련 DTO — 실사 항목, 조회 필터, 세션(개시/완료) DTO
 *
 * 초보자 가이드:
 * - StartPhysicalInvSessionDto: 실사 개시 요청 DTO (invType 필수)
 * - CompletePhysicalInvSessionDto: 실사 완료 요청 DTO
 * - CreatePhysicalInvDto: 실사 결과 반영 DTO (countedQty 입력 목록)
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsInt, Min, Max, MaxLength, IsArray, ValidateNested, IsIn } from 'class-validator';
import { Type } from 'class-transformer';

export class PhysicalInvItemDto {
  @ApiProperty({ description: 'Stock ID' })
  @IsString()
  stockId: string;

  @ApiProperty({ description: '실사 수량' })
  @IsInt()
  @Min(0)
  countedQty: number;

  @ApiPropertyOptional({ description: '비고' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  remark?: string;
}

export class CreatePhysicalInvDto {
  @ApiProperty({ description: '실사 항목 목록', type: [PhysicalInvItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PhysicalInvItemDto)
  items: PhysicalInvItemDto[];

  @ApiPropertyOptional({ description: '작성자' })
  @IsOptional()
  @IsString()
  createdBy?: string;
}

export class PhysicalInvQueryDto {
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
  @Max(10000)
  limit?: number = 50;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: '창고 ID 필터' })
  @IsOptional()
  @IsString()
  warehouseId?: string;
}

/** 실사 개시 요청 DTO */
export class StartPhysicalInvSessionDto {
  @ApiProperty({ description: '실사 유형: MATERIAL | PRODUCT', example: 'MATERIAL' })
  @IsString()
  @IsIn(['MATERIAL', 'PRODUCT'])
  invType: 'MATERIAL' | 'PRODUCT';

  @ApiPropertyOptional({ description: '특정 창고만 실사 (null이면 전체 창고)' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  warehouseCode?: string;

  @ApiPropertyOptional({ description: '개시자 ID' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  startedBy?: string;

  @ApiPropertyOptional({ description: '비고' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  remark?: string;
}

/** 실사 완료 요청 DTO */
export class CompletePhysicalInvSessionDto {
  @ApiPropertyOptional({ description: '완료자 ID' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  completedBy?: string;

  @ApiPropertyOptional({ description: '완료 비고' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  remark?: string;
}

export class PhysicalInvHistoryQueryDto {
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
  @Max(10000)
  limit?: number = 50;

  @ApiPropertyOptional({ description: '검색어 (품목코드/품목명)' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: '창고코드 필터' })
  @IsOptional()
  @IsString()
  warehouseCode?: string;

  @ApiPropertyOptional({ description: '시작일 (YYYY-MM-DD)' })
  @IsOptional()
  @IsString()
  startDate?: string;

  @ApiPropertyOptional({ description: '종료일 (YYYY-MM-DD)' })
  @IsOptional()
  @IsString()
  endDate?: string;
}
