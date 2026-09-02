"use client";

/**
 * @file .../quality-board/components/skins/ControlTowerSkin.tsx
 * @description 품질 스킨 A "관제탑" — 다크 네온. 초대형 불량률 + 불량유형 TOP 네온 바 +
 *              7일 추이 스카이라인 + 하단 공정별 흐르는 티커.
 */
import { useTranslation } from "react-i18next";
import { useNow, formatClock } from "@/components/monitoring/BoardClock";
import type { QualitySkinProps } from "../types";

export default function ControlTowerSkin({ kpi, byProcess, topDefects, repair, dailyTrend, updatedAt }: QualitySkinProps) {
  const { t } = useTranslation();
  const now = useNow();
  const clock = now ? formatClock(now) : null;

  const rate = kpi?.defectRate ?? 0;
  const rateInt = Math.floor(rate);
  const rateDec = (rate - rateInt).toFixed(1).slice(1);
  const good = rate === 0;
  const rateColor = good ? "#34d399" : "#ef4444";
  const maxDefect = Math.max(1, ...topDefects.map((d) => d.qty));
  const maxTrend = Math.max(0.1, ...dailyTrend.map((d) => d.defectRate));
  const ticker = byProcess.length > 0 ? [...byProcess, ...byProcess] : [];

  return (
    <div className="w-full h-full flex flex-col overflow-hidden text-[#e6edf7]"
      style={{ background: "radial-gradient(1200px 700px at 75% -10%, #0c1626 0%, #070b12 55%)" }}>
      <style>{`
        @keyframes qct-ticker { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
        @keyframes qct-pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.25; } }
        .qct-num { font-family: 'Rajdhani', var(--font-sans), sans-serif; font-variant-numeric: tabular-nums; }
      `}</style>

      {/* 헤더 */}
      <div className="flex items-center justify-between px-10 pt-5 pb-4 border-b border-[#16233a] flex-shrink-0">
        <div className="flex items-center gap-4">
          <span className="w-3.5 h-3.5 rounded-full bg-[#ef4444]" style={{ boxShadow: "0 0 14px #ef4444", animation: "qct-pulse 1.6s ease-in-out infinite" }} />
          <span className="text-3xl font-black tracking-[0.22em] text-[#f1f6ff]">{t("menu.monitoring.qualityBoard")}</span>
          <span className="qct-num text-xl font-semibold tracking-[0.3em] text-[#22d3ee]">LIVE</span>
        </div>
        <div className="flex items-baseline gap-5">
          <span className="text-lg tracking-[0.2em] text-[#6b7d99]">{clock?.date ?? ""}</span>
          <span className="qct-num text-5xl font-bold text-[#f1f6ff]" style={{ textShadow: "0 0 24px rgba(34,211,238,0.35)" }}>
            {clock?.hm ?? "--:--"}<span className="text-[#3d5170]">:{clock?.sec ?? "--"}</span>
          </span>
        </div>
      </div>

      {/* 본문 */}
      <div className="flex-1 flex min-h-0">
        {/* 좌: 초대형 불량률 + 수리 */}
        <div className="w-[34%] flex flex-col justify-center px-10 border-r border-[#16233a]">
          <div className="text-xl font-bold tracking-[0.28em] text-[#6b7d99]">TODAY {t("monitoring.board.quality.defectRate")}</div>
          <div className="flex items-baseline">
            <span className="qct-num font-bold leading-[0.9] text-[13rem] 2xl:text-[15rem]"
              style={{ color: rateColor, textShadow: `0 0 60px ${good ? "rgba(52,211,153,0.4)" : "rgba(239,68,68,0.45)"}` }}>{rateInt}</span>
            <span className="qct-num text-7xl font-semibold" style={{ color: rateColor }}>{rateDec}%</span>
          </div>
          <div className="flex gap-10 mt-8">
            <div>
              <div className="text-base tracking-[0.2em] text-[#6b7d99]">{t("monitoring.board.quality.totalQty")}</div>
              <div className="qct-num text-6xl font-bold">{(kpi?.totalQty ?? 0).toLocaleString()}</div>
            </div>
            <div>
              <div className="text-base tracking-[0.2em] text-[#6b7d99]">{t("monitoring.board.kpi.defectQty")}</div>
              <div className="qct-num text-6xl font-bold text-[#ef4444]" style={{ textShadow: "0 0 20px rgba(239,68,68,0.4)" }}>{(kpi?.defectQty ?? 0).toLocaleString()}</div>
            </div>
          </div>
          <div className="border-t border-[#16233a] mt-8 pt-6 flex gap-8">
            <div>
              <div className="text-sm tracking-[0.2em] text-[#6b7d99]">{t("monitoring.board.quality.repairReceived")}</div>
              <div className="qct-num text-5xl font-bold text-[#fbbf24]">{repair?.received ?? 0}</div>
            </div>
            <div>
              <div className="text-sm tracking-[0.2em] text-[#6b7d99]">{t("monitoring.board.quality.repairInRepair")}</div>
              <div className="qct-num text-5xl font-bold text-[#fbbf24]">{repair?.inRepair ?? 0}</div>
            </div>
            <div>
              <div className="text-sm tracking-[0.2em] text-[#6b7d99]">{t("monitoring.board.quality.repairCompletedToday")}</div>
              <div className="qct-num text-5xl font-bold text-[#22d3ee]">{repair?.completedToday ?? 0}</div>
            </div>
          </div>
        </div>

        {/* 우: TOP 불량 네온 바 + 7일 추이 */}
        <div className="flex-1 flex flex-col min-w-0 px-10 pt-6">
          <div className="text-sm tracking-[0.28em] text-[#6b7d99] mb-3">{t("monitoring.board.quality.topDefectsTitle")}</div>
          <div className="flex-[3] min-h-0 overflow-hidden">
            {topDefects.length === 0 ? (
              <div className="h-full flex items-center justify-center text-2xl text-[#3d5170]">{t("monitoring.board.noData")}</div>
            ) : (
              topDefects.slice(0, 5).map((d, i) => (
                <div key={d.defectCode} className="flex items-center gap-5 py-2.5">
                  <span className="qct-num text-3xl font-bold text-[#3d5170] w-9 text-right">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-3">
                      <span className="text-2xl font-bold text-[#f1f6ff] truncate">{d.defectName}</span>
                      <span className="font-mono text-sm text-[#6b7d99]">{d.defectCode}</span>
                      <span className="qct-num text-3xl font-bold text-[#ef4444] ml-auto">{d.qty.toLocaleString()}</span>
                    </div>
                    <div className="h-2 bg-[#101b2e] mt-1.5">
                      <div className="h-full" style={{
                        width: `${Math.max(3, (d.qty / maxDefect) * 100)}%`,
                        background: "linear-gradient(90deg,#7f1d1d,#ef4444)",
                        boxShadow: "0 0 14px rgba(239,68,68,0.5)",
                      }} />
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="flex-[2] flex flex-col justify-end min-h-0 pb-4 border-t border-[#16233a] pt-3">
            <div className="text-sm tracking-[0.28em] text-[#6b7d99] mb-2">{t("monitoring.board.quality.dailyTrendTitle")}</div>
            <div className="flex items-end gap-4 h-[110px]">
              {dailyTrend.map((d, i) => {
                const last = i === dailyTrend.length - 1;
                return (
                  <div key={d.date} className="flex-1 flex flex-col items-center justify-end h-full gap-1.5">
                    <span className={`qct-num text-lg font-bold ${last ? "text-[#ef4444]" : "text-[#6b7d99]"}`}>{d.defectRate}%</span>
                    <div className="w-full" style={{
                      height: `${Math.max(4, (d.defectRate / maxTrend) * 70)}%`,
                      background: last ? "linear-gradient(180deg,#ef4444,#7f1d1d)" : "linear-gradient(180deg,#334155,#1e293b)",
                      boxShadow: last ? "0 0 18px rgba(239,68,68,0.4)" : "none",
                    }} />
                    <span className="font-mono text-xs text-[#3d5170]">{d.date.slice(5)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* 하단 티커: 공정별 흐름 */}
      <div className="h-[76px] border-t border-[#16233a] flex items-center overflow-hidden bg-[#060910] flex-shrink-0">
        <div className="flex-shrink-0 px-6 h-full flex flex-col justify-center bg-[#0c1626] border-r border-[#16233a]">
          <span className="text-base font-bold tracking-[0.25em] text-[#6b7d99]">{t("monitoring.board.quality.byProcessTitle")}</span>
          <span className="font-mono text-[11px] text-[#3d5170]">{t("monitoring.board.updatedAt")} {updatedAt}</span>
        </div>
        <div className="flex-1 overflow-hidden">
          {ticker.length > 0 && (
            <div className="flex gap-16 w-max pl-10" style={{ animation: `qct-ticker ${Math.max(14, byProcess.length * 7)}s linear infinite` }}>
              {ticker.map((p, i) => (
                <span key={`${p.processCode}-${i}`} className="font-mono text-2xl whitespace-nowrap text-[#e6edf7]">
                  <span style={{ color: p.defectQty > 0 ? "#ef4444" : "#34d399" }}>● </span>
                  <span className="font-sans font-bold">{p.processCode}</span>{" "}
                  <b className="tabular-nums">{p.totalQty.toLocaleString()}</b>
                  <span style={{ color: p.defectQty > 0 ? "#ef4444" : "#34d399" }}> {p.defectQty > 0 ? `${t("monitoring.board.defect")} ${p.defectQty} (${p.defectRate}%)` : "0"}</span>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
