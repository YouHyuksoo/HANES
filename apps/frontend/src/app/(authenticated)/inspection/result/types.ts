/**
 * @file inspection/result/types.ts
 * @description 통전검사 관리 타입 정의
 *
 * 초보자 가이드:
 * 1. JobOrderRow: 작업지시 목록에 표시되는 행 데이터
 * 2. FgLabelRow: FG 바코드 발행 이력 행 데이터
 * 3. InspectStats: 검사 통계 (합격/불합격 수, 합격률)
 */

import type { ProductionJobOrderRow } from "@harness/shared";

/** 작업지시 목록 행 */
export type JobOrderRow = Pick<
  ProductionJobOrderRow,
  'orderNo' | 'itemCode' | 'lineCode' | 'planQty' | 'goodQty' | 'defectQty' | 'status'
> & {
  itemName?: string;
};

/** FG 바코드 발행 이력 행 */
export interface FgLabelRow {
  fgBarcode: string;
  itemCode: string;
  orderNo: string;
  issuedAt: string;
  status: string;
  reprintCount: number;
  /** 통전검사 합부 (N이면 재검사 가능) */
  inspectPassYn?: string | null;
  /** 회로라벨 (설비 출력 바코드, 스캔 모드 PASS 시 매핑) */
  circuitLabel?: string | null;
}

/** 검사 이력 행 (INSPECT_RESULTS 기반) */
export interface InspectHistoryRow {
  resultNo: string;
  inspectType: string | null;
  passYn: string;
  fgBarcode: string | null;
  circuitLabel: string | null;
  errorCode: string | null;
  errorDetail: string | null;
  inspectAt: string;
  equipCode: string | null;
  inspectorId: string | null;
}

/** 검사 통계 */
export interface InspectStats {
  total: number;
  passed: number;
  failed: number;
  passRate: number;
  planQty: number;
  labelCount: number;
}
