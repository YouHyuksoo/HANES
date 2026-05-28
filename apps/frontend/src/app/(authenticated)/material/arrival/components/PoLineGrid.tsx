"use client";

/**
 * @file PoLineGrid.tsx
 * @description IQC005 PO 라인 단위 메인 그리드
 *
 * 초보자 가이드:
 * 1. 행 클릭 또는 [자재입하] 셀 클릭 → onSelectLine 콜백
 * 2. 4단계 행 배경: 미입하(흰) / 일부입하(yellow-50) / 잔량0(blue-50) / CLOSE(gray-100)
 * 3. 잔량 = text-blue-700 font-bold (RoyalBlue 근사)
 */

import { useMemo, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ColumnDef } from '@tanstack/react-table';
import DataGrid from '@/components/data-grid/DataGrid';
import ComCodeBadge from '@/components/ui/ComCodeBadge';
import type { PoLineRow } from './types';

interface PoLineGridProps {
  data: PoLineRow[];
  isLoading?: boolean;
  toolbarLeft?: ReactNode;
  onSelectLine: (row: PoLineRow) => void;
}

const rowClass = (row: PoLineRow) => {
  if (row.lineStatus === 'CLOSE') return 'bg-gray-100 text-gray-500';
  if (row.remainingQty === 0) return 'bg-blue-50/60';
  if (row.receivedQty > 0) return 'bg-yellow-50/60';
  return '';
};

export default function PoLineGrid({ data, isLoading, toolbarLeft, onSelectLine }: PoLineGridProps) {
  const { t } = useTranslation();

  const columns = useMemo<ColumnDef<PoLineRow>[]>(() => [
    {
      id: 'action',
      header: '',
      size: 110,
      meta: { filterType: 'none' as const },
      cell: ({ row }) => {
        const r = row.original;
        const disabled = r.lineStatus === 'CLOSE' || r.remainingQty === 0;
        return (
          <button
            type="button"
            disabled={disabled}
            onClick={(e) => { e.stopPropagation(); if (!disabled) onSelectLine(r); }}
            className={`px-3 py-1 rounded text-xs font-semibold text-white ${
              disabled ? 'bg-gray-300 cursor-not-allowed' : 'bg-pink-600 hover:bg-pink-700'
            }`}
          >
            {t('material.arrival.action.receive')}
          </button>
        );
      },
    },
    {
      accessorKey: 'poNo',
      header: t('material.arrival.col.poNo'),
      size: 130,
      meta: { filterType: 'text' as const },
      cell: ({ getValue }) => <span className="font-semibold text-slate-800">{getValue() as string}</span>,
    },
    { accessorKey: 'lineNo', header: 'L/N', size: 50, meta: { filterType: 'number' as const }, cell: ({ getValue }) => <div className="text-center">{getValue() as number}</div> },
    { accessorKey: 'revNo', header: 'R/N', size: 50, meta: { filterType: 'number' as const }, cell: ({ getValue }) => <div className="text-center">R{getValue() as number}</div> },
    {
      accessorKey: 'itemCode',
      header: t('common.partCode'),
      size: 110,
      meta: { filterType: 'text' as const },
      cell: ({ getValue }) => <span className="font-semibold text-slate-800">{getValue() as string}</span>,
    },
    { accessorKey: 'itemName', header: t('common.partName'), meta: { filterType: 'text' as const } },
    {
      accessorKey: 'orderQty',
      header: t('material.arrival.col.orderQty'),
      size: 90,
      meta: { filterType: 'number' as const },
      cell: ({ getValue }) => <div className="text-right">{(getValue() as number).toLocaleString()}</div>,
    },
    {
      accessorKey: 'receivedQty',
      header: t('material.arrival.col.accReceived'),
      size: 90,
      meta: { filterType: 'number' as const },
      cell: ({ getValue }) => <div className="text-right">{(getValue() as number).toLocaleString()}</div>,
    },
    {
      accessorKey: 'remainingQty',
      header: t('material.arrival.col.remainingQty'),
      size: 90,
      meta: { filterType: 'number' as const },
      cell: ({ getValue }) => <div className="text-right text-blue-700 font-bold">{(getValue() as number).toLocaleString()}</div>,
    },
    {
      accessorKey: 'orderDate',
      header: t('material.arrival.col.orderDate'),
      size: 110,
      meta: { filterType: 'date' as const },
      cell: ({ getValue }) => <div className="text-center">{(getValue() as string) ?? '-'}</div>,
    },
    { accessorKey: 'partnerName', header: t('material.arrival.col.vendor'), size: 130, meta: { filterType: 'text' as const } },
    {
      accessorKey: 'useType',
      header: t('material.arrival.col.useType'),
      size: 70,
      meta: { filterType: 'multi' as const },
      cell: ({ getValue }) => <ComCodeBadge groupCode="PO_USE_TYPE" code={getValue() as string} />,
    },
    {
      accessorKey: 'lineStatus',
      header: t('common.status'),
      size: 80,
      meta: { filterType: 'multi' as const },
      cell: ({ getValue }) => <ComCodeBadge groupCode="PO_LINE_STATUS" code={getValue() as string} />,
    },
  ], [t, onSelectLine]);

  return (
    <DataGrid
      data={data}
      columns={columns}
      isLoading={isLoading}
      enableColumnFilter
      enableExport
      exportFileName="iqc005_po_lines"
      toolbarLeft={toolbarLeft}
      rowClassName={rowClass}
      onRowClick={(row) => {
        if (row.lineStatus !== 'CLOSE' && row.remainingQty > 0) onSelectLine(row);
      }}
    
    sqlQuery={`SELECT *\nFROM PO_LINES\nWHERE COMPANY = '40'\n  AND PLANT_CD = '1000'\nORDER BY CREATED_AT DESC`}/>
  );
}
