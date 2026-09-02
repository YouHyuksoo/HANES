"use client";

/**
 * @file .../quality-board/components/skins/DataWallSkin.tsx
 * @description 품질 스킨 C "데이터 월" — 다크 편집(신문 1면 타이포). 초대형 불량률 + 불량유형 랭킹 +
 *              하단 7일 추이 미니 스트립. 레드 포인트 하나.
 */
import { useTranslation } from "react-i18next";
import { useNow, formatClock } from "@/components/monitoring/BoardClock";
import type { QualitySkinProps } from "../types";

const RED = "#f0402c";

export default function DataWallSkin({ kpi, topDefects, repair, dailyTrend, updatedAt }: QualitySkinProps) {
  const { t } = useTranslation();
  const now = useNow();
  const clock = now ? formatClock(now) : null;

  const rate = kpi?.defectRate ?? 0;
  const maxDefect = Math.max(1, ...topDefects.map((d) => d.qty));

  return (
    <div className="w-full h-full flex flex-col overflow-hidden bg-[#14120e] text-[#ece7da]">
      <style>{`
        @keyframes qdw-blink { 0%,100% { opacity: 1; } 50% { opacity: 0.2; } }
        .qdw-disp { font-family: 'Anton', var(--font-sans), sans-serif; font-variant-numeric: tabular-nums; }
      `}</style>

      {/* 마스트헤드 */}
      <div className="flex items-baseline justify-between px-12 pt-6 pb-3.5 border-b-[6px] border-[#ece7da] flex-shrink-0">
        <div className="flex items-baseline gap-6">
          <span className="text-4xl font-black">{t("menu.monitoring.qualityBoard")}</span>
          <span className="inline-flex items-center gap-2.5">
            <span className="w-3 h-3 rounded-full" style={{ background: RED, animation: "qdw-blink 1.6s infinite" }} />
            <span className="font-mono text-base tracking-[0.3em]" style={{ color: RED }}>LIVE</span>
          </span>
        </div>
        <div className="flex items-baseline gap-5">
          <span className="font-mono text-base text-[#8d887c]">{clock?.date ?? ""}</span>
          <span className="qdw-disp text-5xl">{clock?.hm ?? "--:--"}</span>
        </div>
      </div>

      {/* 본문 */}
      <div className="flex-1 flex min-h-0">
        {/* 좌: 초대형 불량률 */}
        <div className="w-[40%] border-r-2 border-[#ece7da] flex flex-col px-12 pt-6 pb-8">
          <div className="text-lg font-bold tracking-[0.3em] text-[#8d887c]">TODAY {t("monitoring.board.quality.defectRate")}</div>
          <div className="flex items-baseline -mt-2">
            <span className="qdw-disp leading-none tracking-tight text-[15rem] 2xl:text-[18rem]" style={{ color: rate > 0 ? RED : undefined }}>
              {rate % 1 === 0 ? rate : rate.toFixed(1)}
            </span>
            <span className="qdw-disp text-8xl" style={{ color: RED }}>%</span>
          </div>
          <div className="flex mt-8 border-t-2 border-[#ece7da]">
            <div className="flex-1 py-4 border-r border-[#3a352c]">
              <div className="text-sm tracking-[0.2em] text-[#8d887c]">{t("monitoring.board.quality.totalQty")}</div>
              <div className="qdw-disp text-6xl">{(kpi?.totalQty ?? 0).toLocaleString()}</div>
            </div>
            <div className="flex-1 py-4 pl-7">
              <div className="text-sm tracking-[0.2em]" style={{ color: RED }}>{t("monitoring.board.kpi.defectQty")}</div>
              <div className="qdw-disp text-6xl" style={{ color: RED }}>{(kpi?.defectQty ?? 0).toLocaleString()}</div>
            </div>
          </div>
          <div className="mt-auto flex items-center gap-3.5 flex-wrap">
            <span className="bg-[#ece7da] text-[#14120e] text-lg font-bold px-4 py-1.5 tracking-[0.1em]">
              {t("monitoring.board.quality.repairCompletedToday")} {repair?.completedToday ?? 0}
            </span>
            <span className="border-2 text-lg font-bold px-3.5 py-1 tracking-[0.1em]" style={{ borderColor: RED, color: RED }}>
              {t("monitoring.board.quality.repairReceived")} {repair?.received ?? 0}
            </span>
            <span className="border-2 border-[#ece7da] text-lg font-bold px-3.5 py-1 tracking-[0.1em]">
              {t("monitoring.board.quality.repairInRepair")} {repair?.inRepair ?? 0}
            </span>
          </div>
        </div>

        {/* 우: 불량유형 랭킹 */}
        <div className="flex-1 flex flex-col min-w-0 px-12 pt-6 pb-4">
          <div className="flex items-baseline justify-between mb-1">
            <span className="text-lg font-bold tracking-[0.3em] text-[#8d887c]">{t("monitoring.board.quality.topDefectsTitle")}</span>
            <span className="font-mono text-sm text-[#8d887c]">{t("monitoring.board.updatedAt")} {updatedAt}</span>
          </div>

          <div className="flex-1 flex flex-col justify-evenly min-h-0">
            {topDefects.length === 0 ? (
              <div className="text-2xl text-[#8d887c] text-center">{t("monitoring.board.noData")}</div>
            ) : (
              topDefects.slice(0, 6).map((d, i) => (
                <div key={d.defectCode} className="border-b border-[#3a352c] last:border-b-0 py-2.5">
                  <div className="flex items-baseline gap-6">
                    <span className="qdw-disp text-4xl w-14" style={{ color: RED }}>{String(i + 1).padStart(2, "0")}</span>
                    <span className="flex-1 min-w-0 text-3xl font-black leading-tight truncate">{d.defectName}</span>
                    <span className="font-mono text-base text-[#8d887c]">{d.defectCode}</span>
                    <span className="qdw-disp text-5xl w-36 text-right" style={{ color: RED }}>{d.qty.toLocaleString()}</span>
                  </div>
                  <div className="ml-20 mt-1.5 h-1.5 bg-[#2a2721]">
                    <div className="h-full" style={{ width: `${Math.max(2, (d.qty / maxDefect) * 100)}%`, background: RED }} />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* 하단: 7일 추이 스트립 */}
      <div className="flex items-stretch border-t-2 border-[#ece7da] flex-shrink-0">
        <div className="px-12 py-3 flex items-center border-r border-[#3a352c]">
          <span className="text-base font-bold tracking-[0.3em] text-[#8d887c] whitespace-nowrap">{t("monitoring.board.quality.dailyTrendTitle")}</span>
        </div>
        <div className="flex-1 flex divide-x divide-[#3a352c]">
          {dailyTrend.map((d, i) => {
            const last = i === dailyTrend.length - 1;
            return (
              <div key={d.date} className="flex-1 px-4 py-2.5 flex flex-col items-center justify-center">
                <span className="font-mono text-sm text-[#8d887c]">{d.date.slice(5)}</span>
                <span className="qdw-disp text-3xl leading-tight" style={{ color: last && d.defectRate > 0 ? RED : undefined }}>
                  {d.defectRate}%
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
