/**
 * @file src/modules/inventory/dto/inventory.dto.ts
 * @description 재고관리 DTO - 창고, 재고, 수불 이력
 */
import { IsString, IsOptional, IsNumber, IsIn, IsDate, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { WAREHOUSE_TYPE_DTO_VALUES, TRANSACTION_TYPE_VALUES, REF_TYPE_VALUES } from '@harness/shared';

// ============================================================================
// 창고 마스터 DTO
// ============================================================================
export class CreateWarehouseDto {
  @IsString()
  warehouseCode: string;

  @IsString()
  warehouseName: string;

  @IsIn([...WAREHOUSE_TYPE_DTO_VALUES])
  warehouseType: string;

  @IsOptional()
  @IsString()
  plantCode?: string;

  @IsOptional()
  @IsString()
  lineCode?: string;

  @IsOptional()
  @IsString()
  processCode?: string;

  @IsOptional()
  @IsString()
  vendorId?: string;

  @IsOptional()
  isDefault?: boolean;
}

export class UpdateWarehouseDto {
  @IsOptional()
  @IsString()
  warehouseName?: string;

  @IsOptional()
  @IsIn([...WAREHOUSE_TYPE_DTO_VALUES])
  warehouseType?: string;

  @IsOptional()
  @IsString()
  plantCode?: string;

  @IsOptional()
  @IsString()
  lineCode?: string;

  @IsOptional()
  @IsString()
  processCode?: string;

  @IsOptional()
  isDefault?: boolean;

  @IsOptional()
  @IsString()
  useYn?: string;
}

// ============================================================================
// LOT DTO
// ============================================================================
export class CreateLotDto {
  @IsString()
  lotNo: string;

  @IsString()
  itemCode: string;

  @IsString()
  itemType: string; // RAW, WIP, FG

  @IsNumber()
  @Min(0)
  initQty: number;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  recvDate?: Date;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  expireDate?: Date;

  @IsOptional()
  @IsString()
  origin?: string;

  @IsOptional()
  @IsString()
  vendor?: string;

  @IsOptional()
  @IsString()
  invoiceNo?: string;

  @IsOptional()
  @IsString()
  poNo?: string;

  @IsOptional()
  @IsString()
  orderNo?: string;

  @IsOptional()
  @IsString()
  parentLotId?: string;
}

// ============================================================================
// 수불 트랜잭션 DTO
// ============================================================================
export class CreateTransactionDto {
  @IsIn([...TRANSACTION_TYPE_VALUES])
  transType: string;

  @IsOptional()
  @IsString()
  fromWarehouseCode?: string;

  @IsOptional()
  @IsString()
  toWarehouseCode?: string;

  @IsString()
  itemCode: string;

  @IsOptional()
  @IsString()
  lotNo?: string;

  @IsNumber()
  qty: number;

  @IsOptional()
  @IsNumber()
  unitPrice?: number;

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
  remark?: string;
}

// 입고 DTO
export class ReceiveStockDto {
  @IsString()
  warehouseCode: string;

  @IsString()
  itemCode: string;

  @IsOptional()
  @IsString()
  lotNo?: string;

  @IsNumber()
  @Min(1)
  qty: number;

  @IsIn([...TRANSACTION_TYPE_VALUES])
  transType: string;

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

// 출고 DTO
export class IssueStockDto {
  @IsString()
  warehouseCode: string;

  @IsString()
  itemCode: string;

  @IsOptional()
  @IsString()
  lotNo?: string;

  @IsNumber()
  @Min(1)
  qty: number;

  @IsIn([...TRANSACTION_TYPE_VALUES])
  transType: string;

  @IsOptional()
  @IsString()
  toWarehouseCode?: string; // 이동 대상 창고

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
  remark?: string;
}

// 이동 DTO
export class TransferStockDto {
  @IsString()
  fromWarehouseCode: string;

  @IsString()
  toWarehouseCode: string;

  @IsString()
  itemCode: string;

  @IsOptional()
  @IsString()
  lotNo?: string;

  @IsNumber()
  @Min(1)
  qty: number;

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
  remark?: string;
}

// 취소 DTO
export class CancelTransactionDto {
  @IsString()
  transactionId: string;

  @IsOptional()
  @IsString()
  workerId?: string;

  @IsOptional()
  @IsString()
  remark?: string;
}

// ============================================================================
// 조회 DTO
// ============================================================================
export class StockQueryDto {
  @IsOptional()
  @IsString()
  warehouseCode?: string;

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
  lotNo?: string;

  @IsOptional()
  includeZero?: boolean;
}

export class TransactionQueryDto {
  @IsOptional()
  @IsString()
  warehouseCode?: string;

  @IsOptional()
  @IsString()
  itemCode?: string;

  @IsOptional()
  @IsString()
  lotNo?: string;

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
