export interface IntegratedStepState {
  inspectType: "CONTINUITY" | "LEAK" | "HIPOT" | "STRUCTURE" | "TORQUE";
  labelKey: string;
  passYn: "Y" | "N" | null;
  errorCode: string;
  errorDetail: string;
  chargeBar?: string;
  holdBar?: string;
  holdSeconds?: string;
  voltageKv?: string;
  currentMa?: string;
  testSeconds?: string;
  torque?: string;
}

export interface IntegratedInspectApiResponse {
  overallPass: boolean;
  fgBarcode: string | null;
  inspectResultIds: string[];
  stepResults: Array<{
    inspectType: string;
    passYn: string;
    resultNo: string;
  }>;
}

export interface IntegratedJobOrderRow {
  orderNo: string;
  itemCode: string;
  itemName?: string;
  lineCode: string;
  planQty: number;
  goodQty: number;
  defectQty: number;
  status: string;
}
