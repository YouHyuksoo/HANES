"use client";

/**
 * @file .../quality-board/components/skins/DepartureBoardSkin.tsx
 * @description 품질 스킨 B "출발 전광판" — 앰버 모노. 공정별 품질 행 + 상태 램프
 *              (불량 0 = 초록, 불량 있음 = 앰버, 불량률 5% 이상 = 빨강 깜빡).
 */
import { useTranslation } from "react-i18next";
import { useNow, formatClock } from "@/components/monitoring/BoardClock";
import type { QualitySkinProps, ProcessDefect } from "../types";

function lampFor(p: ProcessDefect) {
  if (p.defectRate >= 5) return { color: "#ef4444", blink: true };
  if (p.defectQty > 0) return { color: "#fbbf24", blink: true };
  return { color: "#34d399", blink: false };
}

export default function DepartureBoardSkin({ kpi, byProcessPageItems, page, pageCount, topDefects, repair, updatedAt }: QualitySkinProps) {
  const { t } = useTranslation();
  const now = useNow();
  const clock = now ? formatClock(now) : null;
  const topDefect = topDefects[0];

  return (
    <div className="w-full h-full flex flex-col overflow-hidden bg-[#0b0a07] text-[#fbbf24]"
      style={{ fontFamily: "'IBM Plex Mono', var(--font-sans), monospace" }}>
      <style>{`@keyframes qdb-lamp { 0%,100% { opacity: 1; } 50% { opacity: 0.3; } }`}</style>

      {/* 헤더 */}
      <div className="flex items-baseline justify-between px-12 pt-6 pb-4 bg-[#131108] border-b-4 border-[#fbbf24] flex-shrink-0">
        <div className="flex items-baseline gap-6">
          <span className="font-sans text-4xl font-black tracking-[0.35em]">{t("monitoring.board.quality.title")}</span>
          <span className="text-lg tracking-[0.3em] text-[#8a6d1c]">QUALITY DEPARTURES</span>
        </div>
        <div className="flex items-baseline gap-5">
          <span className="text-lg text-[#8a6d1c]">{clock?.date ?? ""}</span>
          <span className="text-5xl font-bold text-[#fde68a]" style={{ textShadow: "0 0 18px rgba(251,191,36,0.4)" }}>{clock?.hm ?? "--:--"}</span>
        </div>
      </div>

      {/* 컬럼 헤더 */}
      <div className="flex px-12 pt-4 pb-3 text-base tracking-[0.25em] text-[#8a6d1c] border-b border-[#2b2410] flex-shrink-0">
        <span className="font-sans flex-1">{t("monitoring.board.col.process")}</span>
        <span className="font-sans w-[16%] text-right">{t("monitoring.board.quality.totalQty")}</span>
        <span className="font-sans w-[16%] text-right">{t("monitoring.board.kpi.defectQty")}</span>
        <span className="font-sans w-[16%] text-right">{t("monitoring.board.quality.defectRate")}</span>
        <span className="font-sans w-[16%] text-center">{t("monitoring.board.col.status")}</span>
      </div>

      {/* 공정 행 */}
      <div className="flex-1 flex flex-col px-12 min-h-0 justify-evenly">
        {byProcessPageItems.length === 0 ? (
          <div className="font-sans text-2xl text-[#8a6d1c] text-center">{t("monitoring.board.noData")}</div>
        ) : (
          byProcessPageItems.map((p) => {
            const lamp = lampFor(p);
            const bad = p.defectQty > 0;
            return (
              <div key={p.processCode}
                className={`flex items-center border-b border-[#1c1809] py-3.5 text-3xl ${p.defectRate >= 5 ? "bg-[#1a0b08]" : ""}`}>
                <span className="font-sans flex-1 font-bold truncate pr-4 text-[#fbbf24]">{p.processCode}</span>
                <span className="w-[16%] text-right tabular-nums text-[#fde68a] font-bold">{p.totalQty.toLocaleString()}</span>
                <span className={`w-[16%] text-right tabular-nums font-bold ${bad ? "text-[#ef4444]" : "text-[#8a6d1c]"}`}>
                  {bad ? p.defectQty.toLocaleString() : "0"}
                </span>
                <span className={`w-[16%] text-right tabular-nums font-bold ${p.defectRate >= 5 ? "text-[#ef4444]" : bad ? "text-[#fbbf24]" : "text-[#34d399]"}`}>
                  {p.defectRate}%
                </span>
                <span className="w-[16%] flex items-center justify-center">
                  <span className="w-4 h-4 rounded-full" style={{
                    background: lamp.color,
                    boxShadow: lamp.blink ? `0 0 12px ${lamp.color}` : "none",
                    animation: lamp.blink ? `qdb-lamp ${p.defectRate >= 5 ? 0.8 : 1.4}s infinite` : "none",
                  }} />
                </span>
              </div>
            );
          })
        )}
      </div>

      {/* TOP 불량 1위 스트립 */}
      {topDefect && (
        <div className="flex items-center gap-6 px-12 py-3 border-t border-[#2b2410] flex-shrink-0">
          <span className="font-sans text-base tracking-[0.25em] text-[#8a6d1c]">{t("monitoring.board.quality.topDefectsTitle")}</span>
          <span className="font-sans text-2xl font-bold text-[#fde68a]">1. {topDefect.defectName}</span>
          <span className="text-lg text-[#8a6d1c]">{topDefect.defectCode}</span>
          <span className="text-3xl font-bold tabular-nums text-[#ef4444]">{topDefect.qty.toLocaleString()}</span>
          {topDefects[1] && (
            <span className="font-sans text-xl text-[#b9922a] ml-6">2. {topDefects[1].defectName} <b className="tabular-nums">{topDefects[1].qty.toLocaleString()}</b></span>
          )}
          {topDefects[2] && (
            <span className="font-sans text-xl text-[#8a6d1c] ml-4">3. {topDefects[2].defectName} <b className="tabular-nums">{topDefects[2].qty.toLocaleString()}</b></span>
          )}
        </div>
      )}

      {/* 하단 합계 */}
      <div className="flex items-center bg-[#131108] border-t-4 border-[#fbbf24] px-12 py-4 gap-14 flex-shrink-0">
        <div className="flex items-baseline gap-4">
          <span className="font-sans text-lg tracking-[0.25em] text-[#8a6d1c]">{t("monitoring.board.quality.totalQty")}</span>
          <span className="text-5xl font-bold tabular-nums">{(kpi?.totalQty ?? 0).toLocaleString()}</span>
        </div>
        <div className="flex items-baseline gap-4">
          <span className="font-sans text-lg tracking-[0.25em] text-[#8a6d1c]">{t("monitoring.board.kpi.defectQty")}</span>
          <span className="text-5xl font-bold tabular-nums text-[#ef4444]" style={{ textShadow: "0 0 16px rgba(239,68,68,0.4)" }}>{(kpi?.defectQty ?? 0).toLocaleString()}</span>
        </div>
        <div className="flex items-baseline gap-4">
          <span className="font-sans text-lg tracking-[0.25em] text-[#8a6d1c]">{t("monitoring.board.quality.defectRate")}</span>
          <span className="text-5xl font-bold tabular-nums text-[#fde68a]">{kpi?.defectRate ?? 0}%</span>
        </div>
        <div className="ml-auto flex flex-col items-end gap-1">
          <span className="font-sans text-lg text-[#8a6d1c]">
            {t("monitoring.board.quality.repairReceived")} {repair?.received ?? 0} · {t("monitoring.board.quality.repairInRepair")} {repair?.inRepair ?? 0} · {t("monitoring.board.quality.repairCompletedToday")} {repair?.completedToday ?? 0}
          </span>
          <span className="text-xs text-[#6e5a18]">
            {t("monitoring.board.updatedAt")} {updatedAt}{pageCount > 1 ? ` · ${page + 1}/${pageCount}` : ""}
          </span>
        </div>
      </div>
    </div>
  );
}
