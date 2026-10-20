"use client";

/**
 * @file components/shared/NumericKeypad.tsx
 * @description 터치 입력용 숫자 키패드 패널 — 화면 오른쪽에 붙여 측정값 같은 숫자를 손가락으로 입력한다.
 *
 * 초보자 가이드:
 * 1. 입력 대상(현재 칸)은 화면이 정한다. 키패드는 value 를 받아 onChange 로 새 문자열을 돌려준다.
 * 2. 버튼은 pointerdown 에서 기본 동작을 막아, 누르는 동안 입력칸의 포커스를 빼앗지 않는다.
 * 3. 다음/이전은 화면이 칸 순서를 알고 있을 때만 넘긴다(onNext/onPrev 미지정 시 버튼 비활성).
 *
 * 사용 예:
 *   <NumericKeypad label="압착고" hint="1.2 ~ 1.3" value={v} onChange={setV} onNext={next} onClose={close} />
 */
import type { PointerEvent, ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { ChevronLeft, ChevronRight, Delete, X } from "lucide-react";

export interface NumericKeypadProps {
  /** 현재 입력 대상 이름. 없으면 대상 선택 안내를 보인다 */
  label?: string | null;
  /** 대상 아래 보조 문구(예: 규격 범위) */
  hint?: ReactNode;
  /** 보조 문구를 경고색으로 */
  hintDanger?: boolean;
  value: string;
  onChange: (value: string) => void;
  onNext?: () => void;
  onPrev?: () => void;
  onClose: () => void;
  /** 소수점 허용 (기본 true) */
  allowDecimal?: boolean;
  /** 최대 글자 수 (기본 10) */
  maxLength?: number;
}

const DIGIT_ROWS = [["7", "8", "9"], ["4", "5", "6"], ["1", "2", "3"]];

/** 입력칸 포커스를 유지한 채 버튼만 동작시키는 pointerdown 처리 */
const keepFocus = (e: PointerEvent) => e.preventDefault();

export default function NumericKeypad({
  label,
  hint,
  hintDanger = false,
  value,
  onChange,
  onNext,
  onPrev,
  onClose,
  allowDecimal = true,
  maxLength = 10,
}: NumericKeypadProps) {
  const { t } = useTranslation();
  const disabled = !label;

  const press = (key: string) => {
    if (disabled) return;
    if (key === "." && (!allowDecimal || value.includes("."))) return;
    if (value.length >= maxLength) return;
    // 맨 앞 소수점은 0. 으로, 앞자리 0 뒤 숫자는 0 을 대체
    if (key === "." && value === "") return onChange("0.");
    if (value === "0" && key !== ".") return onChange(key);
    onChange(value + key);
  };

  const keyClass = "h-14 rounded-md border border-border bg-surface text-xl font-semibold text-text tabular-nums active:bg-primary active:text-white disabled:opacity-40 select-none touch-manipulation";

  return (
    <aside
      className="w-64 shrink-0 min-h-0 flex flex-col gap-3 rounded-[var(--radius)] border border-border bg-surface p-3 shadow-lg animate-slide-in-right"
      data-testid="numeric-keypad"
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-text">{t("common.keypad.title", "키패드")}</span>
        <button
          type="button"
          onPointerDown={keepFocus}
          onClick={onClose}
          className="p-1.5 rounded text-text-muted hover:bg-background"
          aria-label={t("common.keypad.close", "키패드 닫기")}
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* 현재 입력 대상과 값 */}
      <div className="rounded-md border border-border bg-background px-3 py-2">
        <div className="text-xs text-text-muted truncate">{label ?? t("common.keypad.selectField", "입력할 칸을 선택하세요")}</div>
        <div className="h-9 text-right font-mono text-2xl font-bold text-text tabular-nums truncate" data-testid="numeric-keypad-value">{value}</div>
        {hint && <div className={`text-right text-xs tabular-nums ${hintDanger ? "text-red-600 dark:text-red-400 font-semibold" : "text-text-muted"}`}>{hint}</div>}
      </div>

      <div className="grid grid-cols-3 gap-2">
        {DIGIT_ROWS.flat().map((d) => (
          <button key={d} type="button" disabled={disabled} onPointerDown={keepFocus} onClick={() => press(d)} className={keyClass} data-testid={`numeric-keypad-${d}`}>
            {d}
          </button>
        ))}
        <button type="button" disabled={disabled || !allowDecimal} onPointerDown={keepFocus} onClick={() => press(".")} className={keyClass} data-testid="numeric-keypad-dot">.</button>
        <button type="button" disabled={disabled} onPointerDown={keepFocus} onClick={() => press("0")} className={keyClass} data-testid="numeric-keypad-0">0</button>
        <button
          type="button"
          disabled={disabled}
          onPointerDown={keepFocus}
          onClick={() => onChange(value.slice(0, -1))}
          className={`${keyClass} flex items-center justify-center`}
          aria-label={t("common.keypad.backspace", "한 글자 지우기")}
          data-testid="numeric-keypad-back"
        >
          <Delete className="w-6 h-6" />
        </button>
      </div>

      <button
        type="button"
        disabled={disabled}
        onPointerDown={keepFocus}
        onClick={() => onChange("")}
        className="h-11 rounded-md border border-border bg-surface text-sm font-semibold text-text-muted active:bg-background disabled:opacity-40 select-none touch-manipulation"
        data-testid="numeric-keypad-clear"
      >
        {t("common.keypad.clear", "전체 지우기")}
      </button>

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          disabled={!onPrev}
          onPointerDown={keepFocus}
          onClick={onPrev}
          className="h-12 rounded-md border border-border bg-surface text-sm font-semibold text-text flex items-center justify-center gap-1 active:bg-background disabled:opacity-40 select-none touch-manipulation"
          data-testid="numeric-keypad-prev"
        >
          <ChevronLeft className="w-4 h-4" />{t("common.keypad.prev", "이전")}
        </button>
        <button
          type="button"
          disabled={!onNext}
          onPointerDown={keepFocus}
          onClick={onNext}
          className="h-12 rounded-md bg-primary text-sm font-semibold text-white flex items-center justify-center gap-1 active:opacity-80 disabled:opacity-40 select-none touch-manipulation"
          data-testid="numeric-keypad-next"
        >
          {t("common.keypad.next", "다음")}<ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </aside>
  );
}
