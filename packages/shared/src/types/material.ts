/**
 * @file packages/shared/src/types/material.ts
 * @description 자재/재고 관련 타입 정의
 *
 * 초보자 가이드:
 * 1. **LOT**: 동일 조건으로 입고된 자재 묶음 단위
 * 2. **재고(Stock)**: 현재 창고에 있는 수량
 * 3. **출고(Issue)**: 생산 라인으로 자재 투입
 */

import { InventoryMoveType, IqcStatus, WarehouseType } from './enums';

/** 자재 LOT */
export interface MatLot {
  id: string;
  lotNo: string;
  itemCode: string;
  itemName: string;
  supplierCode?: string;
  supplierName?: string;
  supplierLotNo?: string;
  receiptDate: string;
  receiptQty: number;
  currentQty: number;
  unit: string;
  warehouseId: string;
  warehouseCode: string;
  locationId?: string;
  locationCode?: string;
  expiryDate?: string;
  manufacturingDate?: string;
  iqcStatus: IqcStatus;
  iqcDate?: string;
  iqcBy?: string;
  isBlocked: boolean;
  blockReason?: string;
  isBonded: boolean;           // 보세 여부
  blNo?: string;               // B/L 번호
  invoiceNo?: string;          // Invoice 번호
  customsClearanceDate?: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

/** 자재 재고 */
export interface MatStock {
  id: string;
  itemCode: string;
  itemName: string;
  warehouseId: string;
  warehouseCode: string;
  warehouseName: string;
  warehouseType: WarehouseType;
  locationId?: string;
  locationCode?: string;
  lotNo?: string;
  currentQty: number;
  reservedQty: number;         // 예약 수량
  availableQty: number;        // 가용 수량 (currentQty - reservedQty)
  unit: string;
  lastInDate?: string;
  lastOutDate?: string;
  updatedAt: string;
}

/** 자재 출고 */
export interface MatIssue {
  id: string;
  issueNo: string;
  issueDate: string;
  issueType: 'JOB_ORDER' | 'MANUAL' | 'TRANSFER' | 'SAMPLE';
  jobOrderId?: string;
  jobOrderNo?: string;
  itemCode: string;
  itemName: string;
  lotNo: string;
  requestQty: number;
  issueQty: number;
  unit: string;
  fromWarehouseId: string;
  fromLocationId?: string;
  toLineId?: string;
  toWarehouseId?: string;
  issuedBy: string;
  issuedByName: string;
  confirmedBy?: string;
  confirmedAt?: string;
  status: 'REQUESTED' | 'ISSUED' | 'CONFIRMED' | 'CANCELED';
  description?: string;
  createdAt: string;
  updatedAt: string;
}

/** 자재 입고 */
export interface MatReceipt {
  id: string;
  receiptNo: string;
  receiptDate: string;
  receiptType: 'PURCHASE' | 'RETURN' | 'TRANSFER' | 'PRODUCTION';
  poNo?: string;               // 구매오더 번호
  supplierCode?: string;
  supplierName?: string;
  itemCode: string;
  itemName: string;
  lotNo: string;
  receiptQty: number;
  unit: string;
  unitPrice?: number;
  totalAmount?: number;
  warehouseId: string;
  locationId?: string;
  receivedBy: string;
  receivedByName: string;
  iqcRequired: boolean;
  status: 'RECEIVED' | 'IQC_WAITING' | 'IQC_PASSED' | 'IQC_FAILED' | 'STOCKED';
  description?: string;
  createdAt: string;
  updatedAt: string;
}

/** 재고 조정 로그 */
export interface InvAdjLog {
  id: string;
  adjustNo: string;
  adjustDate: string;
  adjustType: InventoryMoveType;
  adjustReason: string;
  itemCode: string;
  itemName: string;
  lotNo?: string;
  warehouseId: string;
  locationId?: string;
  beforeQty: number;
  adjustQty: number;           // 양수: 증가, 음수: 감소
  afterQty: number;
  unit: string;
  adjustedBy: string;
  adjustedByName: string;
  approvedBy?: string;
  approvedAt?: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  description?: string;
  createdAt: string;
}

/** 재고 이동 */
export interface StockTransfer {
  id: string;
  transferNo: string;
  transferDate: string;
  transferType: 'WAREHOUSE' | 'LOCATION' | 'LINE';
  itemCode: string;
  itemName: string;
  lotNo?: string;
  transferQty: number;
  unit: string;
  fromWarehouseId: string;
  fromLocationId?: string;
  toWarehouseId: string;
  toLocationId?: string;
  transferredBy: string;
  transferredByName: string;
  status: 'REQUESTED' | 'IN_TRANSIT' | 'COMPLETED' | 'CANCELED';
  description?: string;
  createdAt: string;
  updatedAt: string;
}

/** 자재 예약 */
export interface MatReservation {
  id: string;
  reservationNo: string;
  jobOrderId: string;
  jobOrderNo: string;
  itemCode: string;
  itemName: string;
  lotNo?: string;
  reservedQty: number;
  issuedQty: number;
  unit: string;
  warehouseId: string;
  locationId?: string;
  reservedBy: string;
  reservedAt: string;
  expiryAt?: string;           // 예약 만료 시간
  status: 'RESERVED' | 'PARTIALLY_ISSUED' | 'FULLY_ISSUED' | 'CANCELED' | 'EXPIRED';
}

/** 보세 자재 추적 */
export interface BondedMaterial {
  id: string;
  lotNo: string;
  itemCode: string;
  itemName: string;
  blNo: string;                // B/L 번호
  invoiceNo: string;
  importDate: string;
  customsClearanceDate?: string;
  originalQty: number;
  currentQty: number;
  usedQty: number;
  unit: string;
  originCountry: string;
  hsCode: string;
  unitPrice: number;
  currency: string;
  totalAmount: number;
  status: 'IN_BOND' | 'CLEARED' | 'USED' | 'EXPORTED';
  exportDate?: string;
  exportDocNo?: string;
  createdAt: string;
  updatedAt: string;
}

/** 재고 현황 집계 */
export interface StockSummary {
  itemCode: string;
  itemName: string;
  itemType: string;
  unit: string;
  totalQty: number;
  reservedQty: number;
  availableQty: number;
  warehouseBreakdown: {
    warehouseCode: string;
    warehouseName: string;
    qty: number;
  }[];
  lotCount: number;
  oldestLotDate?: string;
  newestLotDate?: string;
}

/** 소모품 재고 */
export interface ConsumableStock {
  id: string;
  itemCode: string;
  itemName: string;
  itemCategory: string;
  currentQty: number;
  minStockQty: number;
  maxStockQty: number;
  reorderPoint: number;
  unit: string;
  lastReceiptDate?: string;
  lastIssueDate?: string;
  averageUsage?: number;       // 일평균 사용량
  daysOfStock?: number;        // 재고 일수
  status: 'NORMAL' | 'LOW' | 'CRITICAL' | 'OVER';
}
