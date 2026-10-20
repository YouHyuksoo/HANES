/**
 * @file inspection/terminal-result/types.ts
 * @description 절압물검사 화면 타입 — /quality/crimp-inspect 응답 형태
 */
import type { CrimpSpecLimits } from "@harness/shared";

export interface CrimpOrderRow {
  orderNo: string;
  itemCode: string;
  itemName: string | null;
  processCode: string;
  processName: string | null;
  equipCode: string | null;
  planQty: number;
  goodQty: number;
  defectQty: number;
  status: string;
  planDate: string | null;
  inspectCount: number;
  failCount: number;
}

export type CrimpSideStatus = "OK" | "NO_WIRE" | "MULTI_WIRE" | "NO_SPEC" | "DUP_SPEC";

export interface CrimpSideSpec extends CrimpSpecLimits {
  specId: number;
  wireSize: string;
  applicatorCode: string | null;
}

export interface CrimpInspectSide {
  sideKey: string;
  side: string | null;
  terminalItemCode: string;
  terminalName: string | null;
  terminalSpec: string | null;
  wireItemCode: string | null;
  wireName: string | null;
  wireSpec: string | null;
  status: CrimpSideStatus;
  spec: CrimpSideSpec | null;
}

export interface CrimpInspectContext {
  order: { orderNo: string; itemCode: string; itemName: string | null; processCode: string; processName: string | null; status: string };
  sides: CrimpInspectSide[];
  visualChecks: Array<{ code: string; name: string }>;
  ready: boolean;
}

export interface CrimpInspectHistoryRow {
  resultNo: string;
  passYn: string;
  errorCode: string | null;
  errorDetail: string | null;
  inspectData: string | null;
  inspectorId: string | null;
  inspectAt: string;
}
