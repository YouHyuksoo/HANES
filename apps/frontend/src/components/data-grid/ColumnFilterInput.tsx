/**
 * @file src/components/data-grid/ColumnFilterInput.tsx
 * @description DataGrid 컬럼 필터 입력 컴포넌트 (텍스트/셀렉트)
 *
 * 초보자 가이드:
 * 1. **컬럼 필터**: 각 컬럼 헤더 아래에 표시되는 검색/필터 입력 UI
 * 2. `filterType`이 'text'이면 텍스트 입력, 'select'이면 드롭다운
 * 3. `filterType`이 'none'이거나 actions/select 컬럼이면 필터 미표시
 * 4. select 필터 시 `filterOptions`가 없으면 데이터에서 자동 추출
 * 5. TanStack Table의 `Column` 객체를 받아 `setFilterValue`로 필터 적용
 */
import { Column } from '@tanstack/react-table';

/** ColumnFilterInput 컴포넌트 props */
export interface ColumnFilterInputProps<T> {
  /** TanStack Table 컬럼 객체 */
  column: Column<T, unknown>;
  /** 전체 원본 데이터 (select 필터 시 옵션 자동 추출에 사용) */
  data: T[];
}

/**
 * 컬럼 필터 입력 — text 또는 select 타입에 따라 적절한 UI 렌더링
 *
 * @example
 * ```tsx
 * <ColumnFilterInput column={header.column} data={data} />
 * ```
 */
export function ColumnFilterInput<T>({ column, data: allData }: ColumnFilterInputProps<T>) {
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
}
