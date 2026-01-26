/**
 * @file src/components/data-grid/DataGrid.tsx
 * @description TanStack Table v8 기반 데이터 그리드 컴포넌트
 *
 * 초보자 가이드:
 * 1. **TanStack Table**: 헤드리스 테이블 라이브러리 (UI 없이 로직만 제공)
 * 2. **columns**: 컬럼 정의 배열
 * 3. **data**: 테이블에 표시할 데이터 배열
 * 4. **Zebra Striping**: 홀수/짝수 행 배경색 구분
 */
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  getFilteredRowModel,
  flexRender,
  ColumnDef,
  SortingState,
  ColumnFiltersState,
} from '@tanstack/react-table';
import { useState } from 'react';
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';
import Button from '@/components/ui/Button';

export interface DataGridProps<T> {
  data: T[];
  columns: ColumnDef<T, unknown>[];
  pageSize?: number;
  showPagination?: boolean;
  isLoading?: boolean;
  emptyMessage?: string;
  onRowClick?: (row: T) => void;
}

function DataGrid<T>({
  data,
  columns,
  pageSize = 10,
  showPagination = true,
  isLoading = false,
  emptyMessage = '데이터가 없습니다.',
  onRowClick,
}: DataGridProps<T>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      columnFilters,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    initialState: {
      pagination: {
        pageSize,
      },
    },
  });

  // 정렬 아이콘
  const SortIcon = ({ isSorted }: { isSorted: false | 'asc' | 'desc' }) => {
    if (isSorted === 'asc') return <ChevronUp className="w-4 h-4" />;
    if (isSorted === 'desc') return <ChevronDown className="w-4 h-4" />;
    return <ChevronsUpDown className="w-4 h-4 opacity-30" />;
  };

  return (
    <div className="w-full">
      {/* Table Container */}
      <div className="overflow-x-auto rounded-[var(--radius)] border border-border">
        <table className="w-full font-data text-sm">
          {/* Header */}
          <thead className="bg-background">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className="
                      px-4 py-3 text-left font-semibold text-text
                      border-b border-border
                      whitespace-nowrap
                    "
                  >
                    {header.isPlaceholder ? null : (
                      <div
                        className={`
                          flex items-center gap-2
                          ${
                            header.column.getCanSort()
                              ? 'cursor-pointer select-none hover:text-primary'
                              : ''
                          }
                        `}
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        {flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                        {header.column.getCanSort() && (
                          <SortIcon
                            isSorted={header.column.getIsSorted()}
                          />
                        )}
                      </div>
                    )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>

          {/* Body */}
          <tbody>
            {isLoading ? (
              // 로딩 상태
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-4 py-12 text-center text-text-muted"
                >
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    로딩 중...
                  </div>
                </td>
              </tr>
            ) : table.getRowModel().rows.length === 0 ? (
              // 빈 데이터
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-4 py-12 text-center text-text-muted"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              // 데이터 행
              table.getRowModel().rows.map((row, index) => (
                <tr
                  key={row.id}
                  onClick={() => onRowClick?.(row.original)}
                  className={`
                    border-b border-border last:border-b-0
                    transition-colors duration-150
                    ${index % 2 === 0 ? 'bg-surface' : 'bg-background/50'}
                    ${onRowClick ? 'cursor-pointer' : ''}
                    hover:bg-primary/5
                  `}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td
                      key={cell.id}
                      className="px-4 py-3 text-text whitespace-nowrap"
                    >
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {showPagination && data.length > 0 && (
        <div className="flex items-center justify-between mt-4">
          <div className="text-sm text-text-muted">
            전체 {table.getFilteredRowModel().rows.length}건 중{' '}
            {table.getState().pagination.pageIndex * pageSize + 1} -{' '}
            {Math.min(
              (table.getState().pagination.pageIndex + 1) * pageSize,
              table.getFilteredRowModel().rows.length
            )}
            건 표시
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              이전
            </Button>
            <span className="text-sm text-text px-2">
              {table.getState().pagination.pageIndex + 1} /{' '}
              {table.getPageCount()}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              다음
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default DataGrid;
