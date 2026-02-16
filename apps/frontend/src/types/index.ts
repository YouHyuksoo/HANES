/**
 * @file src/types/index.ts
 * @description 전역 타입 정의
 */

// ========================================
// 공통 타입
// ========================================

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  errorCode?: string;
  timestamp?: string;
}

export interface PaginationParams {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

// ========================================
// 사용자 관련 타입
// ========================================

export interface User {
  id: string;
  username: string;
  name: string;
  email?: string;
  role: UserRole;
  department?: string;
  isActive: boolean;
}

export type UserRole = "admin" | "manager" | "operator" | "viewer";

// ========================================
// 생산 관련 타입
// ========================================

export interface JobOrder {
  id: string;
  orderNo: string;
  partCode: string;
  partName: string;
  orderQty: number;
  completedQty: number;
  lineCode: string;
  status: JobOrderStatus;
  planStartDate: string;
  planEndDate: string;
  actualStartDate?: string;
  actualEndDate?: string;
}

export type JobOrderStatus =
  | "WAITING"
  | "RUNNING"
  | "PAUSED"
  | "DONE"
  | "CANCELED";

export interface ProductionResult {
  id: string;
  jobOrderId: string;
  equipId: string;
  workerId: string;
  goodQty: number;
  defectQty: number;
  startAt: string;
  endAt?: string;
  shiftCode: string;
}

// ========================================
// 자재 관련 타입
// ========================================

export interface MaterialLot {
  id: string;
  lotNo: string;
  partCode: string;
  partName: string;
  qty: number;
  remainQty: number;
  receivedAt: string;
  expiryDate?: string;
  warehouseCode: string;
  status: MaterialStatus;
}

/** IQC 상태 (자재 품질 검사 상태) */
export type MaterialStatus = "PENDING" | "PASS" | "FAIL" | "HOLD";

// ========================================
// 품질 관련 타입
// ========================================

export interface InspectionResult {
  id: string;
  serialNo: string;
  productionResultId: string;
  inspectType: string;
  result: "pass" | "fail";
  errorCode?: string;
  inspectedAt: string;
  inspectorId: string;
}

export interface DefectLog {
  id: string;
  serialNo?: string;
  lotNo?: string;
  defectCode: string;
  defectName: string;
  qty: number;
  status: DefectStatus;
  detectedAt: string;
  processCode: string;
}

export type DefectStatus =
  | "PENDING"
  | "REPAIRING"
  | "COMPLETED"
  | "SCRAPPED";

// ========================================
// 설비 관련 타입
// ========================================

export interface Equipment {
  id: string;
  equipCode: string;
  equipName: string;
  equipType: EquipType;
  lineCode: string;
  status: EquipmentStatus;
  ipAddress?: string;
  commType?: CommType;
  manufacturer?: string;
  model?: string;
  useYn?: UseYn;
}

/** 설비 상태 */
export type EquipmentStatus = "NORMAL" | "MAINT" | "STOP";

/** 설비 유형 */
export type EquipType =
  | "AUTO_CRIMP"
  | "SINGLE_CUT"
  | "MULTI_CUT"
  | "TWIST"
  | "SOLDER"
  | "HOUSING"
  | "TESTER"
  | "LABEL_PRINTER"
  | "INSPECTION"
  | "PACKING"
  | "OTHER";

/** 통신 방식 */
export type CommType = "MQTT" | "SERIAL" | "TCP" | "OPC_UA" | "MODBUS";

/** 사용 여부 */
export type UseYn = "Y" | "N";

// ========================================
// 메뉴/네비게이션 타입
// ========================================

export interface MenuItem {
  id: string;
  label: string;
  path: string;
  icon?: React.ComponentType<{ className?: string }>;
  children?: MenuItem[];
  badge?: number | string;
}
