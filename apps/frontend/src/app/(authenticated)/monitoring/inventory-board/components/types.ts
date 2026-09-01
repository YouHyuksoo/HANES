/**
 * @file src/app/(authenticated)/monitoring/inventory-board/components/types.ts
 * @description 재고 보드 API 응답 타입 — GET /monitoring/boards/inventory
 */

export interface InventoryKpi {
  materialQty: number;
  materialItems: number;
  semiQty: number;
  semiItems: number;
  finishedQty: number;
  finishedItems: number;
}

export interface ShortageItem {
  itemCode: string;
  itemName: string | null;
  qty: number;
  safetyStock: number;
  shortage: number;
}

export interface WarehouseStock {
  warehouseCode: string;
  stockKind: "MATERIAL" | "PRODUCT";
  itemCount: number;
  qty: number;
}

export interface TodayInOut {
  inCount: number;
  inQty: number;
  outCount: number;
  outQty: number;
}

export interface InventoryBoardData {
  kpi: InventoryKpi;
  shortages: ShortageItem[];
  byWarehouse: WarehouseStock[];
  todayInOut: TodayInOut;
}
