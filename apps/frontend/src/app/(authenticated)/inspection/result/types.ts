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
  /** HIPOT/LEAK 측정값 JSON (voltageKv/currentMa/testSeconds/insulationMohm/chargeBar/holdBar/holdSeconds) */
  inspectData?: string | null;
}

/** 측정형 검사(내전압·리크) 실측 입력값 — 문자열 상태로 두고 전송 시 숫자로 바꾼다 */
export interface InspectMeasureForm {
  voltageKv: string;
  currentMa: string;
  testSeconds: string;
  insulationMohm: string;
  chargeBar: string;
  holdBar: string;
  holdSeconds: string;
}

export const EMPTY_MEASURE_FORM: InspectMeasureForm = {
  voltageKv: "", currentMa: "", testSeconds: "", insulationMohm: "", chargeBar: "", holdBar: "", holdSeconds: "",
};

/** 검사유형별 측정 항목 — 순서대로 입력칸을 그린다. required 는 판정 버튼 활성 조건 */
export const MEASURE_FIELDS: Record<"HIPOT" | "LEAK", Array<{ key: keyof InspectMeasureForm; required: boolean }>> = {
  HIPOT: [
    { key: "voltageKv", required: true },
    { key: "currentMa", required: true },
    { key: "testSeconds", required: false },
    { key: "insulationMohm", required: false },
  ],
  LEAK: [
    { key: "chargeBar", required: false },
    { key: "holdBar", required: true },
    { key: "holdSeconds", required: false },
  ],
};

export function isMeasuredInspectType(inspectType: string): inspectType is "HIPOT" | "LEAK" {
  return inspectType === "HIPOT" || inspectType === "LEAK";
}

/** 이력 그리드용 측정값 요약 — "3kV · 0.8mA · 950MΩ" / "0.7bar · 0.68bar · 2s" */
export function formatMeasuredSummary(inspectType: string | null, inspectData: string | null | undefined): string {
  if (!inspectData || !inspectType || !isMeasuredInspectType(inspectType)) return "";
  let data: Record<string, unknown>;
  try { data = JSON.parse(inspectData) as Record<string, unknown>; } catch { return ""; }
  const unit: Record<keyof InspectMeasureForm, string> = {
    voltageKv: "kV", currentMa: "mA", testSeconds: "s", insulationMohm: "MΩ", chargeBar: "bar", holdBar: "bar", holdSeconds: "s",
  };
  return MEASURE_FIELDS[inspectType]
    .map(({ key }) => (data[key] === null || data[key] === undefined || data[key] === "") ? null : `${data[key]}${unit[key]}`)
    .filter((v): v is string => Boolean(v))
    .join(" · ");
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
