"use client";

/**
 * @file src/components/data-grid/DataGrid.tsx
 * @description TanStack Table v8 기반 데이터 그리드 컴포넌트
 *
 * 초보자 가이드:
 * 1. **TanStack Table**: 헤드리스 테이블 라이브러리 (UI 없이 로직만 제공)
 * 2. **columns**: 컬럼 정의 배열
 * 3. **data**: 테이블에 표시할 데이터 배열
 * 4. **컬럼 크기 조절**: 헤더 경계를 드래그하여 컬럼 너비 조절
 * 5. **컬럼 위치 조정**: 헤더를 드래그하여 컬럼 순서 변경
 * 6. **자동 정렬**: 숫자(우측), 날짜(중앙), 문자(좌측)
 */
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  flexRender,
  ColumnDef,
  SortingState,
  ColumnFiltersState,
  ColumnOrderState,
  ColumnSizingState,
  ColumnPinningState,
  PaginationState,
  Header,
  Cell,
} from '@tanstack/react-table';
import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { flushSync } from 'react-dom';
import { ChevronUp, ChevronDown, ChevronsUpDown, GripVertical, X, Pin, PinOff } from 'lucide-react';
import Button from '@/components/ui/Button';
import ExportDropdown from './ExportDropdown';
import { ResizeHandle } from './ResizeHandle';
import { ColumnFilterInput } from './ColumnFilterInput';
import { ScrollHandle } from './ScrollHandle';
import { PaginationControls } from './PaginationControls';
import { detectAlignment, getAlignmentClass, getPinnedStyle } from './utils';
import { numberRangeFilterFn } from './numberFilterFn';
import { dateRangeFilterFn } from './dateFilterFn';
import { textInFilterFn } from './textFilterFn';

// 컬럼 메타 타입 확장
declare module '@tanstack/react-table' {
  interface FilterFns {
    numberRange: typeof import('./numberFilterFn').numberRangeFilterFn;
    dateRange: typeof import('./dateFilterFn').dateRangeFilterFn;
    textIn: typeof import('./textFilterFn').textInFilterFn;
  }
  interface ColumnMeta<TData, TValue> {
    align?: 'left' | 'center' | 'right';
    /** 컬럼 필터 타입: text(기본), select(드롭다운), number(숫자 범위), none(필터 없음) */
    filterType?: 'text' | 'select' | 'multi' | 'number' | 'date' | 'none';
    /** select 필터용 옵션 목록 (미지정 시 데이터에서 자동 추출) */
    filterOptions?: { value: string; label: string }[];
    /** 필터 placeholder */
    filterPlaceholder?: string;
  }
}

export interface DataGridProps<T> {
  data: T[];
  columns: ColumnDef<T, unknown>[];
  /** 페이지 당 표시 행 수 (기본: 50) */
  pageSize?: number;
  isLoading?: boolean;
  emptyMessage?: string;
  onRowClick?: (row: T) => void;
  enableColumnResizing?: boolean;
  enableColumnReordering?: boolean;
  columnResizeMode?: 'onChange' | 'onEnd';
  /** 컬럼별 필터 표시 여부 (기본: true) */
  enableColumnFilter?: boolean;
  /** DataGrid 최대 높이 — 초과 시 스크롤 (예: "calc(100vh - 300px)") */
  maxHeight?: string;
  /** 행 배경색 조건부 렌더링 */
  rowClassName?: (row: T, index: number) => string;
  /** 데이터 내보내기 드롭다운 표시 여부 (기본: false) */
  enableExport?: boolean;
  /** 내보내기 파일명 (확장자 제외, 기본: "export") */
  exportFileName?: string;
  /** 내보내기 시 제외할 컬럼 ID 목록 (기본: ['actions', 'select']) */
  exportExcludeColumns?: string[];
  /** 상단 툴바 왼쪽에 표시할 커스텀 콘텐츠 (검색, 필터 셀렉트 등) */
  toolbarLeft?: React.ReactNode;
  /** 컬럼 고정(틀 고정) 활성화 (기본: false) */
  enableColumnPinning?: boolean;
  /** 초기 고정 컬럼 설정 (예: { left: ['col1', 'col2'] }) */
  defaultPinnedColumns?: { left?: string[]; right?: string[] };
  /** 선택된 행의 ID (하이라이트 표시) */
  selectedRowId?: string;
  /** 행에서 고유 ID를 추출하는 함수 */
  getRowId?: (row: T) => string;
}

function DataGrid<T>({
  data,
  columns,
  pageSize: initialPageSize = 50,
  isLoading = false,
  emptyMessage = '데이터가 없습니다.',
  onRowClick,
  enableColumnResizing = true,
  enableColumnReordering = true,
  columnResizeMode = 'onChange',
  enableColumnFilter = true,
  maxHeight,
  rowClassName,
  enableExport = false,
  exportFileName = "export",
  exportExcludeColumns,
  toolbarLeft,
  enableColumnPinning = false,
  defaultPinnedColumns,
  selectedRowId,
  getRowId,
}: DataGridProps<T>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnOrder, setColumnOrder] = useState<ColumnOrderState>([]);
  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>({});
  const [columnPinning, setColumnPinning] = useState<ColumnPinningState>(
    defaultPinnedColumns ?? {}
  );
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: initialPageSize,
  });

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [draggedColumn, setDraggedColumn] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [showFilterRow, setShowFilterRow] = useState(false);

  // 필터 변경 시 첫 페이지로 이동
  useEffect(() => {
    setPagination(prev => ({ ...prev, pageIndex: 0 }));
  }, [columnFilters]);

  // 커스텀 필터 컬럼 전처리: filterType에 따라 filterFn 자동 연결
  const processedColumns = useMemo(() =>
    columns.map((col) => {
      if ('filterFn' in col) return col;
      if (col.meta?.filterType === 'number') return { ...col, filterFn: 'numberRange' as const };
      if (col.meta?.filterType === 'date') return { ...col, filterFn: 'dateRange' as const };
      if (col.meta?.filterType === 'multi') return { ...col, filterFn: 'textIn' as const };
      return col;
    }),
  [columns]);

  const table = useReactTable({
    data,
    columns: processedColumns,
    filterFns: { numberRange: numberRangeFilterFn, dateRange: dateRangeFilterFn, textIn: textInFilterFn },
    state: { sorting, columnFilters, columnOrder, columnSizing, columnPinning, pagination },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnOrderChange: setColumnOrder,
    onColumnSizingChange: setColumnSizing,
    onColumnPinningChange: setColumnPinning,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    enableColumnResizing,
    columnResizeMode,
    enablePinning: enableColumnPinning,
  });

  const activeFilterCount = columnFilters.length;

  // 컬럼 순서 초기화
  useEffect(() => {
    if (columnOrder.length === 0) {
      setColumnOrder(table.getAllLeafColumns().map((col) => col.id));
    }
  }, [columns]);

  // 셀 정렬 방향 결정
  const getCellAlignment = (cell: Cell<T, unknown>): 'left' | 'center' | 'right' => {
    const metaAlign = cell.column.columnDef.meta?.align;
    if (metaAlign) return metaAlign;
    return detectAlignment(cell.getValue());
  };

  // 헤더 정렬 방향 (첫 번째 데이터 행의 값 기준)
  const getHeaderAlignment = (header: Header<T, unknown>): 'left' | 'center' | 'right' => {
    const metaAlign = header.column.columnDef.meta?.align;
    if (metaAlign) return metaAlign;
    const firstRow = table.getRowModel().rows[0];
    if (firstRow) {
      const cell = firstRow.getAllCells().find(c => c.column.id === header.column.id);
      if (cell) return detectAlignment(cell.getValue());
    }
    return 'left';
  };

  // 드래그 앤 드롭 핸들러
  const handleDragStart = useCallback((e: React.DragEvent, columnId: string) => {
    if (!enableColumnReordering) return;
    setDraggedColumn(columnId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', columnId);
  }, [enableColumnReordering]);

  const handleDragOver = useCallback((e: React.DragEvent, columnId: string) => {
    if (!enableColumnReordering || !draggedColumn) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (columnId !== draggedColumn) setDropTarget(columnId);
  }, [enableColumnReordering, draggedColumn]);

  const handleDragEnd = useCallback(() => {
    setDraggedColumn(null);
    setDropTarget(null);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, targetColumnId: string) => {
    if (!enableColumnReordering || !draggedColumn) return;
    e.preventDefault();
    const currentOrder = columnOrder.length > 0
      ? columnOrder
      : table.getAllLeafColumns().map((col) => col.id);
    const draggedIndex = currentOrder.indexOf(draggedColumn);
    const targetIndex = currentOrder.indexOf(targetColumnId);
    if (draggedIndex !== -1 && targetIndex !== -1 && draggedIndex !== targetIndex) {
      const newOrder = [...currentOrder];
      newOrder.splice(draggedIndex, 1);
      newOrder.splice(targetIndex, 0, draggedColumn);
      setColumnOrder(newOrder);
    }
    setDraggedColumn(null);
    setDropTarget(null);
  }, [enableColumnReordering, draggedColumn, columnOrder, table]);

  // 정렬 아이콘
  const SortIcon = ({ isSorted }: { isSorted: false | 'asc' | 'desc' }) => {
    if (isSorted === 'asc') return <ChevronUp className="w-4 h-4" />;
    if (isSorted === 'desc') return <ChevronDown className="w-4 h-4" />;
    return <ChevronsUpDown className="w-4 h-4 opacity-30" />;
  };

  // 리사이즈 중 전역 커서 유지를 위한 ref
  const isResizingRef = useRef(false);

  useEffect(() => {
    const isAnyResizing = table.getHeaderGroups().some((hg) =>
      hg.headers.some((h) => h.column.getIsResizing())
    );
    if (isAnyResizing && !isResizingRef.current) {
      isResizingRef.current = true;
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    } else if (!isAnyResizing && isResizingRef.current) {
      isResizingRef.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }
    return () => {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [table.getState().columnSizingInfo]);

  // 리사이즈 시작 전 모든 컬럼의 실제 DOM 너비를 동기화
  const syncColumnWidths = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    const tableEl = (e.currentTarget as HTMLElement).closest('table');
    if (!tableEl) return;
    const allHeaders = table.getHeaderGroups().flatMap((hg) => hg.headers);
    const ths = tableEl.querySelectorAll('thead th');
    if (ths.length !== allHeaders.length) return;
    const currentSizing: ColumnSizingState = {};
    allHeaders.forEach((h, i) => {
      currentSizing[h.id] = ths[i].getBoundingClientRect().width;
    });
    flushSync(() => { setColumnSizing(currentSizing); });
  }, [table]);

  return (
    <div className="w-full">
      {/* Toolbar */}
      {(toolbarLeft || enableExport || enableColumnFilter) && (
        <div className="flex items-center justify-between gap-3 mb-1.5">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            {toolbarLeft}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {enableExport && (
              <ExportDropdown
                data={activeFilterCount > 0
                  ? table.getPrePaginationRowModel().rows.map((r) => r.original)
                  : data}
                columns={columns}
                fileName={exportFileName}
                excludeColumns={exportExcludeColumns}
              />
            )}
            {enableColumnFilter && (
              <>
                {activeFilterCount > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setColumnFilters([])}
                    className="text-xs text-text-muted hover:text-error"
                  >
                    <X className="w-3 h-3 mr-1" />
                    필터 초기화
                  </Button>
                )}
                <Button
                  variant={showFilterRow ? 'primary' : 'outline'}
                  size="sm"
                  onClick={() => setShowFilterRow((v) => !v)}
                  className="text-xs"
                >
                  필터 {showFilterRow ? 'OFF' : 'ON'}
                </Button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Table Container (with scroll handles) */}
      <div className="relative group/scroll">
        <ScrollHandle direction="left" scrollContainerRef={scrollContainerRef} />
        <ScrollHandle direction="right" scrollContainerRef={scrollContainerRef} />

        <div
          ref={scrollContainerRef}
          className="relative overflow-auto rounded-[var(--radius)] border border-border"
          style={maxHeight ? { maxHeight } : undefined}
        >
          {/* 로딩 오버레이 */}
          {isLoading && (
            <div className="absolute inset-0 z-30 flex items-center justify-center bg-background/60 dark:bg-background/70 backdrop-blur-[1px]">
              <div className="flex flex-col items-center gap-3">
                <div className="relative w-10 h-10">
                  <div className="absolute inset-0 rounded-full border-2 border-primary/20" />
                  <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-primary animate-spin" />
                  <div className="absolute inset-1.5 rounded-full border-2 border-transparent border-b-primary/60 animate-spin [animation-direction:reverse] [animation-duration:0.8s]" />
                </div>
                <span className="text-xs text-text-muted font-medium tracking-wide">데이터 조회 중...</span>
              </div>
            </div>
          )}
        <table
          className="font-data text-xs"
          style={{ minWidth: '100%', width: 'max-content' }}
        >
          {/* Header */}
          <thead className="bg-background sticky top-0 z-10">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const isDragging = draggedColumn === header.id;
                  const isDropTarget = dropTarget === header.id;
                  const headerAlign = getHeaderAlignment(header);
                  const pinned = header.column.getIsPinned();
                  const isLastLeftPinned = pinned === 'left' && header.column.getIsLastColumn('left');
                  const isFirstRightPinned = pinned === 'right' && header.column.getIsFirstColumn('right');
                  const canDrag = enableColumnReordering && !header.column.getIsResizing() && !pinned;

                  return (
                    <th
                      key={header.id}
                      className={`
                        group/resize relative px-3 py-2 font-semibold text-text
                        border-b border-r border-border last:border-r-0
                        whitespace-nowrap
                        transition-all duration-150
                        ${getAlignmentClass(headerAlign)}
                        ${isDragging ? 'opacity-50 bg-primary/10' : ''}
                        ${isDropTarget ? 'bg-primary/20 border-l-2 border-l-primary' : ''}
                        ${pinned ? 'bg-slate-200 dark:bg-slate-800' : 'bg-slate-200 dark:bg-slate-800'}
                      `}
                      style={{
                        width: columnSizing[header.id] ? header.getSize() : 'auto',
                        minWidth: header.column.columnDef.minSize ?? 50,
                        ...getPinnedStyle(pinned, header.column.getStart('left'), header.column.getAfter('right'), isLastLeftPinned, isFirstRightPinned, 12),
                      }}
                      draggable={canDrag}
                      onDragStart={(e) => canDrag && handleDragStart(e, header.id)}
                      onDragOver={(e) => handleDragOver(e, header.id)}
                      onDragEnd={handleDragEnd}
                      onDrop={(e) => handleDrop(e, header.id)}
                      onDragLeave={() => setDropTarget(null)}
                    >
                      {header.isPlaceholder ? null : (
                        <div className={`flex items-center gap-1 ${headerAlign === 'right' ? 'justify-end' : headerAlign === 'center' ? 'justify-center' : 'justify-start'}`}>
                          {enableColumnReordering && !pinned && (
                            <GripVertical className="w-4 h-4 text-text-muted cursor-grab active:cursor-grabbing opacity-50 hover:opacity-100 flex-shrink-0" />
                          )}
                          {enableColumnPinning && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                header.column.pin(pinned ? false : 'left');
                              }}
                              className={`flex-shrink-0 p-0.5 rounded hover:bg-primary/10 transition-colors ${pinned ? 'text-primary' : 'text-text-muted opacity-0 group-hover/resize:opacity-50 hover:!opacity-100'}`}
                              title={pinned ? '고정 해제' : '컬럼 고정'}
                            >
                              {pinned ? <PinOff className="w-3.5 h-3.5" /> : <Pin className="w-3.5 h-3.5" />}
                            </button>
                          )}
                          <div
                            className={`flex items-center gap-2 ${header.column.getCanSort() ? 'cursor-pointer select-none hover:text-primary' : ''}`}
                            onClick={header.column.getToggleSortingHandler()}
                          >
                            {flexRender(header.column.columnDef.header, header.getContext())}
                            {header.column.getCanSort() && <SortIcon isSorted={header.column.getIsSorted()} />}
                          </div>
                          {enableColumnResizing && (
                            <ResizeHandle header={header} syncColumnWidths={syncColumnWidths} />
                          )}
                        </div>
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}

            {/* 컬럼 필터 행 */}
            {enableColumnFilter && showFilterRow && (
              <tr className="bg-surface/80">
                {table.getHeaderGroups()[0]?.headers.map((header) => {
                  const pinned = header.column.getIsPinned();
                  const isLastLeftPinned = pinned === 'left' && header.column.getIsLastColumn('left');
                  const isFirstRightPinned = pinned === 'right' && header.column.getIsFirstColumn('right');

                  return (
                    <th
                      key={`filter-${header.id}`}
                      className={`px-1 py-1 border-b border-r border-border last:border-r-0 ${pinned ? 'bg-surface dark:bg-surface' : ''}`}
                      style={getPinnedStyle(pinned, header.column.getStart('left'), header.column.getAfter('right'), isLastLeftPinned, isFirstRightPinned, 12)}
                    >
                      <ColumnFilterInput column={header.column} data={data} />
                    </th>
                  );
                })}
              </tr>
            )}
          </thead>

          {/* Body */}
          <tbody>
            {table.getRowModel().rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-3 py-16 text-center text-text-muted">
                  {isLoading ? '\u00A0' : emptyMessage}
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row, index) => {
                const isSelected = selectedRowId != null && getRowId
                  ? getRowId(row.original) === selectedRowId
                  : false;
                return (
                <tr
                  key={row.id}
                  onClick={() => onRowClick?.(row.original)}
                  className={`
                    border-b border-border last:border-b-0
                    transition-colors duration-150
                    ${isSelected
                      ? 'bg-primary/10 dark:bg-primary/20 ring-1 ring-inset ring-primary/30'
                      : index % 2 === 0 ? 'bg-surface' : 'bg-background/50'}
                    ${onRowClick ? 'cursor-pointer' : ''}
                    hover:bg-primary/5
                    ${rowClassName?.(row.original, index) ?? ''}
                  `}
                >
                  {row.getVisibleCells().map((cell) => {
                    const cellAlign = getCellAlignment(cell);
                    const pinned = cell.column.getIsPinned();
                    const isLastLeftPinned = pinned === 'left' && cell.column.getIsLastColumn('left');
                    const isFirstRightPinned = pinned === 'right' && cell.column.getIsFirstColumn('right');
                    const pinnedBg = pinned
                      ? (isSelected ? 'bg-primary/10 dark:bg-primary/20' : index % 2 === 0 ? 'bg-surface dark:bg-surface' : 'bg-background dark:bg-background')
                      : '';

                    return (
                      <td
                        key={cell.id}
                        className={`px-3 py-2 text-text whitespace-nowrap ${getAlignmentClass(cellAlign)} ${pinnedBg}`}
                        style={{
                          width: columnSizing[cell.column.id] ? cell.column.getSize() : 'auto',
                          minWidth: cell.column.columnDef.minSize ?? 50,
                          ...getPinnedStyle(pinned, cell.column.getStart('left'), cell.column.getAfter('right'), isLastLeftPinned, isFirstRightPinned, 11),
                        }}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    );
                  })}
                </tr>
                );
              })
            )}
          </tbody>
        </table>
        </div>
      </div>

      {/* Footer — 건수 + 페이지네이션 + 페이지 크기 */}
      <PaginationControls
        table={table}
        totalCount={data.length}
        filteredCount={table.getFilteredRowModel().rows.length}
        activeFilterCount={activeFilterCount}
        pagination={pagination}
        onPaginationChange={setPagination}
      />
    </div>
  );
}

export default DataGrid;
