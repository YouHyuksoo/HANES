/**
 * @file packages/shared/src/types/traceability.ts
 * @description 4M 추적성 관련 타입 정의
 */

/** 4M 추적 정보 */
export interface Traceability4M {
  /** 자재 (Material) */
  material: MaterialTrace;
  /** 작업자 (Man) */
  operator: OperatorTrace;
  /** 설비 (Machine) */
  machine: MachineTrace;
  /** 방법/조건 (Method) */
  method: MethodTrace;
}

/** 자재 추적 정보 */
export interface MaterialTrace {
  lotNo: string;
  itemCode: string;
  itemName: string;
  supplierCode?: string;
  supplierName?: string;
  receiptDate?: string;
  expiryDate?: string;
}

/** 작업자 추적 정보 */
export interface OperatorTrace {
  employeeId: string;
  employeeName: string;
  workStation?: string;
  shiftCode?: string;
}

/** 설비 추적 정보 */
export interface MachineTrace {
  equipmentId: string;
  equipmentName: string;
  equipmentType?: string;
  applicatorId?: string;     // 금형(압착)
  bladeId?: string;          // 날(절단)
}

/** 방법/조건 추적 정보 */
export interface MethodTrace {
  workOrderNo: string;
  processCode: string;
  bomRevision?: string;
  standardConditions?: Record<string, unknown>;
  actualConditions?: Record<string, unknown>;
}

/** 박스/팔레트 추적 정보 */
export interface BoxPalletTrace {
  boxQrCode?: string;
  palletQrCode?: string;
  serialNumbers?: string[];
  productionDate: string;
  lineCode: string;
  trace4M: Traceability4M;
}

/** 불량/수리 이력 */
export interface DefectRepairHistory {
  defectCode: string;
  defectName: string;
  defectQty: number;
  repairStatus: string;
  repairOperatorId?: string;
  repairDate?: string;
  repairNote?: string;
  finalJudgment?: string;
}
