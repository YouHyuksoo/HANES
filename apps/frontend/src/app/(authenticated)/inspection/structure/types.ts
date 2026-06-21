"use client";

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

export interface StructureInspectRecord {
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

export interface DefectCheckItem {
  code: string;
  name: string;
  checked: boolean;
  qty: number;
  remark: string;
}
