/**
 * @file quality/inspect/types.ts
 * @description 외관검사 이력 타입 정의 — FG_BARCODE 스캔 방식
 *
 * 초보자 가이드:
 * 1. FgLabelInfo: FG_BARCODE 스캔 시 조회되는 라벨 정보
 * 2. VisualInspectRecord: 외관검사 결과 레코드
 * 3. DefectCheckItem: 불량 체크리스트 항목
 */

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

/** 외관검사 결과 */
export interface VisualInspectRecord {
  resultNo: string;
  id: number;
  fgBarcode: string | null;
  inspectType: string;
  passYn: string;
  errorCode: string | null;
  errorDetail: string | null;
  inspectData: string | null;
  inspectAt: string;
  inspectorId: string | null;
}

/** 불량 체크리스트 항목 */
export interface DefectCheckItem {
  code: string;
  name: string;
  checked: boolean;
  qty: number;
  remark: string;
}
