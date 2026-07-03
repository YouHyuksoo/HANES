export type TraceSearchMode =
  | 'product'
  | 'material'
  | 'supplierLot'
  | 'box'
  | 'pallet'
  | 'shipOrder'
  | 'equipment'
  | 'operator'
  | 'workOrder'
  | 'sg';

export interface TraceCandidate {
  traceKey: string;
  traceType: 'FG' | 'SG';
  itemCode: string | null;
  itemName: string | null;
  orderNo: string | null;
  status: string | null;
  eventDate: string | null;
  sourceLabel: string;
  sourceValue: string;
}

export interface TraceCandidatesResult {
  candidates: TraceCandidate[];
  requiresConfirmation: boolean;
  total: number;
  limit: number;
  message: string | null;
}

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

export interface StockMove {
  transNo: string;
  transType: string;
  transDate: string;
  qty: number;
  fromWarehouse: string | null;
  fromWarehouseName: string | null;
  toWarehouse: string | null;
  toWarehouseName: string | null;
  refType: string | null;
  refId: string | null;
  remark: string | null;
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
  stockHistory: StockMove[];
}

export interface SemiProductTrace {
  sgBarcode: string;
  itemCode: string;
  itemName: string;
  consumedQty: number;
  status: string;
  warehouseCode: string | null;
  issueProcessCode: string | null;
  processHistory: ProcessStep[];
  inspections: InspectionRecord[];
  materials: MaterialTrace[];
}

export interface EquipInspectionItem {
  name: string;
  result: string;
  remark: string | null;
}

export interface EquipInspection {
  equipCode: string;
  equipName: string;
  inspectType: string;
  inspectDate: string | null;
  inspectAt: string | null;
  inspectorName: string | null;
  overallResult: string;
  remark: string | null;
  items: EquipInspectionItem[];
}

export interface EquipConsumable {
  consumableCode: string;
  consumableName: string;
  equipCode: string;
  action: string;
  mountAt: string | null;
  workerId: string | null;
  remark: string | null;
  expectedLife: number | null;
  currentCount: number | null;
  warningCount: number | null;
  lifeStatus: string | null;
}

export interface DefectRecord {
  defectCode: string;
  defectName: string;
  qty: number;
  status: string;
  cause: string | null;
  occurAt: string | null;
}

export interface RepairRecord {
  source: 'REPAIR' | 'REWORK';
  refNo: string;
  status: string;
  result: string | null;
  defectType: string | null;
  workerId: string | null;
  startAt: string | null;
  endAt: string | null;
  remark: string | null;
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
    shipOrderNo: string | null;
    customerPoNo: string | null;
    customerName: string | null;
  };
  materials: MaterialTrace[];
  semiProducts: SemiProductTrace[];
  equipInspections: EquipInspection[];
  equipConsumables: EquipConsumable[];
  defects: DefectRecord[];
  repairs: RepairRecord[];
}
