/**
 * @file src/components/data-grid/PaginationControls.tsx
 * @description DataGrid 페이지네이션 컨트롤 컴포넌트
 *
 * 초보자 가이드:
 * 1. **페이지네이션**: 대량 데이터를 일정 크기로 나눠 페이지별 표시
 * 2. 이전/다음 버튼과 페이지 번호 버튼으로 탐색
 * 3. 총 7페이지 이하면 모든 번호 표시, 초과 시 현재 페이지 주변만 표시
 * 4. 말줄임표(…)로 생략된 페이지 범위를 나타냄
 * 5. `Table` 객체의 메서드를 사용하여 페이지 이동 수행
 */
import { Table, PaginationState } from '@tanstack/react-table';
import { ChevronLeft, ChevronRight } from 'lucide-react';

/** 페이지 크기 옵션 */
const PAGE_SIZE_OPTIONS = [20, 50, 100, 200, 500];

/** PaginationControls 컴포넌트 props */
export interface PaginationControlsProps<T> {
  /** TanStack Table 인스턴스 */
  table: Table<T>;
  /** 전체 데이터 건수 */
  totalCount: number;
  /** 필터 적용 후 건수 */
  filteredCount: number;
  /** 활성 필터 수 */
  activeFilterCount: number;
  /** 현재 페이지네이션 상태 */
  pagination: PaginationState;
  /** 페이지네이션 상태 변경 콜백 */
  onPaginationChange: (state: PaginationState) => void;
}

/**
 * 페이지네이션 컨트롤 — 건수 표시 + 페이지 번호 + 페이지 크기 셀렉트
 *
 * @example
 * ```tsx
 * <PaginationControls
 *   table={table}
 *   totalCount={data.length}
 *   filteredCount={table.getFilteredRowModel().rows.length}
 *   activeFilterCount={columnFilters.length}
 *   pagination={pagination}
 *   onPaginationChange={setPagination}
 * />
 * ```
 */
export function PaginationControls<T>({
  table,
  totalCount,
  filteredCount,
  activeFilterCount,
  pagination,
  onPaginationChange,
}: PaginationControlsProps<T>) {
  if (totalCount <= 0) return null;

  return (
    <div className="flex items-center justify-between mt-2 px-1">
      {/* 좌: 건수 */}
      <div className="text-sm text-text-muted">
        {activeFilterCount > 0
          ? `${filteredCount} / ${totalCount}건 (필터 적용)`
          : `전체 ${totalCount}건`}
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
            onPaginationChange({ pageIndex: 0, pageSize: newSize });
          }}
          className="h-7 px-2 text-xs bg-surface border border-border rounded text-text focus:outline-none focus:ring-1 focus:ring-primary"
        >
          {PAGE_SIZE_OPTIONS.map((size) => (
            <option key={size} value={size}>{size}건</option>
          ))}
        </select>
      </div>
    </div>
  );
}
