/**
 * @file components/shared/carrier/carrierTypes.ts
 * @description 대차 흐름 프론트 타입 — 백엔드 CarrierFlowService 응답과 1:1
 */
export type CarrierContentKind = "SG" | "FG" | "MAT";
export type CarrierStatus = "EMPTY" | "LOADING" | "IN_TRANSIT";

export interface CarrierContentRow {
  kind: CarrierContentKind;
  barcode: string;
  itemCode: string;
  itemName: string | null;
  orderNo: string | null;
  qty: number;
  loadedAt: string | null;
  slipNo: string | null;
  issueProcessCode: string | null;
}

export interface CarrierStatusView {
  carrierNo: string;
  carrierType: string;
  carrierName: string | null;
  capacity: number | null;
  status: CarrierStatus;
  kind: CarrierContentKind | null;
  itemCode: string | null;
  itemName: string | null;
  orderNo: string | null;
  loadedCount: number;
  totalQty: number;
  slipNo: string | null;
  loadProcessCode: string | null;
  nextProcessCode: string | null;
  nextProcessName: string | null;
  contents: CarrierContentRow[];
}

export interface CarrierSlipView extends CarrierStatusView {
  slipNo: string;
  issuedAt: string;
  issuedBy: string;
  reprint: boolean;
  fromProcessCode: string | null;
  fromProcessName: string | null;
  toProcessCode: string | null;
  toProcessName: string | null;
}

export interface CarrierProcessFlags {
  carrierLoadYn: string;
  carrierAutoInputYn: string;
  issueLabelType: string;
}
