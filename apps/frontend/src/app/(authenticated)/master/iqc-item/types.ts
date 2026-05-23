/**
 * @file src/app/(authenticated)/master/iqc-item/types.ts
 * @description IQC 검사항목/검사그룹 공통 타입 및 색상 상수
 *
 * 초보자 가이드:
 * 1. 판정방법(VISUAL/MEASURE) 및 검사형태(FULL/SAMPLE/SKIP) 색상 정의
 * 2. 실제 데이터는 API(/master/iqc-item-pool, /master/iqc-groups)에서 조회
 */

export type InspectMethod = "FULL" | "SAMPLE" | "SKIP";

export const JUDGE_METHOD_COLORS: Record<string, string> = {
  VISUAL: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  MEASURE: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900 dark:text-cyan-300",
};

export const INSPECT_METHOD_COLORS: Record<string, string> = {
  FULL: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
  SAMPLE: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
  SKIP: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
};

// 검사항목 풀 (전역 마스터)
export interface IqcPoolItem {
  inspItemCode: string;
  inspItemName: string;
  judgeMethod: 'VISUAL' | 'MEASURE';
  unit: string | null;
  useYn: string;
}

// 품목별 IQC 검사항목 행
export interface IqcSpecRow {
  seq: number;
  inspItemCode: string;
  inspItemName?: string;
  judgeMethod?: 'VISUAL' | 'MEASURE';
  unit?: string | null;
  lsl: number | null;
  usl: number | null;
  useYn: string;
}

// 품목별 IQC 기준 전체
export interface IqcPartSpec {
  itemCode: string;
  sampleQty: number;
  isDest: string;
  useYn: string;
  items: IqcSpecRow[];
}
