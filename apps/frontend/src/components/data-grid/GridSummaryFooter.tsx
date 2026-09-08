"use client";

import type { Table } from '@tanstack/react-table';
import { useTranslation } from 'react-i18next';
import { sumGridValues } from './gridSummary';
import { getPinnedStyle } from './utils';

/** 그리드와 같은 컬럼 순서/너비를 쓰는 합계 행. 페이지 이동은 합계에 영향을 주지 않는다. */
export function GridSummaryFooter<T>({ table, isLoading }: { table: Table<T>; isLoading: boolean }) {
  const { t } = useTranslation();
  const columns = [...table.getLeftVisibleLeafColumns(), ...table.getCenterVisibleLeafColumns(), ...table.getRightVisibleLeafColumns()];
  if (!columns.some(column => column.columnDef.meta?.summary === 'sum')) return null;
  const rows = table.getFilteredRowModel().rows;
  const labelColumn = columns.find(column => column.columnDef.meta?.summary !== 'sum' && column.id !== 'select');

  return (
    <tfoot className="sticky bottom-0 z-10 bg-surface font-semibold text-text" aria-label={t('common.total', '합계')} title={`조회된 ${rows.length.toLocaleString()}건 합계 (페이지 전체)`}>
      <tr className="border-t-2 border-border">
        {columns.map(column => {
          const isSum = column.columnDef.meta?.summary === 'sum';
          const pinned = column.getIsPinned();
          return (
            <td key={column.id} className={`px-3 py-2 whitespace-nowrap bg-surface border-r border-border last:border-r-0 ${isSum ? 'text-right tabular-nums' : 'text-left'}`}
              style={{ width: column.getSize(), minWidth: column.columnDef.minSize ?? 50,
                ...getPinnedStyle(pinned, column.getStart('left'), column.getAfter('right'), pinned === 'left' && column.getIsLastColumn('left'), pinned === 'right' && column.getIsFirstColumn('right'), 11) }}>
              {isSum ? (isLoading ? '—' : sumGridValues(rows.map(row => row.getValue(column.id))).toLocaleString(undefined, { maximumFractionDigits: 10 }))
                : column.id === labelColumn?.id ? t('common.total', '합계') : null}
            </td>
          );
        })}
      </tr>
    </tfoot>
  );
}
