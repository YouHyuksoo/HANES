/**
 * @file src/pages/equipment/types.ts
 * @description 설비관리 페이지 공통 타입 정의
 */

/** 설비 상태 타입 */
export type EquipStatus = 'NORMAL' | 'MAINT' | 'STOP';

/** 설비 유형 타입 */
export type EquipType = 'CUTTING' | 'CRIMPING' | 'ASSEMBLY' | 'INSPECTION';

/** 소모품 상태 타입 */
export type PartStatus = 'OK' | 'WARNING' | 'REPLACE';

/** 소모품 카테고리 타입 */
export type PartCategory = 'MOLD' | 'JIG' | 'TOOL';

/** 설비 인터페이스 */
export interface Equipment {
  id: string;
  equipCode: string;
  equipName: string;
  equipType: EquipType;
  lineName: string;
  status: EquipStatus;
  ipAddress: string;
  remark?: string;
}

/** 소모품 인터페이스 */
export interface ConsumablePart {
  id: string;
  partCode: string;
  partName: string;
  category: PartCategory;
  currentShots: number;
  expectedLife: number;
  status: PartStatus;
  lastReplacedAt: string;
  equipmentCode?: string;
  remark?: string;
}

/** 설비 유형 라벨 */
export const equipTypeLabels: Record<EquipType, string> = {
  CUTTING: '절단',
  CRIMPING: '압착',
  ASSEMBLY: '조립',
  INSPECTION: '검사',
};

/** 소모품 카테고리 라벨 */
export const categoryLabels: Record<PartCategory, string> = {
  MOLD: '금형',
  JIG: '지그',
  TOOL: '공구',
};
