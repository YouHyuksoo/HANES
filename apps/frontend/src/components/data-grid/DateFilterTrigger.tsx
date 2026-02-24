/**
 * @file src/components/data-grid/DateFilterTrigger.tsx
 * @description 날짜 필터 행의 트리거 버튼 — 클릭 시 DateFilterPopup을 토글
 *
 * 초보자 가이드:
 * 1. 필터 행 `<th>` 안에 렌더링되는 작은 버튼
 * 2. 활성 필터가 있으면 파란색으로 표시
 * 3. 클릭 시 `getBoundingClientRect`로 위치를 계산해 팝업을 연다
 */
import { useState, useRef, useCallback } from "react";
import { Column } from "@tanstack/react-table";
import { Calendar } from "lucide-react";
import { DateFilterPopup } from "./DateFilterPopup";
import type { DateFilterValue } from "./dateFilterFn";

export interface DateFilterTriggerProps<T> {
  column: Column<T, unknown>;
}

export function DateFilterTrigger<T>({ column }: DateFilterTriggerProps<T>) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const filterValue = column.getFilterValue() as DateFilterValue | undefined;

  const isActive = !!filterValue && (!!filterValue.from || !!filterValue.to);

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
        title="날짜 필터"
      >
        <Calendar className="w-3.5 h-3.5" />
      </button>

      {open && (
        <DateFilterPopup
          column={column}
          anchorRect={getRect}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
