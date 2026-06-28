export interface InspectHistoryRow {
  resultNo: string;
  prodResultNo: string | null;
  inspectType: string;
  inspectScope: string | null;
  passYn: string;
  fgBarcode: string | null;
  errorCode: string | null;
  errorDetail: string | null;
  inspectAt: string;
  inspectorId: string | null;
}
