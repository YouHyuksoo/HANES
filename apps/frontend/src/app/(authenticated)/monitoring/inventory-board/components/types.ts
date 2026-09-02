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

/** 재고 전광판 스킨 공통 props — page.tsx가 데이터/순환 상태를 내려준다 */
export interface InventorySkinProps {
  kpi?: InventoryKpi;
  shortages: ShortageItem[];
  /** 자동 순환된 안전재고 미달 슬라이스 (목록형 스킨용) */
  shortagePageItems: ShortageItem[];
  page: number;
  pageCount: number;
  expiry: ExpiryLot[];
  holds: HoldStock[];
  rollingSec: number;
  updatedAt: string;
}

/** 보류/불량 사유 코드 → i18n 키 (스킨 공통) */
export function holdReasonKey(reason: string): string | null {
  switch (reason) {
    case "HOLD": return "monitoring.board.inventory.reasonHold";
    case "IQC_FAIL": return "monitoring.board.inventory.reasonIqcFail";
    case "IQC_HOLD": return "monitoring.board.inventory.reasonIqcHold";
    case "DEFECT": return "monitoring.board.inventory.reasonDefect";
    default: return null;
  }
}

/** 조치 필요 총 건수 (0이면 정상) */
export function actionTotal(kpi?: InventoryKpi): number {
  if (!kpi) return 0;
  return kpi.shortageCount + kpi.expiredCount + kpi.nearExpiryCount + kpi.holdCount;
}
