/**
 * @file src/app/(authenticated)/monitoring/inventory-board/components/types.ts
 * @description 재고 보드 API 응답 타입 — GET /monitoring/boards/inventory
 *              "조치가 필요한 재고"만 담는다 (총수량 합계 없음).
 */

export interface InventoryKpi {
  shortageCount: number;
  expiredCount: number;
  nearExpiryCount: number;
  holdCount: number;
  inCount: number;
  outCount: number;
}

export interface ShortageItem {
  itemCode: string;
  itemName: string | null;
  qty: number;
  safetyStock: number;
  shortage: number;
}

export interface ExpiryLot {
  matUid: string;
  itemCode: string;
  itemName: string | null;
  qty: number;
  expireDate: string;
  /** 음수면 기한초과 */
  daysLeft: number;
}

export interface HoldStock {
  kind: "MATERIAL" | "PRODUCT";
  ref: string;
  itemCode: string;
  itemName: string | null;
  qty: number;
  /** HOLD | IQC_FAIL | IQC_HOLD | DEFECT */
  reason: string;
}

export interface InventoryBoardData {
  kpi: InventoryKpi;
  shortages: ShortageItem[];
  expiry: ExpiryLot[];
  holds: HoldStock[];
}
