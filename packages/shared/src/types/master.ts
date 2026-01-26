/**
 * @file packages/shared/src/types/master.ts
 * @description 기준정보 관련 타입 정의
 *
 * 초보자 가이드:
 * 1. **기준정보란**: 시스템에서 사용하는 기본 마스터 데이터
 * 2. **사용처**: 품목, 공정, BOM, 거래처 등 기본 정보 관리
 */

import { ItemType, BomType, Status } from './enums';

/** 공통코드 */
export interface ComCode {
  id: string;
  groupCode: string;
  groupName: string;
  code: string;
  codeName: string;
  codeNameEn?: string;
  codeNameVi?: string;
  sortOrder: number;
  isActive: boolean;
  description?: string;
  attr1?: string;
  attr2?: string;
  attr3?: string;
  createdAt: string;
  updatedAt: string;
}

/** 공장(Plant) */
export interface Plant {
  id: string;
  plantCode: string;
  plantName: string;
  address?: string;
  contact?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/** 라인(Line) */
export interface Line {
  id: string;
  plantId: string;
  lineCode: string;
  lineName: string;
  processType: string;
  capacity?: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/** 품목 마스터 */
export interface PartMaster {
  id: string;
  itemCode: string;
  itemName: string;
  itemNameEn?: string;
  itemNameVi?: string;
  itemType: ItemType;
  itemCategory?: string;
  itemSpec?: string;
  unit: string;
  unitPrice?: number;
  currency?: string;
  leadTime?: number;
  safetyStock?: number;
  minOrderQty?: number;
  supplierCode?: string;
  customerCode?: string;
  drawingNo?: string;
  revision?: string;
  isActive: boolean;
  isBonded?: boolean;        // 보세품목 여부
  hsCode?: string;           // HS Code
  createdAt: string;
  updatedAt: string;
}

/** BOM 마스터 (Header) */
export interface BomMaster {
  id: string;
  parentItemCode: string;
  bomType: BomType;
  revision: string;
  effectiveFrom: string;
  effectiveTo?: string;
  isActive: boolean;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

/** BOM 상세 (Detail) */
export interface BomDetail {
  id: string;
  bomMasterId: string;
  seq: number;
  childItemCode: string;
  childItemName: string;
  requiredQty: number;
  unit: string;
  lossRate?: number;
  processType?: string;
  isAlternative?: boolean;
  alternativeGroup?: string;
  description?: string;
}

/** 거래처 마스터 */
export interface Partner {
  id: string;
  partnerCode: string;
  partnerName: string;
  partnerType: 'CUSTOMER' | 'SUPPLIER' | 'BOTH';
  businessNo?: string;
  ceoName?: string;
  address?: string;
  tel?: string;
  fax?: string;
  email?: string;
  contactPerson?: string;
  isActive: boolean;
  paymentTerms?: string;
  currency?: string;
  createdAt: string;
  updatedAt: string;
}

/** 설비 마스터 */
export interface Equipment {
  id: string;
  plantId: string;
  lineId?: string;
  equipmentCode: string;
  equipmentName: string;
  equipmentType: string;
  manufacturer?: string;
  modelNo?: string;
  serialNo?: string;
  installDate?: string;
  warrantyDate?: string;
  status: Status;
  lastMaintenanceDate?: string;
  nextMaintenanceDate?: string;
  createdAt: string;
  updatedAt: string;
}

/** 금형/치공구 마스터 */
export interface ToolMaster {
  id: string;
  toolCode: string;
  toolName: string;
  toolType: 'MOLD' | 'JIG' | 'APPLICATOR' | 'BLADE' | 'OTHER';
  itemCode?: string;         // 연결된 품목
  maxUsageCount?: number;    // 최대 사용 횟수
  currentUsageCount?: number;
  status: Status;
  lastChangeDate?: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

/** 사용자 마스터 */
export interface User {
  id: string;
  employeeId: string;
  username: string;
  displayName: string;
  email?: string;
  department?: string;
  position?: string;
  role: string;
  plantId?: string;
  lineId?: string;
  isActive: boolean;
  lastLoginAt?: string;
  createdAt: string;
  updatedAt: string;
}

/** 공정 마스터 */
export interface ProcessMaster {
  id: string;
  processCode: string;
  processName: string;
  processType: string;
  processOrder: number;
  standardTime?: number;     // 표준 작업 시간(초)
  isActive: boolean;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

/** 불량코드 마스터 */
export interface DefectCode {
  id: string;
  defectCode: string;
  defectName: string;
  defectNameEn?: string;
  defectNameVi?: string;
  processType?: string;
  defectCategory?: string;
  isActive: boolean;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

/** 창고 마스터 */
export interface Warehouse {
  id: string;
  plantId: string;
  warehouseCode: string;
  warehouseName: string;
  warehouseType: string;
  isActive: boolean;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

/** 창고 위치(Location) */
export interface WarehouseLocation {
  id: string;
  warehouseId: string;
  locationCode: string;
  locationName: string;
  zone?: string;
  row?: string;
  column?: string;
  level?: string;
  isActive: boolean;
}
