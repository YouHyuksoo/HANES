/**
 * @file src/components/data-grid/NumberFilterTrigger.tsx
 * @description 숫자 필터 행의 트리거 버튼 — 클릭 시 NumberFilterPopup을 토글
 *
 * 초보자 가이드:
 * 1. 필터 행 `<th>` 안에 렌더링되는 작은 버튼
 * 2. 활성 필터가 있으면 파란색으로 표시
 * 3. 클릭 시 `getBoundingClientRect`로 위치를 계산해 팝업을 연다
 */
import { useState, useRef, useCallback } from "react";
import { Column } from "@tanstack/react-table";
import { Filter } from "lucide-react";
import { NumberFilterPopup } from "./NumberFilterPopup";
import type { NumberFilterValue } from "./numberFilterFn";

export interface NumberFilterTriggerProps<T> {
  column: Column<T, unknown>;
  data: T[];
}

export function NumberFilterTrigger<T>({ column, data }: NumberFilterTriggerProps<T>) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const filterValue = column.getFilterValue() as NumberFilterValue | undefined;

  const isActive = !!filterValue && (
    filterValue.checkedValues !== null ||
    filterValue.condition1.operator !== "none" ||
    filterValue.condition2.operator !== "none"
  );

  const getRect = useCallback(() => {
    return btnRef.current?.getBoundingClientRect() ?? null;
  }, []);

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`
          inline-flex items-center justify-center w-full h-7 px-1
          text-xs rounded border transition-colors
          ${isActive
            ? "border-primary bg-primary/10 text-primary dark:bg-primary/20"
            : "border-border bg-surface text-text-muted hover:text-text hover:border-border-hover"
          }
        `}
        title="숫자 필터"
      >
        <Filter className="w-3.5 h-3.5" />
      </button>

      {open && (
        <NumberFilterPopup
          column={column}
          data={data}
          anchorRect={getRect}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
