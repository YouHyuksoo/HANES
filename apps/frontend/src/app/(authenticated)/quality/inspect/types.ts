/**
 * @file quality/inspect/types.ts
 * @description 외관검사 타입 정의 — 작업지시 선택 + FG_BARCODE 스캔 방식
 *
 * 초보자 가이드:
 * 1. JobOrderRow: 좌측 작업지시 목록 행
 * 2. FgLabelInfo: FG_BARCODE 스캔 시 조회되는 라벨 정보
 * 3. InspectHistoryRow: 작업지시별 검사 이력 행 (INSPECT_RESULTS 기반)
 */

import type { ProductionJobOrderRow } from "@harness/shared";

/** 작업지시 목록 행 (통전검사와 동일 구조) */
export type JobOrderRow = Pick<
  ProductionJobOrderRow,
  'orderNo' | 'itemCode' | 'lineCode' | 'planQty' | 'goodQty' | 'defectQty' | 'status'
> & {
  itemName?: string;
};

/** 검사 이력 행 (INSPECT_RESULTS 기반, VISUAL 필터) */
export interface InspectHistoryRow {
  resultNo: string;
  inspectType: string | null;
  passYn: string;
  fgBarcode: string | null;
  errorCode: string | null;
  errorDetail: string | null;
  inspectAt: string;
  inspectorId: string | null;
}

/** FG 라벨 정보 (바코드 스캔 시 조회) */
export interface FgLabelInfo {
  fgBarcode: string;
  itemCode: string;
  orderNo: string | null;
  equipCode: string | null;
  workerId: string | null;
  lineCode: string | null;
  issuedAt: string;
  status: string;
}
