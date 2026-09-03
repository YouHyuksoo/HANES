"use client";

/**
 * @file src/app/(authenticated)/dashboard/components/BoardLayout.tsx
 * @description 형태 2 "전광판" — 공항 출발 전광판처럼 읽는 대시보드.
 *
 *   좌측  : 초대형 숫자 5개를 세로로 쌓는다(달성률·실적/계획·불량률·설비가동·조치필요). 멀리서도 읽힌다.
 *   중앙  : 작업지시 출발 전광판 — 진행중 지시가 맨 위, 한 줄 = 지시 하나, 진행 레일 20칸.
 *           ROWS_PER_PAGE 를 넘으면 ROLL_MS 마다 다음 페이지로 자동 순환한다(모니터링 보드와 같은 방식).
 *   하단  : 시간대별 실적 스카이라인.  우측 : 조치 필요 큐(드릴다운 그대로).
 */
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { DashboardLayoutProps } from "./layouts";
import type { ProductionBoardOrder } from "@/app/(authenticated)/monitoring/production-board/components/types";
import { Skyline } from "./RhythmStrip";
import AttentionQueue from "./AttentionQueue";

const ROWS_PER_PAGE = 10;
const ROLL_MS = 8_000;
const RAIL_CELLS = 20;

/** 전광판 정렬 — 지금 움직이는 것부터 */
const STATUS_ORDER: Record<string, number> = { RUNNING: 0, HOLD: 1, WAITING: 2, DONE: 3, CANCELED: 4 };
const STATUS_TONE: Record<string, string> = {
  RUNNING: "text-primary",
  HOLD: "text-warning",
  WAITING: "text-text-muted",
  DONE: "text-success",
  CANCELED: "text-text-muted",
};
const RAIL_TONE: Record<string, string> = { RUNNING: "bg-primary", HOLD: "bg-warning", DONE: "bg-success" };

function Hero({ label, value, unit, tone, delay }: { label: string; value: string; unit?: string; tone: string; delay: number }) {
  return (
    <div className="py-3 border-b border-border ds-rise" style={{ animationDelay: `${delay}ms` }}>
      <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-text-muted">{label}</div>
      <div className="flex items-baseline gap-2 mt-1">
        <span className={`text-5xl 2xl:text-6xl font-extrabold tabular-nums leading-none tracking-tight ${tone}`}>{value}</span>
        {unit && <span className="text-sm text-text-muted tabular-nums">{unit}</span>}
      </div>
    </div>
  );
}

function Rail({ rate, status }: { rate: number; status: string }) {
  const lit = Math.round((Math.min(100, Math.max(0, rate)) / 100) * RAIL_CELLS);
  const tone = RAIL_TONE[status] ?? "bg-text-muted";
  return (
    <div className="flex gap-[2px]" aria-hidden>
      {Array.from({ length: RAIL_CELLS }, (_, i) => (
        <span key={i} className={`h-2 flex-1 rounded-[1px] ${i < lit ? tone : "bg-border"}`} />
      ))}
    </div>
  );
}

function Departures({ orders }: { orders: ProductionBoardOrder[] }) {
  const { t } = useTranslation();
  const sorted = useMemo(
    () => [...orders].sort((a, b) => (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9)),
    [orders],
  );
  const pageCount = Math.max(1, Math.ceil(sorted.length / ROWS_PER_PAGE));
  const [page, setPage] = useState(0);

  useEffect(() => {
    if (pageCount <= 1) { setPage(0); return; }
    const id = window.setInterval(() => setPage((p) => (p + 1) % pageCount), ROLL_MS);
    return () => window.clearInterval(id);
  }, [pageCount]);

  const rows = sorted.slice(page * ROWS_PER_PAGE, page * ROWS_PER_PAGE + ROWS_PER_PAGE);
  const cols = "grid grid-cols-[32px_minmax(120px,1fr)_minmax(140px,1.4fr)_minmax(90px,0.8fr)_120px_minmax(120px,1fr)_88px] gap-x-4 items-center";

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <div className="flex items-center gap-3">
        <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted whitespace-nowrap">{t("dashboard.board.orders")}</span>
        <span className="h-px flex-1 bg-border" />
        <span className="font-mono text-[11px] text-text-muted tabular-nums">{t("dashboard.board.page", { page: page + 1, count: pageCount })}</span>
      </div>

      <div className={`${cols} mt-2 pb-1 border-b border-border text-[10px] font-semibold uppercase tracking-[0.16em] text-text-muted`}>
        <span>#</span>
        <span>{t("dashboard.board.orderNo")}</span>
        <span>{t("dashboard.board.item")}</span>
        <span>{t("dashboard.board.where")}</span>
        <span className="text-right">{t("dashboard.board.qty")}</span>
        <span>{t("dashboard.board.progress")}</span>
        <span className="text-right">{t("dashboard.board.status")}</span>
      </div>

      {rows.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-sm text-text-muted">{t("dashboard.board.noOrders")}</div>
      ) : (
        <ol key={page} className="flex-1 min-h-0 overflow-hidden divide-y divide-border/60">
          {rows.map((o, i) => (
            <li key={o.orderNo} className={`${cols} py-2 font-mono text-sm ds-rise`} style={{ animationDelay: `${i * 40}ms` }}>
              <span className="text-[11px] text-text-muted tabular-nums">{String(page * ROWS_PER_PAGE + i + 1).padStart(2, "0")}</span>
              <span className={`font-bold tracking-wide truncate ${o.status === "RUNNING" ? "text-text" : "text-text-muted"}`}>{o.orderNo}</span>
              <span className="font-sans text-text truncate">{o.itemName ?? o.itemCode}</span>
              <span className="text-[11px] text-text-muted truncate">{[o.processCode, o.equipCode].filter(Boolean).join(" · ") || "—"}</span>
              <span className="text-right tabular-nums whitespace-nowrap">
                <b className="text-text">{o.goodQty.toLocaleString()}</b><span className="text-text-muted"> / {o.planQty.toLocaleString()}</span>
              </span>
              <Rail rate={o.achieveRate} status={o.status} />
              <span className={`text-right text-xs font-bold uppercase tracking-wider whitespace-nowrap ${STATUS_TONE[o.status] ?? "text-text-muted"} ${o.status === "RUNNING" ? "ds-blink" : ""}`}>
                {t(`comCode.JOB_ORDER_STATUS.${o.status}`, { defaultValue: o.status })}
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

export default function BoardLayout({ data, attention, attentionCount, now }: DashboardLayoutProps) {
  const { t } = useTranslation();
  const { summary, production, quality } = data;
  const achieve = production?.kpi.achieveRate ?? 0;
  const defectRate = quality?.kpi.defectRate ?? 0;

  return (
    <div className="flex-1 min-h-0 grid grid-cols-[minmax(220px,0.8fr)_minmax(0,2.6fr)_minmax(280px,1fr)] gap-6 font-mono">
      {/* 좌측: 초대형 숫자 */}
      <div className="min-h-0 overflow-y-auto border-r border-border pr-6 flex flex-col justify-start">
        <Hero label={t("dashboard.pulse.achieve")} value={achieve.toFixed(1)} unit="%" tone="text-primary" delay={0} />
        <Hero
          label={t("dashboard.stream.productionHero")}
          value={(production?.kpi.goodQty ?? 0).toLocaleString()}
          unit={`/ ${(production?.kpi.planQty ?? 0).toLocaleString()}`}
          tone="text-text"
          delay={70}
        />
        <Hero label={t("dashboard.pulse.defectRate")} value={defectRate.toFixed(1)} unit="%" tone={defectRate >= 3 ? "text-error" : "text-text"} delay={140} />
        <Hero
          label={t("dashboard.board.equipRun")}
          value={String(summary?.equip.normal ?? 0)}
          unit={`/ ${summary?.equip.total ?? 0}`}
          tone={(summary?.equip.stop ?? 0) > 0 ? "text-error" : "text-text"}
          delay={210}
        />
        <Hero
          label={t("dashboard.pulse.attention")}
          value={String(attentionCount)}
          unit={t("dashboard.pulse.countUnit")}
          tone={attentionCount === 0 ? "text-success" : "text-warning"}
          delay={280}
        />
      </div>

      {/* 중앙: 출발 전광판 + 스카이라인 */}
      <div className="min-w-0 min-h-0 flex flex-col gap-5">
        <Departures orders={production?.orders ?? []} />
        <div className="flex-shrink-0 h-[150px] flex font-sans">
          <Skyline data={data} nowHour={now ? now.getHours() : null} />
        </div>
      </div>

      {/* 우측: 조치 큐 */}
      <aside className="min-h-0 border-l border-border pl-5 font-sans">
        <AttentionQueue items={attention} total={attentionCount} />
      </aside>
    </div>
  );
}
