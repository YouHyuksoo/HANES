/**
 * @file src/modules/material/dto/arrival.dto.ts
 * @description 입하관리 DTO - PO 기반 입하, 수동 입하, 입하 취소 처리
 *
 * 초보자 가이드:
 * 1. **PO 입하**: 발주(PO)에 등록된 품목 기준으로 분할/전량 입하
 * 2. **수동 입하**: PO 없이 직접 품목/수량 지정하여 입하 등록
 * 3. **입하 취소**: 삭제가 아닌 역분개(+/- 이력)로 처리
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString, IsOptional, IsInt, Min, Max,
  MaxLength, IsDateString, IsArray, ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

/** PO 입하 시 개별 품목 DTO */
export class ArrivalItemDto {
  @ApiProperty({ description: 'PO 품목 ID' })
  @IsString()
  poItemId: string;

  @ApiProperty({ description: '품목 ID' })
  @IsString()
  partId: string;

  @ApiProperty({ description: '입하 수량' })
  @IsInt()
  @Min(1)
  receivedQty: number;

  @ApiProperty({ description: '입고 창고 ID' })
  @IsString()
  warehouseId: string;

  @ApiPropertyOptional({ description: 'LOT 번호 (미입력 시 자동 생성)' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  lotNo?: string;

  @ApiPropertyOptional({ description: '제조일자 (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  manufactureDate?: string;

  @ApiPropertyOptional({ description: '비고' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  remark?: string;
}

/** PO 기반 입하 등록 DTO */
export class CreatePoArrivalDto {
  @ApiProperty({ description: 'PO ID' })
  @IsString()
  poId: string;

  @ApiProperty({ description: '입하 품목 목록', type: [ArrivalItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ArrivalItemDto)
  items: ArrivalItemDto[];

  @ApiPropertyOptional({ description: '인보이스 번호' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  invoiceNo?: string;

  @ApiPropertyOptional({ description: '작업자 ID' })
  @IsOptional()
  @IsString()
  workerId?: string;

  @ApiPropertyOptional({ description: '비고' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  remark?: string;
}

/** 수동 입하 등록 DTO */
export class CreateManualArrivalDto {
  @ApiProperty({ description: '품목 ID' })
  @IsString()
  partId: string;

  @ApiProperty({ description: '입고 창고 ID' })
  @IsString()
  warehouseId: string;

  @ApiProperty({ description: '입하 수량' })
  @IsInt()
  @Min(1)
  qty: number;

  @ApiPropertyOptional({ description: 'LOT 번호 (미입력 시 자동 생성)' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  lotNo?: string;

  @ApiPropertyOptional({ description: '제조일자 (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  manufactureDate?: string;

  @ApiPropertyOptional({ description: '인보이스 번호' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  invoiceNo?: string;

  @ApiPropertyOptional({ description: '공급업체 ID' })
  @IsOptional()
  @IsString()
  vendorId?: string;

  @ApiPropertyOptional({ description: '공급업체명' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  vendor?: string;

  @ApiPropertyOptional({ description: '비고' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  remark?: string;

  @ApiPropertyOptional({ description: '작업자 ID' })
  @IsOptional()
  @IsString()
  workerId?: string;
}

/** 입하 이력 조회 DTO */
export class ArrivalQueryDto {
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

  @ApiPropertyOptional({ description: '검색어 (transNo, 품목코드, PO번호)' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: '시작일' })
  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @ApiPropertyOptional({ description: '종료일' })
  @IsOptional()
  @IsDateString()
  toDate?: string;

  @ApiPropertyOptional({ description: '상태 필터 (DONE, CANCELED)' })
  @IsOptional()
  @IsString()
  status?: string;
}

/** 입하재고현황 조회 DTO */
export class ArrivalStockQueryDto {
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
  @Max(5000)
  limit?: number = 5000;

  @ApiPropertyOptional({ description: '검색어 (품목코드, 품목명, PO번호, 인보이스번호)' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: '시작일' })
  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @ApiPropertyOptional({ description: '종료일' })
  @IsOptional()
  @IsDateString()
  toDate?: string;
}

/** 입하 취소 DTO */
export class CancelArrivalDto {
  @ApiProperty({ description: '취소할 트랜잭션 ID' })
  @IsString()
  transactionId: string;

  @ApiProperty({ description: '취소 사유' })
  @IsString()
  @MaxLength(500)
  reason: string;

  @ApiPropertyOptional({ description: '작업자 ID' })
  @IsOptional()
  @IsString()
  workerId?: string;
}
