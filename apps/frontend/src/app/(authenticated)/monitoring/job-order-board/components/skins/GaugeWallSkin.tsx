"use client";

/**
 * @file .../job-order-board/components/skins/GaugeWallSkin.tsx
 * @description 스킨 C "게이지 월" — 공정마다 화면 폭 전체의 적층 게이지(실적 / 불량 / 잔량)가 곧 차트.
 *              게이지 안에 숫자를 인쇄하고, 아래에 그 공정의 지시를 한 줄씩(지시번호 · 품목코드 전체 · 실적/계획 · 불량) 나열한다.
 *              비율이 인사이트: 어느 공정이 얼마나 남았고 불량이 얼마나 먹었는지 한눈에. 3공정/페이지.
 */
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useRotation } from "@/components/monitoring";
import { ALERT, STATUS_COLOR, type JobOrderSkinProps } from "../types";
import { groupByProcess, type ProcessGroup } from "../metrics";
import { BG, BOARD_CSS, BoardFooter, BoardHeader, DIM, DONE, GOOD, INK, LINE, LINE_STRONG, MUTED, defectColor, fmt, rateColor } from "../parts";

const PER_PAGE = 3;
const ORDERS_SHOWN = 6;

export default function GaugeWallSkin({ kpi, orders, byStatus, rollingSec, paused, updatedAt }: JobOrderSkinProps) {
  const { t } = useTranslation();
  const groups = useMemo(() => groupByProcess(orders), [orders]);
  const { pageItems, page, pageCount } = useRotation(groups, PER_PAGE, rollingSec, paused);
  const n = Math.max(2, Math.min(PER_PAGE, pageItems.length));

  return (
    <div className="w-full h-full flex flex-col overflow-hidden" style={{ background: BG, color: INK }}>
      <style>{BOARD_CSS}</style>
      <BoardHeader kpi={kpi} byStatus={byStatus} tag="C · GAUGE WALL" />

      <div className="flex-1 min-h-0 flex flex-col px-10 overflow-hidden">
        {pageItems.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-3xl" style={{ color: MUTED }}>{t("monitoring.board.noOrders")}</div>
        ) : pageItems.map((g) => <Lane key={g.process} g={g} n={n} />)}
      </div>

      <BoardFooter updatedAt={updatedAt} page={page} pageCount={pageCount} />
    </div>
  );
}

function Lane({ g, n }: { g: ProcessGroup; n: number }) {
  const { t } = useTranslation();
  const { total: m } = g;
  const gPct = m.plan > 0 ? Math.min(100, (m.good / m.plan) * 100) : 0;
  const dPct = m.plan > 0 ? Math.min(100 - gPct, (m.defect / m.plan) * 100) : 0;
  const rPct = Math.max(0, 100 - gPct - dPct);
  const running = g.counts.RUNNING > 0;
  const shown = g.rows.slice(0, ORDERS_SHOWN);
  const sl = (s: string) => t(`comCode.JOB_ORDER_STATUS.${s}`, { defaultValue: s });

  return (
    <div className="min-h-0 flex flex-col py-4" style={{ flex: `0 0 calc(100% / ${n})`, borderBottom: `3px solid ${LINE_STRONG}` }}>
      {/* 공정 타이틀 줄 */}
      <div className="flex items-baseline gap-6 whitespace-nowrap flex-shrink-0">
        <span className="jb-num text-[52px] font-bold leading-none">{g.process}</span>
        <span className="flex items-baseline gap-4 text-[18px]" style={{ color: MUTED }}>
          {(["RUNNING", "HOLD", "WAITING", "DONE"] as const).filter((s) => g.counts[s] > 0).map((s) => (
            <span key={s}><b className="jb-num text-[28px]" style={{ color: STATUS_COLOR[s] }}>{g.counts[s]}</b> {sl(s)}</span>
          ))}
        </span>
        <span className="ml-auto jb-num text-[56px] font-bold leading-none" style={{ color: rateColor(m.achieveRate) }}>{m.achieveRate}%</span>
      </div>

      {/* 적층 게이지 — 실적 / 불량 / 잔량, 숫자는 안에 인쇄 */}
      <div className="flex w-full mt-3 flex-shrink-0" style={{ height: 64, background: "#141b28" }}>
        <Seg pct={gPct} bg={gPct >= 100 ? DONE : GOOD} fg="#041016" label={t("monitoring.board.col.good")} v={m.good} stripe={running} />
        <Seg pct={dPct} bg={ALERT} fg="#fff" label={t("monitoring.board.col.defect")} v={m.defect} />
        <Seg pct={rPct} bg="transparent" fg={MUTED} label={t("monitoring.board.jobOrder.remaining")} v={m.remaining} />
      </div>
      <div className="flex justify-between text-[16px] tracking-[0.15em] mt-1.5 flex-shrink-0" style={{ color: MUTED }}>
        <span>{t("monitoring.board.col.plan")} <b className="jb-num text-[22px]" style={{ color: INK }}>{fmt(m.plan)}</b></span>
        <span>{t("monitoring.board.jobOrder.defectRate")} <b className="jb-num text-[22px]" style={{ color: defectColor(m.defectRate) }}>{m.defectRate}%</b></span>
      </div>

      {/* 지시 목록 — 한 줄씩, 코드 전체 */}
      <div className="flex-1 min-h-0 mt-2 grid content-start" style={{ gridTemplateColumns: "1fr 1fr", columnGap: "3rem", rowGap: 4 }}>
        {shown.map((r) => (
          <div key={r.order.orderNo} className="flex items-baseline gap-4 whitespace-nowrap min-w-0 text-[22px]" style={{ borderLeft: `6px solid ${STATUS_COLOR[r.status]}`, paddingLeft: 12, opacity: r.status === "DONE" ? 0.55 : 1 }}>
            <span className="jb-code font-semibold">{r.order.orderNo}</span>
            <span className="jb-code" style={{ color: INK }}>{r.order.itemCode}</span>
            <span className="ml-auto jb-num text-[24px] font-bold"><span style={{ color: r.m.good > 0 ? GOOD : DIM }}>{fmt(r.m.good)}</span><span style={{ color: MUTED }}> / {fmt(r.m.plan)}</span></span>
            <span className="jb-num text-[22px] font-bold w-[4.5rem] text-right" style={{ color: defectColor(r.m.defectRate) }}>{r.m.defect > 0 ? fmt(r.m.defect) : "·"}</span>
          </div>
        ))}
        {g.rows.length > ORDERS_SHOWN && (
          <div className="text-[18px] tracking-[0.15em]" style={{ color: MUTED }}>{t("monitoring.board.jobOrder.more", { n: g.rows.length - ORDERS_SHOWN })}</div>
        )}
      </div>
    </div>
  );
}

function Seg({ pct, bg, fg, label, v, stripe = false }: { pct: number; bg: string; fg: string; label: string; v: number; stripe?: boolean }) {
  if (pct <= 0) return null;
  return (
    <div className="h-full flex items-center px-4 overflow-hidden whitespace-nowrap" style={{
      width: `${pct}%`, background: bg, color: fg, transition: "width .6s", borderRight: `2px solid ${LINE}`,
      backgroundImage: stripe ? "repeating-linear-gradient(90deg, transparent 0 18px, rgba(0,0,0,.18) 18px 36px)" : "none",
      animation: stripe ? "jb-scan 1.2s linear infinite" : "none",
    }}>
      {pct >= 9 && <span className="text-[15px] tracking-[0.25em] mr-3 opacity-80">{label}</span>}
      {pct >= 5 && <span className="jb-num text-[34px] font-bold leading-none">{fmt(v)}</span>}
    </div>
  );
}
