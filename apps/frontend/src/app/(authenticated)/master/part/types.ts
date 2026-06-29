/**
 * @file src/app/(authenticated)/master/part/types.ts
 * @description 품목 마스터 타입 + 상수 정의 (Oracle TM_ITEMS 기준 보강)
 */

import type { ItemTypeValue, UseYnValue } from "@harness/shared";

/** 품목 분류 */
export type PartType = ItemTypeValue;

/** 품목 인터페이스 */
export interface Part {
  itemCode: string;
  itemName: string;
  itemNo?: string; // 품번 (Oracle PARTNO)
  custPartNo?: string; // 고객사 품번 (Oracle CUSTPARTNO)
  modelName?: string | null; // 차종
  defectModelGroup?: string | null; // 불량 모델구분
  itemType: PartType;
  productType?: string; // 제품유형 코드 (Oracle PRODUCTTYPE)
  spec?: string;
  rev?: string; // 리비전 (Oracle REV)
  markingText?: string | null; // 마킹 문구
  unit?: string; // 단위 (기본값: EA)
  color?: string | null; // 색상 (Oracle COLOR)
  safetyStock?: number; // 안전재고 (기본값: 0)
  lotUnitQty?: number; // LOT 단위수량 (Oracle LOTUNITQTY)
  boxQty?: number; // 박스 장입수량 (Oracle BOXQTY) (기본값: 0)
  minPackQty?: number; // 최소포장단위 수량 (기본값: 0)
  iqcYn?: UseYnValue; // IQC 대상여부 Y/N (Oracle IQCFLAG) (기본값: Y)
  inspectMethod?: string; // 검사구분 (FULL/SKIP)
  sampleQty?: number | null; // 기본시료수
  iqcAqlPolicyCode?: string | null; // IQC AQL 정책 코드
  expiryDate?: number; // 유효기간 일 (Oracle EXPIRYDATE) (기본값: 0)
  expiryExtDays?: number; // 유효기간 연장 최대 일수 (Oracle EXPIRY_EXT_DAYS) (기본값: 0)
  packUnit?: number; // 팔레트 구성 단위(팔레트당 박스 수)
  storageLocation?: string; // 적재 로케이션 (창고 내 위치)
  remark?: string; // 비고 (Oracle REMARKS)
  imageUrl?: string | null;
  useYn: UseYnValue;
}

/** 품목 분류별 색상 */
export const PART_TYPE_COLORS: Record<
  PartType,
  { label: string; color: string }
> = {
  RAW_MATERIAL: {
    label: "원자재",
    color: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  },
  SEMI_PRODUCT: {
    label: "반제품",
    color: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
  },
  FINISHED: {
    label: "완제품",
    color: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  },
  CONSUMABLE: {
    label: "소모품",
    color: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
  },
};
