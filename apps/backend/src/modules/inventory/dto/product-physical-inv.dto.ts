/**
 * @file src/modules/inventory/dto/product-physical-inv.dto.ts
 * @description 제품 재고실사 관련 DTO
 *
 * 초보자 가이드:
 * 1. ProductPhysicalInvItemDto: 개별 재고 실사 항목 (stockId + countedQty)
 * 2. CreateProductPhysicalInvDto: 실사 결과 일괄 반영 요청
 * 3. ProductPhysicalInvQueryDto: 실사 대상 Stock 조회 파라미터
 * 4. ProductPhysicalInvHistoryQueryDto: InvAdjLog 이력 조회 파라미터
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsInt, Min, Max, MaxLength, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { PaginationQueryDto } from '../../../common/dto/base-query.dto';

export class ProductPhysicalInvItemDto {
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

export class CreateProductPhysicalInvDto {
  @ApiProperty({ description: '실사 항목 목록', type: [ProductPhysicalInvItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductPhysicalInvItemDto)
  items: ProductPhysicalInvItemDto[];

  @ApiPropertyOptional({ description: '실사 기준월 (YYYY-MM)', example: '2026-02' })
  @IsOptional()
  @IsString()
  @MaxLength(7)
  countMonth?: string;

  @ApiPropertyOptional({ description: '실사 구분 (NORMAL=정상, CANCEL=취소)', example: 'NORMAL' })
  @IsOptional()
  @IsString()
  countType?: string;

  @ApiPropertyOptional({ description: '작성자' })
  @IsOptional()
  @IsString()
  createdBy?: string;
}

/** PDA: 제품 바코드 스캔 실사 +1 요청 */
export class ScanProductCountDto {
  @ApiProperty({ description: '실사 세션 ID (PhysicalInvSession.seq)' })
  @IsInt()
  sessionId: number;

  @ApiProperty({ description: '제품 시리얼 바코드 (FG_LABELS.FG_BARCODE)' })
  @IsString()
  barcode: string;

  @ApiPropertyOptional({ description: '스캔 사용자 ID' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  countedBy?: string;
}

/** PDA/PC: 제품 실사 세션 개시 요청 */
export class StartProductPhysicalInvSessionDto {
  @ApiProperty({ description: '실사 기준월 (YYYY-MM)', example: '2026-06' })
  @IsString()
  @MaxLength(7)
  countMonth: string;

  @ApiPropertyOptional({ description: '창고 코드 (null이면 전체 창고)' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  warehouseCode?: string;

  @ApiPropertyOptional({ description: '개시자' })
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

export class ProductPhysicalInvQueryDto extends PaginationQueryDto {


  @ApiPropertyOptional({ description: '검색어 (품목코드/품목명)' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: '창고 코드 필터' })
  @IsOptional()
  @IsString()
  warehouseCode?: string;

  @ApiPropertyOptional({ description: '창고 코드 필터 (호환용: warehouseCode 사용 권장)' })
  @IsOptional()
  @IsString()
  warehouseId?: string;
}

export class ProductPhysicalInvHistoryQueryDto extends PaginationQueryDto {


  @ApiPropertyOptional({ description: '검색어 (품목코드/품목명)' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: '창고 코드 필터' })
  @IsOptional()
  @IsString()
  warehouseCode?: string;

  @ApiPropertyOptional({ description: '창고 코드 필터 (호환용: warehouseCode 사용 권장)' })
  @IsOptional()
  @IsString()
  warehouseId?: string;

  @ApiPropertyOptional({ description: '시작일 (YYYY-MM-DD)' })
  @IsOptional()
  @IsString()
  fromDate?: string;

  @ApiPropertyOptional({ description: '종료일 (YYYY-MM-DD)' })
  @IsOptional()
  @IsString()
  toDate?: string;
}
