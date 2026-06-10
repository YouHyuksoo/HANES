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
  /** 회로라벨 (설비 출력 바코드, 스캔 모드 PASS 시 매핑) */
  circuitLabel?: string | null;
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
