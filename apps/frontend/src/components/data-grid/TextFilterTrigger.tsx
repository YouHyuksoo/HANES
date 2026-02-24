/**
 * @file src/components/data-grid/TextFilterTrigger.tsx
 * @description 멀티 선택(IN) 필터 행의 트리거 버튼
 *
 * 초보자 가이드:
 * 1. 필터 행 `<th>` 안에 렌더링되는 작은 버튼
 * 2. 활성 필터가 있으면 파란색으로 표시
 * 3. 클릭 시 체크박스 목록 팝업을 연다
 */
import { useState, useRef, useCallback } from "react";
import { Column } from "@tanstack/react-table";
import { ListFilter } from "lucide-react";
import { TextFilterPopup } from "./TextFilterPopup";
import type { TextFilterValue } from "./textFilterFn";

export interface TextFilterTriggerProps<T> {
  column: Column<T, unknown>;
  data: T[];
}

export function TextFilterTrigger<T>({ column, data }: TextFilterTriggerProps<T>) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const filterValue = column.getFilterValue() as TextFilterValue | undefined;

  const isActive = !!filterValue && filterValue.checkedValues !== null;

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
        title="멀티 선택 필터"
      >
        <ListFilter className="w-3.5 h-3.5" />
      </button>

      {open && (
        <TextFilterPopup
          column={column}
          data={data}
          anchorRect={getRect}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
