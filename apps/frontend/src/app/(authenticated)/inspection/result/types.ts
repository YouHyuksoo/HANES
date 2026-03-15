/**
 * @file inspection/result/types.ts
 * @description 통전검사 관리 타입 정의
 *
 * 초보자 가이드:
 * 1. JobOrderRow: 작업지시 목록에 표시되는 행 데이터
 * 2. FgLabelRow: FG 바코드 발행 이력 행 데이터
 * 3. InspectStats: 검사 통계 (합격/불합격 수, 합격률)
 */

/** 작업지시 목록 행 */
export interface JobOrderRow {
  orderNo: string;
  itemCode: string;
  itemName?: string;
  lineCode?: string;
  planQty: number;
  goodQty: number;
  defectQty: number;
  status: string;
}

/** FG 바코드 발행 이력 행 */
export interface FgLabelRow {
  fgBarcode: string;
  itemCode: string;
  orderNo: string;
  issuedAt: string;
  status: string;
  reprintCount: number;
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
