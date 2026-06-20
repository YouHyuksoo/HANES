/**
 * @file src/app/(authenticated)/master/iqc-item/types.ts
 * @description IQC 검사항목/검사그룹 공통 타입 및 색상 상수
 *
 * 초보자 가이드:
 * 1. 판정방법(VISUAL/MEASURE) 및 검사구분(FULL/SKIP) 색상 정의
 * 2. 실제 데이터는 API(/master/iqc-item-pool, /master/iqc-groups)에서 조회
 */

export type InspectMethod = "FULL" | "SKIP";

export const JUDGE_METHOD_COLORS: Record<string, string> = {
  VISUAL: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  MEASURE: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900 dark:text-cyan-300",
};

export const INSPECT_METHOD_COLORS: Record<string, string> = {
  FULL: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
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
  judgeCriteria?: string | null;
  // 검사기준서: 검사항목별 불량등급/검사수준/AQL
  defectGrade?: string | null;       // CRITICAL/MAJOR/MINOR
  inspectionLevel?: string | null;   // II, S4 ... (AQL_INSP_LEVEL)
  aql?: number | null;               // AQL_VALUE
  inspectionType?: string | null;   // AQL/DESTRUCTIVE/FULL (IQC_ITEM_INSP_TYPE)
  sampleMethod?: string | null;     // AQL/FIXED (IQC_SAMPLE_METHOD)
  sampleQty?: number | null;        // FIXED/DESTRUCTIVE 고정 샘플수
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

// IQC 항목 템플릿
export interface IqcTemplate {
  templateId: string;
  templateName: string;
  sampleQty: number;
  isDest: string;
  items: IqcSpecRow[];
}
