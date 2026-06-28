"use client";

import type { TFunction } from "i18next";
import { ColumnDef, CellContext } from "@tanstack/react-table";
import {
  createPartColumns,
  createWarehouseColumns,
  createQtyColumn,
  createDateColumn,
} from "@/lib/table-utils";

export interface StockData {
  id: string;
  warehouseCode: string;
  itemCode: string;
  qty: number;
  reservedQty: number;
  availableQty: number;
  lastTransAt: string;
  warehouse: {
    warehouseCode: string;
    warehouseName: string;
    warehouseType: string;
  };
  part: {
    itemCode: string;
    itemName: string;
    itemType: string;
    unit: string;
  };
}

const getTypeColor = (type: string) => {
  const colors: Record<string, string> = {
    WIP: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
    FG: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
    FLOOR: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
    DEFECT: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
    SCRAP: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
  };
  return colors[type] || 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
};

interface CreateStockGridColumnsOptions {
  t: TFunction;
}

export function createStockGridColumns({
  t,
}: CreateStockGridColumnsOptions): ColumnDef<StockData>[] {
  return [
    // 창고 유형 배지
    {
      accessorKey: 'warehouseType',
      header: t('inventory.stock.warehouseType'),
      size: 100,
      meta: { filterType: 'multi' as const },
      cell: ({ getValue }: CellContext<StockData, unknown>) => {
        const type = getValue() as string;
        return (
          <span className={`px-2 py-1 rounded text-xs font-medium ${getTypeColor(type)}`}>
            {type}
          </span>
        );
      },
    },
    // 창고 코드, 명 (공통 유틸리티)
    ...createWarehouseColumns<StockData>(t),
    // 품목 코드, 명 (공통 유틸리티)
    ...createPartColumns<StockData>(t),
    // 현재고
    createQtyColumn<StockData>(t, 'qty'),
    // 예약수량
    {
      ...createQtyColumn<StockData>(t, 'reservedQty'),
      header: t('inventory.stock.reserved'),
      size: 80,
    },
    // 가용수량 (커스텀 색상)
    {
      accessorKey: 'availableQty',
      header: t('inventory.stock.available'),
      size: 100,
      cell: ({ getValue }: CellContext<StockData, unknown>) => {
        const value = getValue() as number;
        return (
          <span className={value <= 0 ? 'text-red-500 font-semibold' : 'text-green-600 font-semibold'}>
            {value.toLocaleString()}
          </span>
        );
      },
      meta: { filterType: 'number' as const, align: 'right' },
    },
    // 단위
    {
      accessorKey: 'unit',
      header: t('inventory.stock.unit'),
      size: 60,
      meta: { filterType: 'text' as const },
    },
    // 마지막 거래일 (공통 유틸리티)
    createDateColumn<StockData>(t, 'lastTransAt', t('inventory.stock.lastTransaction'), { size: 150 }),
  ];
}
