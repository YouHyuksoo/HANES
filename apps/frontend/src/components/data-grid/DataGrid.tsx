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
  Column,
} from '@tanstack/react-table';
import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { flushSync } from 'react-dom';
import { ChevronUp, ChevronDown, ChevronsUpDown, ChevronLeft, ChevronRight, GripVertical, X, Pin, PinOff } from 'lucide-react';
import Button from '@/components/ui/Button';
import ExportDropdown from './ExportDropdown';

// 컬럼 메타 타입 확장
declare module '@tanstack/react-table' {
  interface ColumnMeta<TData, TValue> {
    align?: 'left' | 'center' | 'right';
    /** 컬럼 필터 타입: text(기본), select(드롭다운), none(필터 없음) */
    filterType?: 'text' | 'select' | 'none';
    /** select 필터용 옵션 목록 (미지정 시 데이터에서 자동 추출) */
    filterOptions?: { value: string; label: string }[];
    /** 필터 placeholder */
    filterPlaceholder?: string;
  }
}

/** 페이지 크기 옵션 */
const PAGE_SIZE_OPTIONS = [20, 50, 100, 200, 500];

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

  // 스크롤 컨테이너 ref
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // 드래그 앤 드롭 상태
  const [draggedColumn, setDraggedColumn] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);

  // 필터 행 표시 여부
  const [showFilterRow, setShowFilterRow] = useState(false);

  // 필터 변경 시 첫 페이지로 이동
  useEffect(() => {
    setPagination(prev => ({ ...prev, pageIndex: 0 }));
  }, [columnFilters]);

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      columnFilters,
      columnOrder,
      columnSizing,
      columnPinning,
      pagination,
    },
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

  // 활성 필터 수
  const activeFilterCount = columnFilters.length;

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

  // 컬럼 필터 입력 컴포넌트
  const ColumnFilter = ({ column, data: allData }: { column: Column<T, unknown>; data: T[] }) => {
    const meta = column.columnDef.meta;
    const filterType = meta?.filterType ?? 'text';

    if (filterType === 'none' || column.id === 'actions' || column.id === 'select') return null;

    const filterValue = (column.getFilterValue() as string) ?? '';

    if (filterType === 'select') {
      const options = meta?.filterOptions ?? (() => {
        const vals = new Set<string>();
        allData.forEach((row) => {
          const v = (row as Record<string, unknown>)[column.id];
          if (v != null && v !== '') vals.add(String(v));
        });
        return Array.from(vals).sort().map((v) => ({ value: v, label: v }));
      })();

      return (
        <select
          value={filterValue}
          onChange={(e) => column.setFilterValue(e.target.value || undefined)}
          className="w-full h-7 px-1 text-xs bg-surface border border-border rounded text-text focus:outline-none focus:ring-1 focus:ring-primary"
        >
          <option value="">{meta?.filterPlaceholder ?? '전체'}</option>
          {(Array.isArray(options) ? options : []).map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      );
    }

    return (
      <input
        type="text"
        value={filterValue}
        onChange={(e) => column.setFilterValue(e.target.value || undefined)}
        placeholder={meta?.filterPlaceholder ?? '검색...'}
        className="w-full h-7 px-2 text-xs bg-surface border border-border rounded text-text placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-primary"
      />
    );
  };

  return (
    <div className="w-full">
      {/* Toolbar — 좌: 커스텀 콘텐츠 / 우: 내보내기 + 필터 */}
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
        {/* 좌측 스크롤 핸들 */}
        <div
          className="absolute left-0 top-0 bottom-0 w-4 z-20 cursor-pointer opacity-0 group-hover/scroll:opacity-100 transition-opacity duration-200"
          onMouseEnter={(e) => {
            const container = scrollContainerRef.current;
            if (!container || container.scrollLeft <= 0) return;
            const id = setInterval(() => {
              if (!container || container.scrollLeft <= 0) { clearInterval(id); return; }
              container.scrollLeft -= 8;
            }, 16);
            (e.currentTarget as HTMLElement).dataset.scrollId = String(id);
          }}
          onMouseLeave={(e) => {
            const id = (e.currentTarget as HTMLElement).dataset.scrollId;
            if (id) clearInterval(Number(id));
          }}
        >
          <div className="h-full w-full flex items-center justify-center bg-gradient-to-r from-black/15 dark:from-white/15 to-transparent rounded-l-[var(--radius)]">
            <ChevronLeft className="w-3.5 h-3.5 text-text-muted" />
          </div>
        </div>

        {/* 우측 스크롤 핸들 */}
        <div
          className="absolute right-0 top-0 bottom-0 w-4 z-20 cursor-pointer opacity-0 group-hover/scroll:opacity-100 transition-opacity duration-200"
          onMouseEnter={(e) => {
            const container = scrollContainerRef.current;
            if (!container) return;
            const maxScroll = container.scrollWidth - container.clientWidth;
            if (container.scrollLeft >= maxScroll) return;
            const id = setInterval(() => {
              if (!container) return;
              const max = container.scrollWidth - container.clientWidth;
              if (container.scrollLeft >= max) { clearInterval(id); return; }
              container.scrollLeft += 8;
            }, 16);
            (e.currentTarget as HTMLElement).dataset.scrollId = String(id);
          }}
          onMouseLeave={(e) => {
            const id = (e.currentTarget as HTMLElement).dataset.scrollId;
            if (id) clearInterval(Number(id));
          }}
        >
          <div className="h-full w-full flex items-center justify-center bg-gradient-to-l from-black/15 dark:from-white/15 to-transparent rounded-r-[var(--radius)]">
            <ChevronRight className="w-3.5 h-3.5 text-text-muted" />
          </div>
        </div>

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
          style={{
            minWidth: '100%',
            width: 'max-content',
          }}
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
                        group/resize relative px-3 py-1.5 font-semibold text-text
                        border-b border-r border-border last:border-r-0
                        whitespace-nowrap
                        transition-all duration-150
                        ${getAlignmentClass(headerAlign)}
                        ${isDragging ? 'opacity-50 bg-primary/10' : ''}
                        ${isDropTarget ? 'bg-primary/20 border-l-2 border-l-primary' : ''}
                        ${pinned ? 'bg-background dark:bg-background' : ''}
                      `}
                      style={{
                        width: columnSizing[header.id] ? header.getSize() : 'auto',
                        minWidth: header.column.columnDef.minSize ?? 50,
                        ...(pinned === 'left' ? {
                          position: 'sticky',
                          left: header.column.getStart('left'),
                          zIndex: 12,
                        } : {}),
                        ...(pinned === 'right' ? {
                          position: 'sticky',
                          right: header.column.getAfter('right'),
                          zIndex: 12,
                        } : {}),
                        ...(isLastLeftPinned ? {
                          boxShadow: '4px 0 8px -2px rgba(0,0,0,0.1)',
                        } : {}),
                        ...(isFirstRightPinned ? {
                          boxShadow: '-4px 0 8px -2px rgba(0,0,0,0.1)',
                        } : {}),
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
                          {/* 드래그 핸들 (고정 컬럼은 숨김) */}
                          {enableColumnReordering && !pinned && (
                            <GripVertical
                              className="w-4 h-4 text-text-muted cursor-grab active:cursor-grabbing opacity-50 hover:opacity-100 flex-shrink-0"
                            />
                          )}

                          {/* 핀 고정/해제 버튼 */}
                          {enableColumnPinning && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                header.column.pin(pinned ? false : 'left');
                              }}
                              className={`flex-shrink-0 p-0.5 rounded hover:bg-primary/10 transition-colors ${pinned ? 'text-primary' : 'text-text-muted opacity-0 group-hover/resize:opacity-50 hover:!opacity-100'}`}
                              title={pinned ? '고정 해제' : '컬럼 고정'}
                            >
                              {pinned
                                ? <PinOff className="w-3.5 h-3.5" />
                                : <Pin className="w-3.5 h-3.5" />}
                            </button>
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
                      style={{
                        ...(pinned === 'left' ? {
                          position: 'sticky',
                          left: header.column.getStart('left'),
                          zIndex: 12,
                        } : {}),
                        ...(pinned === 'right' ? {
                          position: 'sticky',
                          right: header.column.getAfter('right'),
                          zIndex: 12,
                        } : {}),
                        ...(isLastLeftPinned ? {
                          boxShadow: '4px 0 8px -2px rgba(0,0,0,0.1)',
                        } : {}),
                        ...(isFirstRightPinned ? {
                          boxShadow: '-4px 0 8px -2px rgba(0,0,0,0.1)',
                        } : {}),
                      }}
                    >
                      <ColumnFilter column={header.column} data={data} />
                    </th>
                  );
                })}
              </tr>
            )}
          </thead>

          {/* Body */}
          <tbody>
            {table.getRowModel().rows.length === 0 ? (
              // 빈 데이터
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-3 py-16 text-center text-text-muted"
                >
                  {isLoading ? '\u00A0' : emptyMessage}
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
                    ${rowClassName?.(row.original, index) ?? ''}
                  `}
                >
                  {row.getVisibleCells().map((cell) => {
                    const cellAlign = getCellAlignment(cell);
                    const pinned = cell.column.getIsPinned();
                    const isLastLeftPinned = pinned === 'left' && cell.column.getIsLastColumn('left');
                    const isFirstRightPinned = pinned === 'right' && cell.column.getIsFirstColumn('right');
                    const pinnedBg = pinned
                      ? (index % 2 === 0
                        ? 'bg-surface dark:bg-surface'
                        : 'bg-background dark:bg-background')
                      : '';

                    return (
                      <td
                        key={cell.id}
                        className={`px-3 py-1 text-text whitespace-nowrap ${getAlignmentClass(cellAlign)} ${pinnedBg}`}
                        style={{
                          width: columnSizing[cell.column.id] ? cell.column.getSize() : 'auto',
                          minWidth: cell.column.columnDef.minSize ?? 50,
                          ...(pinned === 'left' ? {
                            position: 'sticky',
                            left: cell.column.getStart('left'),
                            zIndex: 11,
                          } : {}),
                          ...(pinned === 'right' ? {
                            position: 'sticky',
                            right: cell.column.getAfter('right'),
                            zIndex: 11,
                          } : {}),
                          ...(isLastLeftPinned ? {
                            boxShadow: '4px 0 8px -2px rgba(0,0,0,0.1)',
                          } : {}),
                          ...(isFirstRightPinned ? {
                            boxShadow: '-4px 0 8px -2px rgba(0,0,0,0.1)',
                          } : {}),
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
      </div>

      {/* Footer — 건수 + 페이지네이션 + 페이지 크기 */}
      {data.length > 0 && (
        <div className="flex items-center justify-between mt-2 px-1">
          {/* 좌: 건수 */}
          <div className="text-sm text-text-muted">
            {activeFilterCount > 0
              ? `${table.getFilteredRowModel().rows.length} / ${data.length}건 (필터 적용)`
              : `전체 ${data.length}건`}
          </div>

          {/* 중앙+우: 페이지네이션 + 페이지 크기 */}
          <div className="flex items-center gap-4">
            {/* 페이지네이션 */}
            {table.getPageCount() > 1 && (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => table.previousPage()}
                  disabled={!table.getCanPreviousPage()}
                  className="p-1 rounded hover:bg-card-hover disabled:opacity-30 disabled:cursor-not-allowed text-text-muted hover:text-text"
                  title="이전 페이지"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                {(() => {
                  const currentPage = table.getState().pagination.pageIndex;
                  const totalPages = table.getPageCount();
                  const pages: (number | string)[] = [];

                  if (totalPages <= 7) {
                    for (let i = 0; i < totalPages; i++) pages.push(i);
                  } else {
                    pages.push(0);
                    if (currentPage > 3) pages.push('...');
                    const start = Math.max(1, currentPage - 1);
                    const end = Math.min(totalPages - 2, currentPage + 1);
                    for (let i = start; i <= end; i++) pages.push(i);
                    if (currentPage < totalPages - 4) pages.push('...');
                    pages.push(totalPages - 1);
                  }

                  return pages.map((page, idx) =>
                    page === '...' ? (
                      <span key={`ellipsis-${idx}`} className="px-1 text-xs text-text-muted">…</span>
                    ) : (
                      <button
                        key={page}
                        onClick={() => table.setPageIndex(page as number)}
                        className={`min-w-[28px] h-7 px-1.5 text-xs rounded font-medium transition-colors ${
                          currentPage === page
                            ? 'bg-primary text-white'
                            : 'text-text-muted hover:bg-card-hover hover:text-text'
                        }`}
                      >
                        {(page as number) + 1}
                      </button>
                    )
                  );
                })()}

                <button
                  onClick={() => table.nextPage()}
                  disabled={!table.getCanNextPage()}
                  className="p-1 rounded hover:bg-card-hover disabled:opacity-30 disabled:cursor-not-allowed text-text-muted hover:text-text"
                  title="다음 페이지"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* 페이지 크기 드롭다운 */}
            <select
              value={pagination.pageSize}
              onChange={(e) => {
                const newSize = Number(e.target.value);
                setPagination({ pageIndex: 0, pageSize: newSize });
              }}
              className="h-7 px-2 text-xs bg-surface border border-border rounded text-text focus:outline-none focus:ring-1 focus:ring-primary"
            >
              {PAGE_SIZE_OPTIONS.map((size) => (
                <option key={size} value={size}>{size}건</option>
              ))}
            </select>
          </div>
        </div>
      )}
    </div>
  );
}

export default DataGrid;
