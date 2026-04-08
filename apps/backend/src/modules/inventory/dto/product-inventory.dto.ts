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
import { PaginationQueryDto } from '../../../common/dto/base-query.dto';

/** 제품 입고 DTO */
export class ProductReceiveStockDto {
  @IsString()
  warehouseId: string;

  @IsString()
  itemCode: string;

  @IsOptional()
  @IsIn(['SEMI_PRODUCT', 'FINISHED'])
  itemType?: string;

  @IsOptional()
  @IsString()
  prdUid?: string;

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

  @IsOptional()
  @IsString()
  company?: string;

  @IsOptional()
  @IsString()
  plant?: string;
}

/** 제품 출고 DTO */
export class ProductIssueStockDto {
  @IsString()
  warehouseId: string;

  @IsString()
  itemCode: string;

  @IsOptional()
  @IsIn(['SEMI_PRODUCT', 'FINISHED'])
  itemType?: string;

  @IsOptional()
  @IsString()
  prdUid?: string;

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

  @IsOptional()
  @IsString()
  company?: string;

  @IsOptional()
  @IsString()
  plant?: string;
}

/** 제품 수불 조회 DTO */
export class ProductTransactionQueryDto extends PaginationQueryDto {
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
  prdUid?: string;

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
  offset?: number;
}

/** 제품 재고 조회 DTO */
export class ProductStockQueryDto extends PaginationQueryDto {
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
  prdUid?: string;

  @IsOptional()
  includeZero?: boolean;
}
