/**
 * @file src/modules/inventory/dto/product-inventory.dto.ts
 * @description 제품(WIP/FG) 수불관리 전용 DTO
 *
 * 초보자 가이드:
 * - 원자재 수불은 inventory.dto.ts의 ReceiveStockDto/IssueStockDto 사용
 * - 제품 수불은 이 파일의 ProductReceiveStockDto/ProductIssueStockDto 사용
 * - 차이점: orderNo(작업지시), processCode(공정코드), itemType 추가
 */
import { IsString, IsOptional, IsNumber, IsIn, IsDate, Min } from 'class-validator';
import { Type } from 'class-transformer';

/** 제품 입고 DTO */
export class ProductReceiveStockDto {
  @IsString()
  warehouseId: string;

  @IsString()
  itemCode: string;

  @IsOptional()
  @IsIn(['WIP', 'FG'])
  itemType?: string;

  @IsOptional()
  @IsString()
  lotId?: string;

  @IsNumber()
  @Min(1)
  qty: number;

  @IsOptional()
  @IsString()
  transType?: string;

  @IsOptional()
  @IsString()
  orderNo?: string;

  @IsOptional()
  @IsString()
  processCode?: string;

  @IsOptional()
  @IsString()
  refType?: string;

  @IsOptional()
  @IsString()
  refId?: string;

  @IsOptional()
  @IsNumber()
  unitPrice?: number;

  @IsOptional()
  @IsString()
  workerId?: string;

  @IsOptional()
  @IsString()
  remark?: string;
}

/** 제품 출고 DTO */
export class ProductIssueStockDto {
  @IsString()
  warehouseId: string;

  @IsString()
  itemCode: string;

  @IsOptional()
  @IsIn(['WIP', 'FG'])
  itemType?: string;

  @IsOptional()
  @IsString()
  lotId?: string;

  @IsNumber()
  @Min(1)
  qty: number;

  @IsOptional()
  @IsString()
  transType?: string;

  @IsOptional()
  @IsString()
  toWarehouseId?: string;

  @IsOptional()
  @IsString()
  orderNo?: string;

  @IsOptional()
  @IsString()
  processCode?: string;

  @IsOptional()
  @IsString()
  refType?: string;

  @IsOptional()
  @IsString()
  refId?: string;

  @IsOptional()
  @IsString()
  workerId?: string;

  @IsOptional()
  @IsString()
  issueType?: string;

  @IsOptional()
  @IsString()
  remark?: string;
}

/** 제품 수불 조회 DTO */
export class ProductTransactionQueryDto {
  @IsOptional()
  @IsString()
  warehouseId?: string;

  @IsOptional()
  @IsString()
  itemCode?: string;

  @IsOptional()
  @IsString()
  itemType?: string;

  @IsOptional()
  @IsString()
  lotId?: string;

  @IsOptional()
  @IsString()
  transType?: string;

  @IsOptional()
  @IsString()
  refType?: string;

  @IsOptional()
  @IsString()
  refId?: string;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  dateFrom?: Date;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  dateTo?: Date;

  @IsOptional()
  @IsNumber()
  limit?: number;

  @IsOptional()
  @IsNumber()
  offset?: number;
}

/** 제품 재고 조회 DTO */
export class ProductStockQueryDto {
  @IsOptional()
  @IsString()
  warehouseId?: string;

  @IsOptional()
  @IsString()
  warehouseType?: string;

  @IsOptional()
  @IsString()
  itemCode?: string;

  @IsOptional()
  @IsString()
  itemType?: string;

  @IsOptional()
  @IsString()
  lotId?: string;

  @IsOptional()
  includeZero?: boolean;
}
