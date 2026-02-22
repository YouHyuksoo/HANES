/**
 * @file src/app/(authenticated)/master/part/types.ts
 * @description 품목 마스터 타입 + 상수 정의 (Oracle TM_ITEMS 기준 보강)
 *
 * 초보자 가이드:
 * 1. **Part**: DB part_masters 테이블 대응 인터페이스
 * 2. **PartIqcLink**: RAW 품목에 IQC 검사그룹 코드 연결 (추후 DB 연동)
 * 3. seedParts 제거됨 - 모든 데이터는 API를 통해 DB에서 조회
 */

import type { UseYn } from "@/types";

/** 품목 분류 */
export type PartType = "RAW" | "WIP" | "FG";

/** 품목 인터페이스 */
export interface Part {
  id: string;
  partCode: string;
  partName: string;
  partNo?: string; // 품번 (Oracle PARTNO)
  custPartNo?: string; // 고객사 품번 (Oracle CUSTPARTNO)
  partType: PartType;
  productType?: string; // 제품유형 코드 (Oracle PRODUCTTYPE)
  spec?: string;
  rev?: string; // 리비전 (Oracle REV)
  unit?: string; // 단위 (기본값: EA)
  customer?: string;
  vendor?: string;
  safetyStock?: number; // 안전재고 (기본값: 0)
  lotUnitQty?: number; // LOT 단위수량 (Oracle LOTUNITQTY)
  boxQty?: number; // 박스 입수량 (Oracle BOXQTY) (기본값: 0)
  iqcYn?: UseYn; // IQC 대상여부 Y/N (Oracle IQCFLAG) (기본값: Y)
  tactTime?: number; // 택타임 초 (Oracle TACTTIME) (기본값: 0)
  expiryDate?: number; // 유효기간 일 (Oracle EXPIRYDATE) (기본값: 0)
  packUnit?: string; // 포장단위 (EA, BOX, BAG 등)
  storageLocation?: string; // 적재 로케이션 (창고 내 위치)
  remark?: string; // 비고 (Oracle REMARKS)
  useYn: UseYn;
}

/** 품목-검사그룹 연결 (추후 DB 테이블로 이관 예정) */
export interface PartIqcLink {
  partCode: string;
  groupCode: string;
  shelfLifeDays?: number;
}

/** 품목 분류별 색상 */
export const PART_TYPE_COLORS: Record<
  PartType,
  { label: string; color: string }
> = {
  RAW: {
    label: "원자재",
    color: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  },
  WIP: {
    label: "반제품",
    color: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
  },
  FG: {
    label: "완제품",
    color: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  },
};

/** 제품유형 옵션 */
export const PRODUCT_TYPE_OPTIONS = [
  { value: "", label: "전체" },
  { value: "2011", label: "하네스" },
  { value: "2012", label: "반제품" },
  { value: "2013", label: "원자재" },
  { value: "2014", label: "부자재" },
  { value: "7011", label: "김산K" },
];

/** IQC 연결 데이터 (추후 DB 연동 시 제거) */
export const seedPartIqcLinks: PartIqcLink[] = [];
