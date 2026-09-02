"use client";

/**
 * @file .../job-order-board/components/skins/SwimlaneSkin.tsx
 * @description 작업지시 스킨 A "스윔레인" — 다크. 공정(processCode)마다 가로 레인을 두고
 *              작업지시를 계획수량에 비례한 폭의 칩으로 상태순(진행→홀딩→대기→완료) 배치.
 *              칩은 달성률만큼 채워진다. 레인 5개씩 rollingSec 간격 순환.
 */
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useNow, formatClock } from "@/components/monitoring/BoardClock";
import { useRotation } from "@/components/monitoring";
import { asJobStatus, STATUS_COLOR, STATUS_ORDER, type JobOrderSkinProps, type ProductionBoardOrder } from "../types";

const LANES_PER_PAGE = 5;

interface Lane { process: string; orders: ProductionBoardOrder[]; plan: number; good: number }

export default function SwimlaneSkin({ kpi, orders, byStatus, rollingSec, paused, updatedAt }: JobOrderSkinProps) {
  const { t } = useTranslation();
  const now = useNow();
  const clock = now ? formatClock(now) : null;

  const lanes = useMemo<Lane[]>(() => {
    const m = new Map<string, ProductionBoardOrder[]>();
    for (const o of orders) {
      const key = o.processCode ?? "—";
      if (!m.has(key)) m.set(key, []);
      m.get(key)!.push(o);
    }
    return [...m.entries()]
      .map(([process, list]) => ({
        process,
        orders: [...list].sort((a, b) => (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9)),
        plan: list.reduce((s, o) => s + o.planQty, 0),
        good: list.reduce((s, o) => s + o.goodQty, 0),
      }))
      .sort((a, b) => b.orders.filter((o) => o.status === "RUNNING").length - a.orders.filter((o) => o.status === "RUNNING").length || a.process.localeCompare(b.process));
  }, [orders]);

  const { pageItems, page, pageCount } = useRotation(lanes, LANES_PER_PAGE, rollingSec, paused);
  const maxPlan = Math.max(1, ...lanes.map((l) => l.plan));
  const statusLabel = (s: string) => t(`comCode.JOB_ORDER_STATUS.${s}`, { defaultValue: s });

  return (
    <div className="w-full h-full flex flex-col overflow-hidden text-[#e6edf7]"
      style={{ background: "radial-gradient(1200px 700px at 50% -20%, #0e1a2b 0%, #070b12 55%)" }}>
      <style>{`
        @keyframes jsl-pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.35; } }
        @keyframes jsl-stripe { 0% { background-position: 0 0; } 100% { background-position: 28px 0; } }
        .jsl-num { font-family: 'Rajdhani', var(--font-sans), sans-serif; font-variant-numeric: tabular-nums; }
      `}</style>

      {/* 헤더 */}
      <div className="flex items-center justify-between px-10 pt-5 pb-4 border-b border-[#16233a] flex-shrink-0">
        <div className="flex items-center gap-4">
          <span className="w-3.5 h-3.5 rounded-full" style={{ background: STATUS_COLOR.RUNNING, boxShadow: `0 0 14px ${STATUS_COLOR.RUNNING}`, animation: "jsl-pulse 1.6s infinite" }} />
          <span className="text-3xl font-black tracking-[0.22em] text-[#f1f6ff] whitespace-nowrap">{t("menu.monitoring.jobBoard")}</span>
          <span className="jsl-num text-xl font-semibold tracking-[0.3em] text-[#22d3ee] whitespace-nowrap">SWIMLANE</span>
        </div>
        <div className="flex items-center gap-8 mr-72">
          {(["RUNNING", "HOLD", "WAITING", "DONE"] as const).map((s) => (
            <span key={s} className="flex items-baseline gap-2 whitespace-nowrap">
              <span className="w-3 h-3 self-center" style={{ background: STATUS_COLOR[s] }} />
              <span className="text-base text-[#6b7d99]">{statusLabel(s)}</span>
              <span className="jsl-num text-3xl font-bold" style={{ color: STATUS_COLOR[s] }}>{byStatus[s].length}</span>
            </span>
          ))}
          <span className="jsl-num text-4xl font-bold text-[#f1f6ff]">{clock?.hm ?? "--:--"}</span>
        </div>
      </div>

      {/* 레인 */}
      <div className="flex-1 min-h-0 flex flex-col px-10 py-3">
        {pageItems.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-2xl text-[#3d5170]">{t("monitoring.board.noOrders")}</div>
        ) : (
          pageItems.map((lane) => {
            const laneRate = lane.plan > 0 ? Math.round((lane.good / lane.plan) * 100) : 0;
            return (
              <div key={lane.process} className="flex items-stretch border-b border-[#16233a] min-h-0" style={{ flex: `0 0 calc(100% / ${Math.max(3, Math.min(LANES_PER_PAGE, pageItems.length))})` }}>
                {/* 레인 라벨 */}
                <div className="w-52 shrink-0 pr-5 flex flex-col justify-center border-r-2 border-[#16233a]">
                  <div className="text-xs tracking-[0.25em] text-[#6b7d99]">{t("monitoring.board.col.process")}</div>
                  <div className="jsl-num text-3xl font-bold text-[#f1f6ff] truncate" title={lane.process}>{lane.process}</div>
                  <div className="jsl-num text-lg text-[#6b7d99] tabular-nums">
                    <span className="text-[#e6edf7]">{lane.good.toLocaleString()}</span> / {lane.plan.toLocaleString()}
                    <span className="ml-2 font-bold" style={{ color: laneRate >= 100 ? STATUS_COLOR.DONE : STATUS_COLOR.RUNNING }}>{laneRate}%</span>
                  </div>
                </div>

                {/* 칩 트랙 — 전체 폭 = 최대 레인 계획수량 기준 */}
                <div className="flex-1 min-w-0 flex items-center pl-5 py-2">
                  <div className="flex gap-1.5 h-[72%] max-h-[92px]" style={{ width: `${Math.max(8, (lane.plan / maxPlan) * 100)}%` }}>
                    {lane.orders.map((o) => {
                      const st = asJobStatus(o.status);
                      const color = STATUS_COLOR[st];
                      const share = lane.plan > 0 ? o.planQty / lane.plan : 1 / lane.orders.length;
                      const rate = Math.min(100, o.achieveRate);
                      return (
                        <div key={o.orderNo} className="relative min-w-0 overflow-hidden border"
                          style={{
                            flex: `${Math.max(share, 0.04)} 1 0`,
                            borderColor: `${color}${st === "WAITING" ? "55" : "cc"}`,
                            background: st === "HOLD"
                              ? "repeating-linear-gradient(45deg, rgba(251,191,36,0.18) 0 10px, rgba(251,191,36,0.05) 10px 20px)"
                              : `${color}14`,
                            animation: st === "HOLD" ? "jsl-pulse 1.4s infinite" : "none",
                          }}
                          title={`${o.orderNo} ${o.itemName ?? o.itemCode} ${o.goodQty}/${o.planQty}`}>
                          {st !== "HOLD" && (
                            <div className="absolute inset-y-0 left-0" style={{
                              width: `${rate}%`,
                              background: st === "RUNNING"
                                ? `repeating-linear-gradient(90deg, ${color}66 0 14px, ${color}99 14px 28px)`
                                : `${color}55`,
                              animation: st === "RUNNING" ? "jsl-stripe 1s linear infinite" : "none",
                            }} />
                          )}
                          <div className="relative h-full flex flex-col justify-center px-2.5 min-w-0">
                            <div className="flex items-baseline gap-2 min-w-0">
                              <span className="jsl-num text-2xl font-bold leading-none truncate text-[#f1f6ff]">{o.itemName ?? o.itemCode}</span>
                              <span className="jsl-num text-2xl font-bold leading-none ml-auto shrink-0" style={{ color }}>{o.achieveRate}%</span>
                            </div>
                            <div className="flex items-baseline gap-2 min-w-0 mt-1">
                              <span className="font-mono text-xs text-[#8fa3bf] truncate">{o.orderNo}</span>
                              <span className="jsl-num text-sm tabular-nums text-[#8fa3bf] ml-auto shrink-0 whitespace-nowrap">
                                <span className="text-[#e6edf7]">{o.goodQty.toLocaleString()}</span>/{o.planQty.toLocaleString()}
                                {o.defectQty > 0 && <span className="text-[#ef4444]"> ·{o.defectQty}</span>}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* 하단 요약 */}
      <div className="h-[64px] border-t border-[#16233a] bg-[#060910] flex items-center px-10 gap-10 flex-shrink-0">
        <span className="text-sm tracking-[0.25em] text-[#6b7d99]">TODAY</span>
        <span className="flex items-baseline gap-2">
          <span className="text-base text-[#6b7d99]">{t("monitoring.board.kpi.planQty")}</span>
          <span className="jsl-num text-3xl font-bold text-[#f1f6ff]">{(kpi?.planQty ?? 0).toLocaleString()}</span>
        </span>
        <span className="flex items-baseline gap-2">
          <span className="text-base text-[#6b7d99]">{t("monitoring.board.kpi.goodQty")}</span>
          <span className="jsl-num text-3xl font-bold" style={{ color: STATUS_COLOR.DONE }}>{(kpi?.goodQty ?? 0).toLocaleString()}</span>
        </span>
        <span className="flex items-baseline gap-2">
          <span className="text-base text-[#6b7d99]">{t("monitoring.board.kpi.defectQty")}</span>
          <span className="jsl-num text-3xl font-bold" style={{ color: (kpi?.defectQty ?? 0) > 0 ? "#ef4444" : "#3d5170" }}>{(kpi?.defectQty ?? 0).toLocaleString()}</span>
        </span>
        <span className="flex items-baseline gap-2">
          <span className="text-base text-[#6b7d99]">{t("monitoring.board.kpi.achieveRate")}</span>
          <span className="jsl-num text-3xl font-bold" style={{ color: STATUS_COLOR.RUNNING }}>{kpi?.achieveRate ?? 0}%</span>
        </span>
        <span className="ml-auto font-mono text-xs text-[#3d5170]">
          {t("monitoring.board.updatedAt")} {updatedAt}{pageCount > 1 ? ` · ${page + 1}/${pageCount}` : ""}
        </span>
      </div>
    </div>
  );
}
