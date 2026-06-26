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
  matUid: string;
  poNo?: string | null;
  vendor?: string | null;
  initQty?: number;
  iqcStatus?: string | null;
  specialAcceptYn?: string | null;
}

export interface WarehouseInfo {
  id: string;
  warehouseName: string;
}

/** 입고 가능 LOT (IQC 합격 + 미입고) */
export interface ReceivableLot {
  matUid: string;
  itemCode: string;
  itemType: string;
  initQty: number;
  recvDate?: string | null;
  manufactureDate?: string | null;
  expireDate?: string | null;
  expiryDays?: number;
  poNo?: string | null;
  vendor?: string | null;
  vendorName?: string | null;
  iqcStatus: string;
  receivedQty: number;
  remainingQty: number;
  part: PartInfo;
  arrivalWarehouse?: WarehouseInfo | null;
  arrivalWarehouseCode?: string | null;
  certRequired?: boolean;
  certUploaded?: boolean;
  receivingBlockedReason?: string | null;
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
  /** 공급처(LOT 입고 거래처 코드) */
  vendor?: string | null;
  /** 공급사명 */
  vendorName?: string | null;
  /** 제조사명 */
  manufacturer?: string | null;
  /** 양산/MRO 구분: 'PROD'=양산, 'MRO'=소모품 */
  materialClass?: 'PROD' | 'MRO' | null;
  /** IQC FAIL LOT을 특채 승인 후 입고한 이력 여부 */
  isConcession?: boolean;
  /** 원 LOT의 SPECIAL_ACCEPT_YN */
  specialAcceptYn?: string | null;
}

/** 입고 통계 */
export interface ReceivingStats {
  pendingCount: number;
  pendingQty: number;
  todayReceivedCount: number;
  todayReceivedQty: number;
}

export interface ReceiveScanPair {
  vendorBarcode: string;
  matUid: string;
}
