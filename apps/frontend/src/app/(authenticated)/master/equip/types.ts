/**
 * @file src/app/(authenticated)/master/equip/types.ts
 * @description 설비 관리 페이지 타입 정의
 *
 * 초보자 가이드:
 * 1. **EquipMaster**: 설비 마스터 데이터
 * 2. **EquipBomItem**: BOM 품목 (부품/소모품)
 * 3. **EquipBomRel**: 설비-BOM 연결 정보
 */

// ========================================
// 설비 마스터 타입
// ========================================

export type EquipType = 'AUTO_CRIMP' | 'SINGLE_CUT' | 'MULTI_CUT' | 'TWIST' | 'SOLDER' | 'HOUSING' | 'TESTER' | 'LABEL_PRINTER' | 'INSPECTION' | 'PACKING' | 'OTHER';
export type CommType = 'MQTT' | 'SERIAL' | 'TCP' | 'NONE';
export type EquipStatus = 'NORMAL' | 'MAINT' | 'STOP';

export interface EquipMaster {
  id: string;
  equipCode: string;
  equipName: string;
  equipType: EquipType;
  modelName?: string;
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
  id: string;
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
  id: string;
  equipId: string;
  bomItemId: string;
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

export const BOM_ITEM_TYPE_LABELS: Record<BomItemType, string> = {
  PART: '부품',
  CONSUMABLE: '소모품',
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

// ========================================
// 설비 마스터 시드 데이터 — 하네스 제조공장 실제 설비
// DB에서 조회하므로 프론트에서는 참조용으로만 사용
// ========================================

export const seedEquipments: EquipMaster[] = [];

// ========================================
// BOM 품목 시드 데이터
// ========================================

export const seedEquipBomItems: EquipBomItem[] = [
  { id: '1', itemCode: 'PART-001', itemName: '커팅 블레이드', itemType: 'PART', spec: '100x50x2mm', maker: '日本特殊鋼', unit: 'EA', unitPrice: 150000, replacementCycle: 90, stockQty: 5, safetyStock: 2, useYn: 'Y' },
  { id: '2', itemCode: 'PART-002', itemName: '압착 다이스', itemType: 'PART', spec: 'AWG 20-22', maker: 'TE Connectivity', unit: 'SET', unitPrice: 250000, replacementCycle: 180, stockQty: 3, safetyStock: 1, useYn: 'Y' },
  { id: '3', itemCode: 'PART-003', itemName: '서보 모터', itemType: 'PART', spec: '750W AC', maker: 'Mitsubishi', unit: 'EA', unitPrice: 850000, replacementCycle: 365, stockQty: 2, safetyStock: 1, useYn: 'Y' },
  { id: '4', itemCode: 'PART-004', itemName: 'PLC 모듈', itemType: 'PART', spec: 'FX5U-32MT', maker: 'Mitsubishi', unit: 'EA', unitPrice: 1200000, replacementCycle: 730, stockQty: 1, safetyStock: 1, useYn: 'Y' },
  { id: '5', itemCode: 'CONS-001', itemName: '그리스', itemType: 'CONSUMABLE', spec: 'NLGI #2', maker: 'SKF', unit: 'CAN', unitPrice: 35000, replacementCycle: 30, stockQty: 12, safetyStock: 5, useYn: 'Y' },
  { id: '6', itemCode: 'CONS-002', itemName: '클리닝 와이프', itemType: 'CONSUMABLE', spec: '300x300mm 무지', maker: '3M', unit: 'BOX', unitPrice: 25000, replacementCycle: 14, stockQty: 20, safetyStock: 10, useYn: 'Y' },
  { id: '7', itemCode: 'CONS-003', itemName: '절단유', itemType: 'CONSUMABLE', spec: 'ISO VG 68', maker: 'Shell', unit: 'L', unitPrice: 15000, replacementCycle: 90, stockQty: 50, safetyStock: 20, useYn: 'Y' },
  { id: '8', itemCode: 'CONS-004', itemName: '에어 필터', itemType: 'CONSUMABLE', spec: '5μm', maker: 'SMC', unit: 'EA', unitPrice: 8500, replacementCycle: 60, stockQty: 15, safetyStock: 5, useYn: 'Y' },
];

export const seedEquipBomRels: EquipBomRel[] = [
  { id: '1', equipId: '1', bomItemId: '1', quantity: 2, installDate: '2024-01-15', remark: '메인 블레이드', useYn: 'Y', bomItem: seedEquipBomItems[0] },
  { id: '2', equipId: '1', bomItemId: '5', quantity: 1, installDate: '2024-01-15', remark: '주간 점검용', useYn: 'Y', bomItem: seedEquipBomItems[4] },
  { id: '3', equipId: '2', bomItemId: '1', quantity: 2, installDate: '2024-02-01', remark: '메인 블레이드', useYn: 'Y', bomItem: seedEquipBomItems[0] },
  { id: '4', equipId: '3', bomItemId: '2', quantity: 1, installDate: '2024-01-20', remark: '압착 다이스 세트', useYn: 'Y', bomItem: seedEquipBomItems[1] },
  { id: '5', equipId: '3', bomItemId: '6', quantity: 2, installDate: '2024-01-20', useYn: 'Y', bomItem: seedEquipBomItems[5] },
  { id: '6', equipId: '4', bomItemId: '4', quantity: 1, installDate: '2024-01-10', remark: '제어 모듈', useYn: 'Y', bomItem: seedEquipBomItems[3] },
  { id: '7', equipId: '5', bomItemId: '4', quantity: 1, installDate: '2024-01-10', remark: '제어 모듈', useYn: 'Y', bomItem: seedEquipBomItems[3] },
];
