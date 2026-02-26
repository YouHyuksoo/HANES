/**
 * @file src/app/(authenticated)/material/receive/components/types.ts
 * @description 입고관리 타입 정의
 */

export interface PartInfo {
  id: string;
  itemCode: string;
  itemName: string;
  unit: string;
}

export interface LotInfo {
  id: string;
  lotNo: string;
  poNo?: string | null;
  vendor?: string | null;
  initQty?: number;
}

export interface WarehouseInfo {
  id: string;
  warehouseName: string;
}

/** 입고 가능 LOT (IQC 합격 + 미입고) */
export interface ReceivableLot {
  id: string;
  lotNo: string;
  itemCode: string;
  itemType: string;
  initQty: number;
  currentQty: number;
  recvDate?: string | null;
  manufactureDate?: string | null;
  expireDate?: string | null;
  expiryDays?: number;
  poNo?: string | null;
  vendor?: string | null;
  iqcStatus: string;
  receivedQty: number;
  remainingQty: number;
  part: PartInfo;
  arrivalWarehouse?: WarehouseInfo | null;
}

/** 입고 이력 레코드 */
export interface ReceivingRecord {
  id: string;
  receiveNo?: string;
  transNo: string;
  transDate: string;
  qty: number;
  status: string;
  remark?: string | null;
  part: PartInfo;
  lot?: LotInfo | null;
  toWarehouse?: WarehouseInfo | null;
}

/** 입고 통계 */
export interface ReceivingStats {
  pendingCount: number;
  pendingQty: number;
  todayReceivedCount: number;
  todayReceivedQty: number;
}

/** 일괄 입고 입력 항목 */
export interface ReceiveInput {
  lotId: string;
  qty: number;
  warehouseCode: string;
  manufactureDate: string;
  selected: boolean;
}
