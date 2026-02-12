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
  error?: string;
}

export interface PaginationParams {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
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
  | "planned"
  | "released"
  | "in_progress"
  | "completed"
  | "canceled";

export interface ProductionResult {
  id: string;
  jobOrderId: string;
  equipId: string;
  workerId: string;
  goodQty: number;
  defectQty: number;
  startTime: string;
  endTime?: string;
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
  receiveDate: string;
  expiryDate?: string;
  warehouseCode: string;
  status: MaterialStatus;
}

export type MaterialStatus =
  | "received"
  | "iqc_pending"
  | "iqc_pass"
  | "iqc_fail"
  | "in_use"
  | "depleted";

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
  | "detected"
  | "analyzing"
  | "repair_pending"
  | "repaired"
  | "scrapped";

// ========================================
// 설비 관련 타입
// ========================================

export interface Equipment {
  id: string;
  equipCode: string;
  equipName: string;
  equipType: string;
  lineCode: string;
  status: EquipmentStatus;
  ipAddress?: string;
  commType?: "mqtt" | "serial" | "manual";
}

export type EquipmentStatus =
  | "running"
  | "idle"
  | "maintenance"
  | "breakdown"
  | "offline";

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
