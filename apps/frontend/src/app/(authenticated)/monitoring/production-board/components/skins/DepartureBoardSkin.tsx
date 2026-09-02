"use client";

/**
 * @file .../production-board/components/skins/DepartureBoardSkin.tsx
 * @description 스킨 B "출발 전광판" — 공항 출발보드 메타포. 앰버 모노스페이스,
 *              지시 목록 전체가 주인공, 상태는 깜빡이는 램프. (시안 DepartureBoard.dc.html 구현)
 */
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useNow, formatClock } from "@/components/monitoring/BoardClock";
import type { BoardSkinProps } from "../types";

const LAMP: Record<string, { color: string; blink: boolean }> = {
  RUNNING: { color: "#34d399", blink: true },
  HOLD: { color: "#ef4444", blink: true },
  DONE: { color: "#34d399", blink: false },
  WAITING: { color: "#6e5a18", blink: false },
};

export default function DepartureBoardSkin({ kpi, orders, pageItems, page, pageCount, updatedAt }: BoardSkinProps) {
  const { t } = useTranslation();
  const now = useNow();
  const clock = now ? formatClock(now) : null;

  const counts = useMemo(() => {
    const c: Record<string, number> = { RUNNING: 0, WAITING: 0, HOLD: 0, DONE: 0 };
    orders.forEach((o) => { c[o.status] = (c[o.status] ?? 0) + 1; });
    return c;
  }, [orders]);

  const statusLabel = (s: string) => t(`comCode.JOB_ORDER_STATUS.${s}`);

  return (
    <div className="w-full h-full flex flex-col overflow-hidden bg-[#0b0a07] text-[#fbbf24] font-mono"
      style={{ fontFamily: "'IBM Plex Mono', var(--font-sans), monospace" }}>
      <style>{`@keyframes db-lamp { 0%,100% { opacity: 1; } 50% { opacity: 0.3; } }`}</style>

      {/* 헤더 */}
      <div className="flex items-baseline justify-between px-12 pt-6 pb-4 bg-[#131108] border-b-4 border-[#fbbf24] flex-shrink-0">
        <div className="flex items-baseline gap-6">
          <span className="font-sans text-4xl font-black tracking-[0.35em]">{t("menu.monitoring.prodBoard")}</span>
          <span className="text-lg tracking-[0.3em] text-[#8a6d1c]">PRODUCTION DEPARTURES</span>
        </div>
        <div className="flex items-baseline gap-5">
          <span className="text-lg text-[#8a6d1c]">{clock?.date ?? ""}</span>
          <span className="text-5xl font-bold text-[#fde68a]" style={{ textShadow: "0 0 18px rgba(251,191,36,0.4)" }}>{clock?.hm ?? "--:--"}</span>
        </div>
      </div>

      {/* 컬럼 헤더 */}
      <div className="flex px-12 pt-4 pb-3 text-base tracking-[0.25em] text-[#8a6d1c] border-b border-[#2b2410] flex-shrink-0">
        <span className="w-[16%]">ORDER</span>
        <span className="font-sans flex-1">{t("monitoring.board.col.item")}</span>
        <span className="font-sans w-[9%]">{t("monitoring.board.col.process")}</span>
        <span className="font-sans w-[10%] text-right">{t("monitoring.board.col.plan")}</span>
        <span className="font-sans w-[10%] text-right">{t("monitoring.board.col.good")}</span>
        <span className="font-sans w-[10%] text-right">{t("monitoring.board.col.achieve")}</span>
        <span className="font-sans w-[13%] text-center">{t("monitoring.board.col.status")}</span>
      </div>

      {/* 보드 행 */}
      <div className="flex-1 flex flex-col px-12 min-h-0 justify-evenly">
        {pageItems.length === 0 ? (
          <div className="font-sans text-2xl text-[#8a6d1c] text-center">{t("monitoring.board.noOrders")}</div>
        ) : (
          pageItems.map((o) => {
            const active = o.status === "RUNNING" || o.status === "HOLD";
            const lamp = LAMP[o.status] ?? LAMP.WAITING;
            const fg = active ? "text-[#fbbf24]" : "text-[#8a6d1c]";
            const bright = active ? "text-[#fde68a]" : "text-[#8a6d1c]";
            return (
              <div key={o.orderNo}
                className={`flex items-center border-b border-[#1c1809] py-3 text-3xl ${o.status === "RUNNING" ? "bg-[#131108]" : ""}`}>
                <span className={`w-[16%] ${bright}`}>{o.orderNo}</span>
                <span className={`font-sans flex-1 font-bold truncate pr-4 ${fg}`}>{o.itemName ?? o.itemCode}</span>
                <span className={`font-sans w-[9%] ${active ? "text-[#b9922a]" : "text-[#6e5a18]"}`}>{o.processCode ?? "—"}</span>
                <span className={`w-[10%] text-right tabular-nums ${fg}`}>{o.planQty.toLocaleString()}</span>
                <span className={`w-[10%] text-right tabular-nums font-bold ${bright}`}>{o.goodQty.toLocaleString()}</span>
                <span className={`w-[10%] text-right tabular-nums font-bold ${o.status === "DONE" ? "text-[#34d399]" : fg}`}>
                  {o.goodQty > 0 || o.status !== "WAITING" ? `${o.achieveRate}%` : "—"}
                </span>
                <span className="w-[13%] flex items-center justify-center gap-3">
                  <span className="w-4 h-4 rounded-full" style={{
                    background: lamp.color,
                    boxShadow: lamp.blink ? `0 0 12px ${lamp.color}` : "none",
                    animation: lamp.blink ? `db-lamp ${o.status === "HOLD" ? 0.8 : 1.4}s infinite` : "none",
                  }} />
                  <span className={`font-sans text-2xl ${o.status === "HOLD" ? "text-[#ef4444]" : fg}`}>{statusLabel(o.status)}</span>
                </span>
              </div>
            );
          })
        )}
      </div>

      {/* 하단 합계 */}
      <div className="flex items-center bg-[#131108] border-t-4 border-[#fbbf24] px-12 py-4 gap-16 flex-shrink-0">
        <div className="flex items-baseline gap-4">
          <span className="font-sans text-lg tracking-[0.25em] text-[#8a6d1c]">{t("monitoring.board.kpi.planQty")}</span>
          <span className="text-5xl font-bold tabular-nums">{(kpi?.planQty ?? 0).toLocaleString()}</span>
        </div>
        <div className="flex items-baseline gap-4">
          <span className="font-sans text-lg tracking-[0.25em] text-[#8a6d1c]">{t("monitoring.board.kpi.goodQty")}</span>
          <span className="text-5xl font-bold tabular-nums text-[#fde68a]" style={{ textShadow: "0 0 18px rgba(251,191,36,0.35)" }}>{(kpi?.goodQty ?? 0).toLocaleString()}</span>
        </div>
        <div className="flex items-baseline gap-4">
          <span className="font-sans text-lg tracking-[0.25em] text-[#8a6d1c]">{t("monitoring.board.kpi.achieveRate")}</span>
          <span className="text-5xl font-bold tabular-nums text-[#fde68a]">{kpi?.achieveRate ?? 0}%</span>
        </div>
        <div className="flex items-baseline gap-4">
          <span className="font-sans text-lg tracking-[0.25em] text-[#8a6d1c]">{t("monitoring.board.kpi.defectQty")}</span>
          <span className="text-5xl font-bold tabular-nums text-[#ef4444]" style={{ textShadow: "0 0 16px rgba(239,68,68,0.4)" }}>{(kpi?.defectQty ?? 0).toLocaleString()}</span>
        </div>
        <div className="ml-auto flex flex-col items-end gap-1">
          <span className="font-sans text-lg text-[#8a6d1c]">
            {statusLabel("RUNNING")} {counts.RUNNING} · {statusLabel("WAITING")} {counts.WAITING} · {statusLabel("HOLD")} {counts.HOLD} · {statusLabel("DONE")} {counts.DONE}
          </span>
          <span className="text-xs text-[#6e5a18]">
            {t("monitoring.board.updatedAt")} {updatedAt}{pageCount > 1 ? ` · ${page + 1}/${pageCount}` : ""}
          </span>
        </div>
      </div>
    </div>
  );
}
