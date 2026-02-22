/**
 * @file src/components/data-grid/ResizeHandle.tsx
 * @description DataGrid 컬럼 리사이즈 핸들 컴포넌트
 *
 * 초보자 가이드:
 * 1. **리사이즈 핸들**: 테이블 헤더 경계에 위치한 드래그 가능한 영역
 * 2. 마우스로 드래그하면 컬럼 너비를 조절할 수 있음
 * 3. 더블클릭하면 컬럼 크기가 기본값으로 초기화됨
 * 4. 리사이즈 중에는 파란색 바가 표시되고, hover 시 얇은 라인이 나타남
 * 5. `syncColumnWidths`는 리사이즈 시작 전 실제 DOM 너비를 동기화하는 콜백
 */
import { Header } from '@tanstack/react-table';

/** ResizeHandle 컴포넌트 props */
export interface ResizeHandleProps<T> {
  /** TanStack Table 헤더 객체 */
  header: Header<T, unknown>;
  /** 리사이즈 시작 전 모든 컬럼의 DOM 너비를 동기화하는 콜백 */
  syncColumnWidths: (e: React.MouseEvent | React.TouchEvent) => void;
}

/**
 * 컬럼 리사이즈 핸들 — 헤더 우측 끝에 렌더링되어 드래그로 컬럼 너비 조절
 *
 * @example
 * ```tsx
 * <ResizeHandle header={header} syncColumnWidths={syncColumnWidths} />
 * ```
 */
export function ResizeHandle<T>({ header, syncColumnWidths }: ResizeHandleProps<T>) {
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
}
