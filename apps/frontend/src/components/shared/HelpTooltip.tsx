"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { CircleHelp } from "lucide-react";

const TOOLTIP_WIDTH = 288; // px (max-w-72)

export interface HelpTooltipProps {
  /** 컬럼/필드의 용도 설명 */
  description: string;
  /** 실제 DB 컬럼 위치 (예: ITEM_MASTERS.ITEM_CODE) */
  db?: string;
  /** 지정하면 도움말 아이콘 대신 해당 컨트롤을 툴팁 대상으로 사용한다. */
  children?: ReactNode;
  /** 비활성 컨트롤 대신 키보드 포커스를 받을 수 있게 한다. */
  focusable?: boolean;
  /** 버튼 등 사용자 지정 대상의 레이아웃을 유지하는 래퍼 클래스 */
  className?: string;
  /** data-* 식별자 (테스트/디버깅용) */
  dataField?: string;
}

/**
 * 세련된 fixed-position 도움말 툴팁.
 * - 네이티브 title 속성을 쓰지 않고 포털로 렌더해 overflow 컨테이너(DataGrid 등)에 잘리지 않는다.
 * - 마우스 hover / 포커스 시 ? 아이콘 아래에 카드형 설명 + DB 컬럼명을 띄운다.
 */
export default function HelpTooltip({ description, db, dataField, children, focusable = false, className = '' }: HelpTooltipProps) {
  const anchorRef = useRef<HTMLSpanElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const tooltipId = useId();
  const [coords, setCoords] = useState<{ left: number; top: number; above?: boolean } | null>(null);

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
  useLayoutEffect(() => {
    if (!coords || coords.above || !tooltipRef.current || !anchorRef.current) return;
    const box = tooltipRef.current.getBoundingClientRect();
    if (box.bottom > window.innerHeight - 8) {
      setCoords({ ...coords, above: true, top: Math.max(8, anchorRef.current.getBoundingClientRect().top - box.height - 10) });
    }
  }, [coords]);
  useEffect(() => {
    if (!coords) return;
    window.addEventListener('resize', close);
    window.addEventListener('scroll', close, true);
    return () => {
      window.removeEventListener('resize', close);
      window.removeEventListener('scroll', close, true);
    };
  }, [coords, close]);

  return (
    <span
      ref={anchorRef}
      tabIndex={children ? (focusable ? 0 : undefined) : 0}
      data-field-help={dataField}
      aria-label={children ? undefined : description}
      aria-describedby={coords ? tooltipId : undefined}
      onMouseEnter={open}
      onMouseLeave={close}
      onFocus={open}
      onBlur={close}
      onKeyDown={(e) => { if (e.key === 'Escape') close(); }}
      className={`${children ? "inline-flex" : "inline-flex h-4 w-4 cursor-help items-center justify-center rounded-full text-text-muted/70 transition-colors hover:text-primary focus:text-primary focus:outline-none"} ${className}`}
    >
      {children ?? <CircleHelp className="h-3.5 w-3.5" />}
      {coords &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={tooltipRef}
            id={tooltipId}
            role="tooltip"
            style={{ left: coords.left, top: coords.top, width: TOOLTIP_WIDTH }}
            className="pointer-events-none fixed z-[9999] -translate-x-1/2 animate-fade-in"
          >
            {/* 화살표 */}
            <div className={`absolute ${coords.above ? '-bottom-1.5 border-r border-b' : '-top-1.5 border-l border-t'} left-1/2 h-3 w-3 -translate-x-1/2 rotate-45 rounded-sm border-slate-700 bg-slate-900 dark:border-slate-600 dark:bg-slate-800`} />
            <div className="relative overflow-hidden rounded-xl border border-slate-700 bg-slate-900 text-slate-100 shadow-2xl ring-1 ring-black/5 dark:border-slate-600 dark:bg-slate-800">
              <p className="whitespace-pre-line px-3.5 pb-2.5 pt-3 text-[12.5px] leading-relaxed text-slate-100">
                {description}
              </p>
              {db && <div className="flex items-center gap-2 border-t border-slate-700/80 bg-slate-950/60 px-3.5 py-2 dark:border-slate-600/70 dark:bg-slate-900/60">
                <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                  DB
                </span>
                <code className="font-mono text-[11px] font-medium text-emerald-300">{db}</code>
              </div>}
            </div>
          </div>,
          document.body,
        )}
    </span>
  );
}
