export interface ProcessStep {
  process: string;
  processName: string;
  equipmentNo: string;
  equipmentName: string;
  operator: string;
  timestamp: string;
  result: 'PASS' | 'FAIL' | 'WORK';
  goodQty: number | null;
  defectQty: number | null;
  detail: string | null;
}

export interface InspectionRecord {
  inspectType: string;
  result: 'PASS' | 'FAIL';
  inspectorId: string;
  inspectAt: string;
  equipCode: string | null;
  errorDetail: string | null;
}

export interface MaterialTrace {
  matUid: string;
  itemCode: string;
  itemName: string;
  usedQty: number;
  unit: string;
  vendorCode: string | null;
  vendorName: string | null;
  po: { poNo: string; orderDate: string | null; partnerName: string | null } | null;
  arrival: { arrivalNo: string; arrivalDate: string | null; qty: number } | null;
  iqc: { result: string; inspectType: string; inspectorName: string | null; inspectDate: string | null; certFilePath: string | null } | null;
  receiving: { receiveNo: string; receiveDate: string | null } | null;
  issue: { orderNo: string | null; issueQty: number; issueDate: string | null } | null;
}

export interface SemiProductTrace {
  sgBarcode: string;
  itemCode: string;
  itemName: string;
  consumedQty: number;
  status: string;
  issueProcessCode: string | null;
  processHistory: ProcessStep[];
  inspections: InspectionRecord[];
  materials: MaterialTrace[];
}

export interface ProductTraceabilityDto {
  product: {
    serialNo: string;
    itemCode: string;
    itemNo: string;
    itemName: string;
    orderNo: string | null;
    status: string;
    issuedAt: string | null;
    productionDate: string | null;
  };
  processHistory: ProcessStep[];
  inspections: InspectionRecord[];
  packaging: {
    boxNo: string | null;
    boxPackedAt: string | null;
    palletNo: string | null;
    palletPackedAt: string | null;
    shippedAt: string | null;
  };
  materials: MaterialTrace[];
  semiProducts: SemiProductTrace[];
}
