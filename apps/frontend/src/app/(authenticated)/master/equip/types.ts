/**
 * @file src/app/(authenticated)/master/equip/types.ts
 * @description 설비 관리 페이지 타입 정의
 *
 * 초보자 가이드:
 * 1. **EquipMaster**: 설비 마스터 데이터
 * 2. **EquipBomItem**: BOM 품목 (부품/소모품)
 * 3. **EquipBomRel**: 설비-BOM 연결 정보
 */

import type { CommTypeValue, EquipStatusValue, EquipTypeValue } from "@harness/shared";

// ========================================
// 설비 마스터 타입
// ========================================

export type EquipType = EquipTypeValue;
export type CommType = Exclude<CommTypeValue, "OPC_UA" | "MODBUS"> | "NONE";
export type EquipStatus = EquipStatusValue;

export interface EquipMaster {
  equipCode: string;
  equipName: string;
  equipType: EquipType;
  modelName?: string;
  imageUrl?: string | null;
  maker?: string;
  lineCode?: string;
  lineName?: string;
  processCode?: string;
  processName?: string;
  ipAddress?: string;
  port?: number;
  commType: CommType;
  commConfig?: string;
  installDate?: string;
  status: EquipStatus;
  useYn: string;
  company?: string;
  plant?: string;
  createdAt?: string;
  updatedAt?: string;
}

// ========================================
// BOM 품목 타입
// ========================================

export type BomItemType = 'PART' | 'CONSUMABLE';

export interface EquipBomItem {
  bomItemCode: string;
  itemCode: string;
  itemName: string;
  itemType: BomItemType;
  spec?: string;
  maker?: string;
  unit: string;
  unitPrice?: number;
  replacementCycle?: number;
  stockQty: number;
  safetyStock: number;
  useYn: string;
  createdAt?: string;
  updatedAt?: string;
}

// ========================================
// 설비-BOM 연결 타입
// ========================================

export interface EquipBomRel {
  equipCode: string;
  bomItemCode: string;
  quantity: number;
  installDate?: string;
  expireDate?: string;
  remark?: string;
  useYn: string;
  createdAt?: string;
  updatedAt?: string;
  // Joined data
  bomItem?: EquipBomItem;
  equipment?: EquipMaster;
}

// ========================================
// 색상/라벨 정의
// ========================================

export const BOM_ITEM_TYPE_COLORS: Record<BomItemType, string> = {
  PART: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  CONSUMABLE: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300',
};

export const COMM_TYPE_COLORS: Record<CommType, string> = {
  MQTT: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300',
  SERIAL: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  TCP: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  NONE: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
};

export const COMM_TYPE_LABELS: Record<CommType, string> = {
  MQTT: 'MQTT',
  SERIAL: 'Serial',
  TCP: 'TCP/IP',
  NONE: 'None',
};

export const EQUIP_STATUS_COLORS: Record<EquipStatus, string> = {
  NORMAL: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  MAINT: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300',
  STOP: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
};

export const EQUIP_STATUS_LABELS: Record<EquipStatus, string> = {
  NORMAL: '정상',
  MAINT: '정비중',
  STOP: '가동중지',
};

