"use client";

/**
 * @file src/app/(authenticated)/material/receive/components/ReceivableTable.tsx
 * @description 입고 가능 LOT 테이블 - 체크박스 선택 + 수량/창고 입력
 *
 * 초보자 가이드:
 * 1. **체크박스**: 여러 LOT 동시 선택하여 일괄 입고
 * 2. **수량 입력**: 잔량 범위 내 분할 입고 가능
 * 3. **창고 선택**: useWarehouseOptions 훅으로 자동 로드
 */

import { useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { ColumnDef } from '@tanstack/react-table';
import { Input, Select } from '@/components/ui';
import DataGrid from '@/components/data-grid/DataGrid';
import { useWarehouseOptions } from '@/hooks/useMasterOptions';
import type { ReceivableLot, ReceiveInput } from './types';

interface ReceivableTableProps {
  data: ReceivableLot[];
  inputs: Record<string, ReceiveInput>;
  onInputChange: (lotId: string, field: keyof ReceiveInput, value: string | number | boolean) => void;
  onSelectAll: (checked: boolean) => void;
  allSelected: boolean;
}

export default function ReceivableTable({ data, inputs, onInputChange, onSelectAll, allSelected }: ReceivableTableProps) {
  const { t } = useTranslation();
  const { options: warehouses } = useWarehouseOptions();

  const handleQtyChange = useCallback((lotId: string, value: string, max: number) => {
    const num = Math.min(Math.max(0, Number(value) || 0), max);
    onInputChange(lotId, 'qty', num);
  }, [onInputChange]);

  const columns = useMemo<ColumnDef<ReceivableLot>[]>(() => [
    {
      id: 'select',
      header: () => (
        <input
          type="checkbox"
          checked={allSelected}
          onChange={(e) => onSelectAll(e.target.checked)}
          className="w-4 h-4 rounded border-border"
        />
      ),
      size: 40,
      meta: { filterType: "none" as const },
      cell: ({ row }) => (
        <input
          type="checkbox"
          checked={inputs[row.original.id]?.selected || false}
          onChange={(e) => onInputChange(row.original.id, 'selected', e.target.checked)}
          className="w-4 h-4 rounded border-border"
        />
      ),
    },
    { id: 'lotNo', header: t('material.col.lotNo'), size: 150, meta: { filterType: "text" as const }, cell: ({ row }) => row.original.lotNo },
    { id: 'poNo', header: t('material.arrival.col.poNo'), size: 120, meta: { filterType: "text" as const }, cell: ({ row }) => row.original.poNo || '-' },
    { id: 'partCode', header: t('common.partCode'), size: 100, meta: { filterType: "text" as const }, cell: ({ row }) => row.original.part.partCode },
    { id: 'partName', header: t('common.partName'), size: 130, meta: { filterType: "text" as const }, cell: ({ row }) => row.original.part.partName },
    { id: 'vendor', header: t('material.arrival.col.vendor'), size: 100, meta: { filterType: "text" as const }, cell: ({ row }) => row.original.vendor || '-' },
    {
      id: 'initQty',
      header: t('material.receive.col.initQty'),
      size: 80,
      meta: { filterType: "number" as const },
      cell: ({ row }) => <span>{row.original.initQty.toLocaleString()}</span>,
    },
    {
      id: 'receivedQty',
      header: t('material.receive.col.receivedQty'),
      size: 80,
      meta: { filterType: "number" as const },
      cell: ({ row }) => (
        <span className="text-blue-600">{row.original.receivedQty.toLocaleString()}</span>
      ),
    },
    {
      id: 'remainingQty',
      header: t('material.receive.col.remainingQty'),
      size: 80,
      meta: { filterType: "number" as const },
      cell: ({ row }) => (
        <span className="text-orange-600 font-medium">{row.original.remainingQty.toLocaleString()}</span>
      ),
    },
    {
      id: 'manufactureDate',
      header: t('material.arrival.col.manufactureDate'),
      size: 140,
      meta: { filterType: "none" as const },
      cell: ({ row }) => (
        <Input
          type="date"
          value={inputs[row.original.id]?.manufactureDate || ''}
          onChange={(e) => onInputChange(row.original.id, 'manufactureDate', e.target.value)}
          className="w-[130px]"
        />
      ),
    },
    {
      id: 'inputQty',
      header: t('material.receive.col.inputQty'),
      size: 100,
      meta: { filterType: "none" as const },
      cell: ({ row }) => (
        <Input
          type="number"
          min={0}
          max={row.original.remainingQty}
          value={inputs[row.original.id]?.qty || 0}
          onChange={(e) => handleQtyChange(row.original.id, e.target.value, row.original.remainingQty)}
          className="w-20"
        />
      ),
    },
    {
      id: 'warehouse',
      header: t('material.arrival.col.warehouse'),
      size: 140,
      meta: { filterType: "none" as const },
      cell: ({ row }) => (
        <Select
          options={warehouses}
          value={inputs[row.original.id]?.warehouseId || ''}
          onChange={(v) => onInputChange(row.original.id, 'warehouseId', v)}
          placeholder={t('material.arrival.selectWarehouse')}
        />
      ),
    },
  ], [t, inputs, warehouses, onInputChange, onSelectAll, allSelected, handleQtyChange]);

  return <DataGrid data={data} columns={columns} pageSize={20} enableColumnFilter />;
}
