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
import { PaginationQueryDto } from '../../../common/dto/base-query.dto';

/** PO 입하 시 개별 품목 DTO */
export class ArrivalItemDto {
  @ApiProperty({ description: 'PO 품목 ID' })
  @IsString()
  poItemId: string;

  @ApiProperty({ description: '품목 코드' })
  @IsString()
  itemCode: string;

  @ApiProperty({ description: '입하 수량' })
  @IsInt()
  @Min(1)
  receivedQty: number;

  @ApiProperty({ description: '입고 창고 ID' })
  @IsString()
  warehouseId: string;

  @ApiPropertyOptional({ description: '공급업체 UID' })
  @IsOptional()
  @IsString()
  supUid?: string;

  @ApiProperty({ description: '인보이스 번호' })
  @IsString()
  invoiceNo: string;

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

  @ApiProperty({ description: '인보이스 번호' })
  @IsString()
  @MaxLength(100)
  invoiceNo: string;

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
  @ApiProperty({ description: '품목 코드' })
  @IsString()
  itemCode: string;

  @ApiProperty({ description: '입고 창고 ID' })
  @IsString()
  warehouseId: string;

  @ApiProperty({ description: '입하 수량' })
  @IsInt()
  @Min(1)
  qty: number;

  @ApiPropertyOptional({ description: '공급업체 UID' })
  @IsOptional()
  @IsString()
  supUid?: string;

  @ApiProperty({ description: '인보이스 번호' })
  @IsString()
  @MaxLength(100)
  invoiceNo: string;

  @ApiPropertyOptional({ description: '제조일자 (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  manufactureDate?: string;

  @ApiProperty({ description: '공급업체 ID' })
  @IsString()
  vendorId: string;

  @ApiProperty({ description: '공급업체명' })
  @IsString()
  @MaxLength(200)
  vendor: string;

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
export class ArrivalQueryDto extends PaginationQueryDto {


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
export class ArrivalStockQueryDto extends PaginationQueryDto {


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

/**
 * IQC005 Phase A — PO 1라인 입하 등록 DTO
 *
 * 초보자 가이드:
 * - 식별자: (poNo, poSeq) 복합. PurchaseOrderItem 자연 PK.
 * - receivedQty: 잔량 이하. LOT_UNIT_QTY로 나눠서 N개 시리얼(MAT_LOT) 발급.
 * - mfgPartnerCode: PARTNER_MASTERS.PARTNER_TYPE='MFG' 필수.
 * - receivedDate: 입하일. 오늘 이하.
 * - warehouseCode: 입고 창고.
 */
export class PoLineReceiptDto {
  @ApiProperty({ description: 'PO 번호' })
  @IsString()
  poNo!: string;

  @ApiProperty({ description: 'PO 라인 SEQ' })
  @IsInt()
  @Min(1)
  poSeq!: number;

  @ApiProperty({ description: '입하 수량 (잔량 이하)' })
  @IsInt()
  @Min(1)
  receivedQty!: number;

  @ApiProperty({ description: '제조사 거래처 코드 (PARTNER_TYPE=MFG)' })
  @IsString()
  mfgPartnerCode!: string;

  @ApiProperty({ description: '입하일 (YYYY-MM-DD, 오늘 이하)' })
  @IsDateString()
  receivedDate!: string;

  @ApiProperty({ description: '입고 창고 코드' })
  @IsString()
  warehouseCode!: string;

  @ApiPropertyOptional({ description: '비고' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  remark?: string;
}

/** PO 라인 그리드 조회 쿼리 DTO (IQC005) */
export class PoLineQueryDto {
  @ApiPropertyOptional({ description: '라인 상태 (OPEN/PARTIAL/CLOSE)' })
  @IsOptional()
  @IsString()
  status?: 'OPEN' | 'PARTIAL' | 'CLOSE';

  @ApiPropertyOptional({ description: '품목 코드' })
  @IsOptional()
  @IsString()
  itemCode?: string;

  @ApiPropertyOptional({ description: 'PO 번호 (부분 일치)' })
  @IsOptional()
  @IsString()
  poNo?: string;
}
