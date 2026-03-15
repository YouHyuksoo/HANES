/**
 * @file src/app/(authenticated)/master/equip-inspect/types.ts
 * @description 설비점검 관리 타입 정의
 *
 * 초보자 가이드:
 * 1. InspectItemRow: DB 엔티티(EQUIP_INSPECT_ITEM_MASTERS) 복합키 매핑
 * 2. EquipSummary: 좌측 설비 목록용 경량 타입
 */

/** 설비 요약 (좌측 목록용) */
export interface EquipSummary {
  equipCode: string;
  equipName: string;
  equipType: string;
  lineCode: string | null;
}

/** 점검항목 (DB 엔티티 매핑 - 복합키) */
export interface InspectItemRow {
  equipCode: string;
  inspectType: "DAILY" | "PERIODIC" | "PM";
  seq: number;
  itemName: string;
  criteria: string | null;
  cycle: string | null;
  useYn: string;
}

/** 점검항목 생성/수정 DTO */
export interface InspectItemFormData {
  equipCode: string;
  inspectType: "DAILY" | "PERIODIC" | "PM";
  seq: number;
  itemName: string;
  criteria?: string;
  cycle?: string;
  useYn?: string;
}

export const INSPECT_TYPE_COLORS: Record<string, string> = {
  DAILY: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  PERIODIC: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
  PM: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
};

export const EQUIP_TYPE_COLORS: Record<string, string> = {
  CUTTING: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  CRIMPING: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
  ASSEMBLY: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  INSPECTION: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
  PACKING: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
};
