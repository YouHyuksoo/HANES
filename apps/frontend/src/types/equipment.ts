/**
 * @file src/types/equipment.ts
 * @description 설비관리 페이지 공통 타입 정의
 *
 * @deprecated 새 코드에서는 @harness/shared 또는 화면별 types.ts를 사용하세요.
 */

import type { Equipment, EquipStatusValue, EquipTypeValue, UseYnValue } from "@harness/shared";

export type EquipmentStatus = EquipStatusValue;
export type EquipType = EquipTypeValue;

/** @deprecated UseYn으로 대체 */
export type UseYnStatus = UseYnValue;

/** 소모품 상태 타입 */
export type PartStatus = "OK" | "WARNING" | "REPLACE";

/** 소모품 카테고리 타입 */
export type PartCategory = "MOLD" | "JIG" | "TOOL";

/** @deprecated @harness/shared의 Equipment를 사용하세요 */
export type { Equipment };

/** 소모품 인터페이스 */
export interface ConsumablePart {
  id: string;
  itemCode: string;
  itemName: string;
  category: PartCategory;
  currentShots: number;
  expectedLife: number;
  status: PartStatus;
  lastReplacedAt: string;
  equipCode?: string;
  remark?: string;
}

/** 설비 유형 라벨 */
export const equipTypeLabels: Record<EquipType, string> = {
  COMMON: "공통",
  AUTO_CRIMP: "자동압착",
  SINGLE_CUT: "단선절단",
  MULTI_CUT: "다발절단",
  TWIST: "트위스트",
  SOLDER: "솔더링",
  HOUSING: "하우징",
  TESTER: "테스터",
  LABEL_PRINTER: "라벨프린터",
  INSPECTION: "검사",
  PACKING: "포장",
  OTHER: "기타",
};

/** 소모품 카테고리 라벨 */
export const categoryLabels: Record<PartCategory, string> = {
  MOLD: "금형",
  JIG: "지그",
  TOOL: "공구",
};
