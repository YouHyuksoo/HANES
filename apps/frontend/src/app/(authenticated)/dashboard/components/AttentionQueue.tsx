"use client";

/**
 * @file src/app/(authenticated)/dashboard/components/AttentionQueue.tsx
 * @description 조치 필요 큐 — 심각도 순 예외 목록. 행을 누르면 그 자리에서 펼쳐져 무엇이 걸렸는지 보인다.
 *
 * 초보자 가이드:
 * - 접힌 행: 제목 + 대표 3개 + 건수. 펼친 행: 전체 목록(설비/LOT/지시 단위) + 담당 화면 링크.
 * - 목록은 buildAttention 이 details 로 넣어 준다. 건수만 집계되는 항목(설비정지·불량미처리·수리대기)은
 *   목록이 없으므로 "화면에서 확인" 안내와 링크만 보인다.
 * - 빈 큐 = 정상 (초록 체크 하나만 보여준다).
 */
import { useState } from "react";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { ArrowUpRight, CheckCircle2, ChevronRight } from "lucide-react";
import type { AttentionItem, AttentionSeverity } from "./types";

const DOT: Record<AttentionSeverity, string> = {
  critical: "bg-error ds-blink",
  high: "bg-error",
  medium: "bg-warning",
  low: "bg-text-muted",
};

const COUNT_TONE: Record<AttentionSeverity, string> = {
  critical: "text-error",
  high: "text-error",
  medium: "text-warning",
  low: "text-text-muted",
};

interface Props {
  items: AttentionItem[];
  total: number;
}

const rowId = (item: AttentionItem) => `${item.key}-${item.kindKey ?? ""}`;

export default function AttentionQueue({ items, total }: Props) {
  const { t } = useTranslation();
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <div className="h-full flex flex-col min-h-0">
      <div className="flex items-baseline justify-between pb-2 border-b border-border flex-shrink-0">
        <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted">{t("dashboard.attention.title")}</span>
        <span className={`text-2xl font-extrabold tabular-nums leading-none ${total === 0 ? "text-success" : "text-warning"}`}>{total}</span>
      </div>

      {items.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-2 text-success">
          <CheckCircle2 className="w-8 h-8" strokeWidth={1.5} />
          <span className="text-sm font-medium text-text-muted">{t("dashboard.attention.empty")}</span>
        </div>
      ) : (
        <ol className="flex-1 min-h-0 overflow-y-auto divide-y divide-border">
          {items.map((item, i) => {
            const id = rowId(item);
            const open = openId === id;
            const kind = item.kindKey ? t(`dashboard.inspect.${item.kindKey}`) : undefined;
            return (
              <li key={id} className="ds-rise" style={{ animationDelay: `${200 + i * 50}ms` }}>
                <button
                  type="button"
                  aria-expanded={open}
                  onClick={() => setOpenId(open ? null : id)}
                  className="w-full text-left flex items-start gap-3 py-2.5 group hover:bg-surface -mx-2 px-2 rounded transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <span className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${DOT[item.severity]}`} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-text leading-tight">
                      {t(`dashboard.attention.${item.key}`, { count: item.count, kind })}
                    </div>
                    {!open && item.samples.length > 0 && (
                      <div className="text-[11px] text-text-muted truncate mt-0.5">{item.samples.join(" · ")}</div>
                    )}
                  </div>
                  <span className={`text-lg font-extrabold tabular-nums leading-none mt-0.5 ${COUNT_TONE[item.severity]}`}>{item.count}</span>
                  <ChevronRight
                    className={`w-4 h-4 mt-0.5 text-text-muted group-hover:text-primary transition-transform flex-shrink-0 ${open ? "rotate-90 text-primary" : ""}`}
                  />
                </button>

                {open && (
                  <div className="pb-3 pl-5 pr-1">
                    {item.details.length > 0 ? (
                      <ul className="max-h-56 overflow-y-auto border-l-2 border-border pl-3 divide-y divide-border/60">
                        {item.details.map((d) => (
                          <li key={`${d.code}-${d.name}`} className="py-1.5 flex items-baseline gap-2 min-w-0">
                            <span className="font-mono text-[11px] text-text-muted flex-shrink-0">{d.code}</span>
                            <span className="text-xs text-text truncate">{d.name}</span>
                            {d.meta && <span className="ml-auto text-[11px] text-text-muted tabular-nums whitespace-nowrap">{d.meta}</span>}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-[11px] text-text-muted border-l-2 border-border pl-3 py-1">{t("dashboard.attention.noDetail")}</p>
                    )}
                    <Link href={item.href} className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
                      {t("dashboard.attention.open")} <ArrowUpRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
