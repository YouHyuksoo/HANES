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
  getPaginationRowModel,
  getFilteredRowModel,
  flexRender,
  ColumnDef,
  SortingState,
  ColumnFiltersState,
  ColumnOrderState,
  ColumnSizingState,
  Header,
  Cell,
} from '@tanstack/react-table';
import { useState, useCallback, useEffect, useRef } from 'react';
import { flushSync } from 'react-dom';
import { ChevronUp, ChevronDown, ChevronsUpDown, GripVertical } from 'lucide-react';
import Button from '@/components/ui/Button';

// 컬럼 메타 타입 확장
declare module '@tanstack/react-table' {
  interface ColumnMeta<TData, TValue> {
    align?: 'left' | 'center' | 'right';
  }
}

export interface DataGridProps<T> {
  data: T[];
  columns: ColumnDef<T, unknown>[];
  pageSize?: number;
  showPagination?: boolean;
  isLoading?: boolean;
  emptyMessage?: string;
  onRowClick?: (row: T) => void;
  enableColumnResizing?: boolean;
  enableColumnReordering?: boolean;
  columnResizeMode?: 'onChange' | 'onEnd';
}

// 날짜 패턴 감지 (YYYY-MM-DD, YYYY/MM/DD, YYYY.MM.DD, DD-MM-YYYY 등)
const datePatterns = [
  /^\d{4}[-/.]\d{2}[-/.]\d{2}$/, // YYYY-MM-DD
  /^\d{4}[-/.]\d{2}[-/.]\d{2}\s+\d{2}:\d{2}(:\d{2})?$/, // YYYY-MM-DD HH:mm(:ss)
  /^\d{2}[-/.]\d{2}[-/.]\d{4}$/, // DD-MM-YYYY
  /^\d{4}년\s*\d{1,2}월\s*\d{1,2}일$/, // YYYY년 MM월 DD일
];

// 값 타입 감지하여 정렬 방향 결정
function detectAlignment(value: unknown): 'left' | 'center' | 'right' {
  if (value === null || value === undefined) return 'left';

  // 숫자 타입
  if (typeof value === 'number') return 'right';

  // 문자열인 경우
  if (typeof value === 'string') {
    const trimmed = value.trim();

    // 숫자 문자열 (쉼표 포함 숫자, 통화 기호 등)
    if (/^-?[\d,]+(\.\d+)?$/.test(trimmed) || /^-?\d+(\.\d+)?%$/.test(trimmed)) {
      return 'right';
    }

    // 날짜 패턴
    for (const pattern of datePatterns) {
      if (pattern.test(trimmed)) {
        return 'center';
      }
    }
  }

  // Date 객체
  if (value instanceof Date) return 'center';

  // 기본값: 좌측 정렬
  return 'left';
}

// 정렬 클래스 반환
function getAlignmentClass(align: 'left' | 'center' | 'right'): string {
  switch (align) {
    case 'right': return 'text-right';
    case 'center': return 'text-center';
    default: return 'text-left';
  }
}

function DataGrid<T>({
  data,
  columns,
  pageSize = 10,
  showPagination = true,
  isLoading = false,
  emptyMessage = '데이터가 없습니다.',
  onRowClick,
  enableColumnResizing = true,
  enableColumnReordering = true,
  columnResizeMode = 'onChange',
}: DataGridProps<T>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnOrder, setColumnOrder] = useState<ColumnOrderState>([]);
  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>({});

  // 드래그 앤 드롭 상태
  const [draggedColumn, setDraggedColumn] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      columnFilters,
      columnOrder,
      columnSizing,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnOrderChange: setColumnOrder,
    onColumnSizingChange: setColumnSizing,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    enableColumnResizing,
    columnResizeMode,
    initialState: {
      pagination: {
        pageSize,
      },
    },
  });

  // 컬럼 순서 초기화
  useEffect(() => {
    if (columnOrder.length === 0) {
      setColumnOrder(table.getAllLeafColumns().map((col) => col.id));
    }
  }, [columns]);

  // 셀 정렬 방향 결정
  const getCellAlignment = (cell: Cell<T, unknown>): 'left' | 'center' | 'right' => {
    // 1. 컬럼 메타에서 명시적 정렬 지정 확인
    const metaAlign = cell.column.columnDef.meta?.align;
    if (metaAlign) return metaAlign;

    // 2. 셀 값 기반 자동 감지
    return detectAlignment(cell.getValue());
  };

  // 헤더 정렬 방향 (첫 번째 데이터 행의 값 기준)
  const getHeaderAlignment = (header: Header<T, unknown>): 'left' | 'center' | 'right' => {
    // 1. 컬럼 메타에서 명시적 정렬 지정 확인
    const metaAlign = header.column.columnDef.meta?.align;
    if (metaAlign) return metaAlign;

    // 2. 첫 번째 데이터 행의 값으로 자동 감지
    const firstRow = table.getRowModel().rows[0];
    if (firstRow) {
      const cell = firstRow.getAllCells().find(c => c.column.id === header.column.id);
      if (cell) {
        return detectAlignment(cell.getValue());
      }
    }

    return 'left';
  };

  // 드래그 시작
  const handleDragStart = useCallback((e: React.DragEvent, columnId: string) => {
    if (!enableColumnReordering) return;
    setDraggedColumn(columnId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', columnId);
  }, [enableColumnReordering]);

  // 드래그 오버
  const handleDragOver = useCallback((e: React.DragEvent, columnId: string) => {
    if (!enableColumnReordering || !draggedColumn) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (columnId !== draggedColumn) {
      setDropTarget(columnId);
    }
  }, [enableColumnReordering, draggedColumn]);

  // 드래그 종료
  const handleDragEnd = useCallback(() => {
    setDraggedColumn(null);
    setDropTarget(null);
  }, []);

  // 드롭
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

  // 리사이즈 상태 변화 감지 → 전역 커서 스타일 적용
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

    flushSync(() => {
      setColumnSizing(currentSizing);
    });
  }, [table]);

  // 리사이즈 핸들러 컴포넌트
  const ResizeHandle = ({ header }: { header: Header<T, unknown> }) => {
    if (!enableColumnResizing) return null;
    const isResizing = header.column.getIsResizing();

    return (
      <div
        onMouseDown={(e) => {
          e.stopPropagation();
          e.preventDefault();
          syncColumnWidths(e);
          header.getResizeHandler()(e);
        }}
        onTouchStart={(e) => {
          e.stopPropagation();
          syncColumnWidths(e);
          header.getResizeHandler()(e);
        }}
        onDoubleClick={(e) => {
          e.stopPropagation();
          header.column.resetSize();
        }}
        className={`
          absolute right-0 top-0 h-full w-4 cursor-col-resize
          select-none touch-none z-10
          flex items-center justify-center
        `}
        style={{ userSelect: 'none', transform: 'translateX(50%)' }}
        title="더블클릭: 크기 초기화"
      >
        {/* 시각적 리사이즈 바 */}
        <div
          className={`
            h-full transition-all duration-100
            ${isResizing
              ? 'w-0.5 bg-primary'
              : 'w-px bg-transparent group-hover/resize:bg-border hover:!bg-primary/50'
            }
          `}
        />
      </div>
    );
  };

  return (
    <div className="w-full">
      {/* Table Container */}
      <div className="overflow-x-auto rounded-[var(--radius)] border border-border">
        <table
          className="font-data text-sm"
          style={{
            minWidth: '100%',
            width: 'max-content',
          }}
        >
          {/* Header */}
          <thead className="bg-background">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const isDragging = draggedColumn === header.id;
                  const isDropTarget = dropTarget === header.id;
                  const headerAlign = getHeaderAlignment(header);

                  return (
                    <th
                      key={header.id}
                      className={`
                        group/resize relative px-4 py-3 font-semibold text-text
                        border-b border-r border-border last:border-r-0
                        whitespace-nowrap
                        transition-all duration-150
                        ${getAlignmentClass(headerAlign)}
                        ${isDragging ? 'opacity-50 bg-primary/10' : ''}
                        ${isDropTarget ? 'bg-primary/20 border-l-2 border-l-primary' : ''}
                      `}
                      style={{
                        width: columnSizing[header.id] ? header.getSize() : 'auto',
                        minWidth: header.column.columnDef.minSize ?? 50,
                      }}
                      draggable={enableColumnReordering && !header.column.getIsResizing()}
                      onDragStart={(e) => handleDragStart(e, header.id)}
                      onDragOver={(e) => handleDragOver(e, header.id)}
                      onDragEnd={handleDragEnd}
                      onDrop={(e) => handleDrop(e, header.id)}
                      onDragLeave={() => setDropTarget(null)}
                    >
                      {header.isPlaceholder ? null : (
                        <div className={`flex items-center gap-1 ${headerAlign === 'right' ? 'justify-end' : headerAlign === 'center' ? 'justify-center' : 'justify-start'}`}>
                          {/* 드래그 핸들 */}
                          {enableColumnReordering && (
                            <GripVertical
                              className="w-4 h-4 text-text-muted cursor-grab active:cursor-grabbing opacity-50 hover:opacity-100 flex-shrink-0"
                            />
                          )}

                          {/* 헤더 내용 */}
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

                          {/* 리사이즈 핸들 */}
                          <ResizeHandle header={header} />
                        </div>
                      )}
                    </th>
                  );
                })}
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
                  {row.getVisibleCells().map((cell) => {
                    const cellAlign = getCellAlignment(cell);

                    return (
                      <td
                        key={cell.id}
                        className={`px-4 py-3 text-text whitespace-nowrap ${getAlignmentClass(cellAlign)}`}
                        style={{
                          width: columnSizing[cell.column.id] ? cell.column.getSize() : 'auto',
                          minWidth: cell.column.columnDef.minSize ?? 50,
                        }}
                      >
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )}
                      </td>
                    );
                  })}
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
