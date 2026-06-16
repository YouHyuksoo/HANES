export interface EquipSummary {
  equipCode: string;
  equipName: string;
  equipType: string;
  lineCode: string | null;
}

export type InspectItemType = "VISUAL" | "MEASURE";

/** EQUIP_INSPECT_ITEM_MASTERS 기준 마스터 행 */
export interface InspectItemMasterRow {
  itemCode: string;
  inspectType: "DAILY" | "PERIODIC" | "PM" | "WORKER";
  equipType: string | null;
  itemName: string;
  criteria: string | null;
  cycle: string | null;
  useYn: string;
  remark: string | null;
  itemType: InspectItemType;
  unit: string | null;
  lslValue: number | null;
  uslValue: number | null;
  workerQrCode: string | null;
  imageUrl: string | null;
}

/** EQUIP_INSPECT_ITEM_POOL 연결 풀 행 (MASTERS JOIN 포함) */
export interface InspectItemRow {
  equipCode: string;
  itemCode: string;
  inspectType: "DAILY" | "PERIODIC" | "PM" | "WORKER";
  useYn: string;
  sortSeq: number | null;
  itemName: string | null;
  criteria: string | null;
  cycle: string | null;
  itemType: InspectItemType | null;
  unit: string | null;
  lslValue: number | null;
  uslValue: number | null;
  workerQrCode: string | null;
  imageUrl: string | null;
}

export const ITEM_TYPE_COLORS: Record<string, string> = {
  VISUAL: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  MEASURE: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900 dark:text-cyan-300",
};

export const INSPECT_TYPE_COLORS: Record<string, string> = {
  DAILY: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  PERIODIC: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
  PM: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
  WORKER: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
};

export const EQUIP_TYPE_COLORS: Record<string, string> = {
  CUTTING: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  CRIMPING: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
  ASSEMBLY: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  INSPECTION: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
  PACKING: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
};
