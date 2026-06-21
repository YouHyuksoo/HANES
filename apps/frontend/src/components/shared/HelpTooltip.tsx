"use client";

import { useCallback, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CircleHelp } from "lucide-react";

const TOOLTIP_WIDTH = 288; // px (max-w-72)

export interface HelpTooltipProps {
  /** 컬럼/필드의 용도 설명 */
  description: string;
  /** 실제 DB 컬럼 위치 (예: ITEM_MASTERS.ITEM_CODE) */
  db: string;
  /** data-* 식별자 (테스트/디버깅용) */
  dataField?: string;
}

/**
 * 세련된 fixed-position 도움말 툴팁.
 * - 네이티브 title 속성을 쓰지 않고 포털로 렌더해 overflow 컨테이너(DataGrid 등)에 잘리지 않는다.
 * - 마우스 hover / 포커스 시 ? 아이콘 아래에 카드형 설명 + DB 컬럼명을 띄운다.
 */
export default function HelpTooltip({ description, db, dataField }: HelpTooltipProps) {
  const anchorRef = useRef<HTMLButtonElement>(null);
  const [coords, setCoords] = useState<{ left: number; top: number } | null>(null);

  const open = useCallback(() => {
    const el = anchorRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const center = rect.left + rect.width / 2;
    const half = TOOLTIP_WIDTH / 2;
    const left = Math.min(Math.max(center, half + 8), window.innerWidth - half - 8);
    setCoords({ left, top: rect.bottom + 10 });
  }, []);

  const close = useCallback(() => setCoords(null), []);

  return (
    <button
      ref={anchorRef}
      type="button"
      tabIndex={-1}
      data-field-help={dataField}
      aria-label={`${description} DB 컬럼 ${db}`}
      onMouseEnter={open}
      onMouseLeave={close}
      onFocus={open}
      onBlur={close}
      onClick={(e) => e.preventDefault()}
      className="inline-flex h-4 w-4 items-center justify-center rounded-full text-text-muted/70 transition-colors hover:text-primary focus:text-primary focus:outline-none"
    >
      <CircleHelp className="h-3.5 w-3.5" />
      {coords &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            role="tooltip"
            style={{ left: coords.left, top: coords.top, width: TOOLTIP_WIDTH }}
            className="pointer-events-none fixed z-[9999] -translate-x-1/2 animate-fade-in"
          >
            {/* 화살표 */}
            <div className="absolute -top-1.5 left-1/2 h-3 w-3 -translate-x-1/2 rotate-45 rounded-sm border-l border-t border-slate-700 bg-slate-900 dark:border-slate-600 dark:bg-slate-800" />
            <div className="relative overflow-hidden rounded-xl border border-slate-700 bg-slate-900 text-slate-100 shadow-2xl ring-1 ring-black/5 dark:border-slate-600 dark:bg-slate-800">
              <p className="whitespace-pre-line px-3.5 pb-2.5 pt-3 text-[12.5px] leading-relaxed text-slate-100">
                {description}
              </p>
              <div className="flex items-center gap-2 border-t border-slate-700/80 bg-slate-950/60 px-3.5 py-2 dark:border-slate-600/70 dark:bg-slate-900/60">
                <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                  DB
                </span>
                <code className="font-mono text-[11px] font-medium text-emerald-300">{db}</code>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </button>
  );
}
