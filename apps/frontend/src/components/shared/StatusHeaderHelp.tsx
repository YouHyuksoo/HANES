"use client";

/**
 * @file components/shared/StatusHeaderHelp.tsx
 * @description 상태/유형 컬럼 헤더용 도움말(?) — 해당 comCode 타입의 모든 코드값+의미를 툴팁으로 자동 나열
 *
 * 초보자 가이드:
 * 1. 그리드 컬럼 header에 사용: header: () => <StatusHeaderHelp label={t("common.status")} codeType="BOX_STATUS" />
 * 2. 라벨은 i18n `comCode.{codeType}` 사전에서 자동 로드 → 다국어 자동 처리(별도 번역 불필요)
 * 3. only 로 표시할 코드값을 한정할 수 있음 (예: 화면에 일부 상태만 등장하는 경우)
 * 4. 포털 렌더라 DataGrid overflow 에 잘리지 않음
 */

import { useCallback, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CircleHelp } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useComCodeList } from "@/hooks/useComCode";

const TOOLTIP_WIDTH = 288;

export interface StatusHeaderHelpProps {
  /** 헤더에 표시할 라벨 (예: 상태, OQC검사) */
  label: string;
  /** 공통코드 타입 (예: BOX_STATUS, OQC_STATUS, PROD_RESULT_STATUS) */
  codeType: string;
  /** 표시할 코드값 한정(선택). 미지정 시 comCode의 전체 코드 */
  only?: string[];
  /** 헤더 정렬 (default center) */
  align?: "left" | "center" | "right";
}

export default function StatusHeaderHelp({ label, codeType, only, align = "center" }: StatusHeaderHelpProps) {
  const { t } = useTranslation();
  const anchorRef = useRef<HTMLSpanElement>(null);
  const [coords, setCoords] = useState<{ left: number; top: number } | null>(null);

  // DB 공통코드(useComCodeList)를 출처로:
  // - 라벨: i18n comCode.{codeType}.{code} 우선 · DB codeName 폴백
  // - 의미설명: i18n comCodeDesc.{codeType}.{code} 우선 · DB codeDesc 폴백 (없으면 라벨만)
  const list = useComCodeList(codeType);
  const entries = list
    .filter((c) => !only || only.includes(c.detailCode))
    .map((c) => ({
      code: c.detailCode,
      label: t(`comCode.${codeType}.${c.detailCode}`, { defaultValue: c.codeName }),
      desc: t(`comCodeDesc.${codeType}.${c.detailCode}`, { defaultValue: c.codeDesc ?? "" }),
    }));

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

  const justify = align === "left" ? "justify-start" : align === "right" ? "justify-end" : "justify-center";

  return (
    <span className={`inline-flex w-full items-center gap-1 ${justify}`}>
      <span>{label}</span>
      {entries.length > 0 && (
        <span
          ref={anchorRef}
          tabIndex={-1}
          aria-label={`${label} 상태값 안내`}
          onMouseEnter={open}
          onMouseLeave={close}
          onFocus={open}
          onBlur={close}
          className="inline-flex h-4 w-4 cursor-help items-center justify-center rounded-full text-text-muted/70 transition-colors hover:text-primary"
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
                <div className="absolute -top-1.5 left-1/2 h-3 w-3 -translate-x-1/2 rotate-45 rounded-sm border-l border-t border-slate-700 bg-slate-900 dark:border-slate-600 dark:bg-slate-800" />
                <div className="relative overflow-hidden rounded-xl border border-slate-700 bg-slate-900 text-slate-100 shadow-2xl ring-1 ring-black/5 dark:border-slate-600 dark:bg-slate-800">
                  <div className="border-b border-slate-700/80 bg-slate-950/60 px-3.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:border-slate-600/70 dark:bg-slate-900/60">
                    {label}
                  </div>
                  <ul className="space-y-1.5 px-3.5 py-2.5 text-left text-[12px] leading-relaxed">
                    {entries.map((e) => (
                      <li key={e.code} className="flex flex-col gap-0.5">
                        <div className="flex items-baseline gap-2">
                          <code className="shrink-0 font-mono text-[10px] font-medium text-emerald-300">{e.code}</code>
                          <span className="font-medium text-slate-100">{e.label}</span>
                        </div>
                        {e.desc && <span className="pl-1 text-[11px] leading-snug text-slate-300">{e.desc}</span>}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>,
              document.body,
            )}
        </span>
      )}
    </span>
  );
}
