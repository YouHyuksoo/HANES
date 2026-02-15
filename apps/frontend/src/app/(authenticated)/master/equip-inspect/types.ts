/**
 * @file src/app/(authenticated)/master/equip-inspect/types.ts
 * @description 설비점검 관리 타입 + 시드 데이터
 */

/** 설비 요약 (좌측 목록용) */
export interface EquipSummary {
  id: string;
  equipCode: string;
  equipName: string;
  equipType: string;
  lineName: string;
}

/** 점검항목 마스터 (공통 풀) */
export interface InspectItemMaster {
  id: string;
  itemCode: string;
  itemName: string;
  inspectType: "DAILY" | "PERIODIC";
  /** 판정방법: VISUAL=육안, MEASURE=계측 */
  judgeMethod: "VISUAL" | "MEASURE";
  criteria: string;
  standardValue?: number;
  upperLimit?: number;
  lowerLimit?: number;
  unit?: string;
  cycle: string;
}

/** 설비-점검항목 연결 */
export interface EquipInspectLink {
  id: string;
  equipCode: string;
  itemCode: string;
  seq: number;
  useYn: string;
}

/* ── 시드: 설비 목록 ── */
export const seedEquipments: EquipSummary[] = [
  { id: "1", equipCode: "CUT-001", equipName: "절단기 1호", equipType: "CUTTING", lineName: "L1" },
  { id: "2", equipCode: "CUT-002", equipName: "절단기 2호", equipType: "CUTTING", lineName: "L1" },
  { id: "3", equipCode: "CRM-001", equipName: "압착기 1호", equipType: "CRIMPING", lineName: "L2" },
  { id: "4", equipCode: "CRM-002", equipName: "압착기 2호", equipType: "CRIMPING", lineName: "L2" },
  { id: "5", equipCode: "ASM-001", equipName: "조립기 1호", equipType: "ASSEMBLY", lineName: "L3" },
  { id: "6", equipCode: "INSP-01", equipName: "통전검사기 1호", equipType: "INSPECTION", lineName: "L4" },
  { id: "7", equipCode: "INSP-02", equipName: "통전검사기 2호", equipType: "INSPECTION", lineName: "L4" },
  { id: "8", equipCode: "PKG-001", equipName: "포장기 1호", equipType: "PACKING", lineName: "L5" },
];

/* ── 시드: 점검항목 마스터 ── */
export const seedInspectItems: InspectItemMaster[] = [
  { id: "m1", itemCode: "CHK-001", itemName: "블레이드 마모 확인", inspectType: "DAILY", judgeMethod: "VISUAL", criteria: "마모선 이하", cycle: "DAILY" },
  { id: "m2", itemCode: "CHK-002", itemName: "에어압력 확인", inspectType: "DAILY", judgeMethod: "MEASURE", criteria: "범위 이내", standardValue: 0.6, lowerLimit: 0.5, upperLimit: 0.7, unit: "MPa", cycle: "DAILY" },
  { id: "m3", itemCode: "CHK-003", itemName: "압착높이 확인", inspectType: "DAILY", judgeMethod: "MEASURE", criteria: "기준치 ±0.05mm", standardValue: 1.2, lowerLimit: 1.15, upperLimit: 1.25, unit: "mm", cycle: "DAILY" },
  { id: "m4", itemCode: "CHK-004", itemName: "접촉핀 상태 확인", inspectType: "DAILY", judgeMethod: "VISUAL", criteria: "변형/마모 없을것", cycle: "DAILY" },
  { id: "m5", itemCode: "CHK-005", itemName: "안전장치 동작 확인", inspectType: "DAILY", judgeMethod: "VISUAL", criteria: "정상 동작", cycle: "DAILY" },
  { id: "m6", itemCode: "CHK-006", itemName: "이물질 제거 확인", inspectType: "DAILY", judgeMethod: "VISUAL", criteria: "이물질 없음", cycle: "DAILY" },
  { id: "m7", itemCode: "CHK-007", itemName: "유압 오일 교환", inspectType: "PERIODIC", judgeMethod: "VISUAL", criteria: "3000h 또는 6개월", cycle: "MONTHLY" },
  { id: "m8", itemCode: "CHK-008", itemName: "캘리브레이션", inspectType: "PERIODIC", judgeMethod: "MEASURE", criteria: "기준 저항값 검증", standardValue: 100, lowerLimit: 95, upperLimit: 105, unit: "Ω", cycle: "MONTHLY" },
  { id: "m9", itemCode: "CHK-009", itemName: "벨트 장력 점검", inspectType: "PERIODIC", judgeMethod: "MEASURE", criteria: "범위 이내", standardValue: 12.5, lowerLimit: 10, upperLimit: 15, unit: "N", cycle: "WEEKLY" },
  { id: "m10", itemCode: "CHK-010", itemName: "윤활유 보충", inspectType: "PERIODIC", judgeMethod: "VISUAL", criteria: "지정 윤활유 사용", cycle: "WEEKLY" },
  { id: "m11", itemCode: "CHK-011", itemName: "전기 절연 저항 측정", inspectType: "PERIODIC", judgeMethod: "MEASURE", criteria: "하한 이상", lowerLimit: 1, unit: "MΩ", cycle: "MONTHLY" },
  { id: "m12", itemCode: "CHK-012", itemName: "배선 상태 점검", inspectType: "PERIODIC", judgeMethod: "VISUAL", criteria: "피복 손상 없을것", cycle: "MONTHLY" },
];

/* ── 시드: 설비-점검항목 연결 ── */
export const seedLinks: EquipInspectLink[] = [
  { id: "l1", equipCode: "CUT-001", itemCode: "CHK-001", seq: 1, useYn: "Y" },
  { id: "l2", equipCode: "CUT-001", itemCode: "CHK-002", seq: 2, useYn: "Y" },
  { id: "l3", equipCode: "CUT-001", itemCode: "CHK-005", seq: 3, useYn: "Y" },
  { id: "l4", equipCode: "CUT-001", itemCode: "CHK-007", seq: 4, useYn: "Y" },
  { id: "l5", equipCode: "CRM-001", itemCode: "CHK-003", seq: 1, useYn: "Y" },
  { id: "l6", equipCode: "CRM-001", itemCode: "CHK-005", seq: 2, useYn: "Y" },
  { id: "l7", equipCode: "CRM-001", itemCode: "CHK-007", seq: 3, useYn: "Y" },
  { id: "l8", equipCode: "CRM-001", itemCode: "CHK-010", seq: 4, useYn: "Y" },
  { id: "l9", equipCode: "INSP-01", itemCode: "CHK-004", seq: 1, useYn: "Y" },
  { id: "l10", equipCode: "INSP-01", itemCode: "CHK-008", seq: 2, useYn: "Y" },
  { id: "l11", equipCode: "INSP-01", itemCode: "CHK-011", seq: 3, useYn: "Y" },
  { id: "l12", equipCode: "INSP-02", itemCode: "CHK-004", seq: 1, useYn: "Y" },
  { id: "l13", equipCode: "INSP-02", itemCode: "CHK-008", seq: 2, useYn: "Y" },
  { id: "l14", equipCode: "ASM-001", itemCode: "CHK-005", seq: 1, useYn: "Y" },
  { id: "l15", equipCode: "ASM-001", itemCode: "CHK-006", seq: 2, useYn: "Y" },
  { id: "l16", equipCode: "ASM-001", itemCode: "CHK-009", seq: 3, useYn: "Y" },
];

export const INSPECT_TYPE_COLORS: Record<string, string> = {
  DAILY: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  PERIODIC: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
};

export const EQUIP_TYPE_COLORS: Record<string, string> = {
  CUTTING: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  CRIMPING: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
  ASSEMBLY: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  INSPECTION: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
  PACKING: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
};
