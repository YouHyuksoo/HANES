/**
 * @file src/app/(authenticated)/master/warehouse/types.ts
 * @description 창고 관리 타입 정의 (창고 마스터 + 이동규칙)
 */

export interface WarehouseData {
  id: string;
  warehouseCode: string;
  warehouseName: string;
  warehouseType: string;
  plantCode?: string;
  lineCode?: string;
  processCode?: string;
  vendorId?: string;
  isDefault: boolean;
  useYn: string;
  createdAt: string;
}

export interface TransferRule {
  id: string;
  fromWarehouseCode: string;
  fromWarehouseName: string;
  toWarehouseCode: string;
  toWarehouseName: string;
  allowYn: string;
  remark?: string;
}

export const WAREHOUSE_TYPE_COLORS: Record<string, string> = {
  RAW: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  WIP: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
  FG: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  FLOOR: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
  DEFECT: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
  SCRAP: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300',
  SUBCON: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300',
};
