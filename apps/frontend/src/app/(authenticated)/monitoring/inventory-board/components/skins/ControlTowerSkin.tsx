"use client";

/**
 * @file .../inventory-board/components/skins/ControlTowerSkin.tsx
 * @description 재고 스킨 A "관제탑" — 다크 네온. 초대형 "조치 필요 건수"(0이면 초록 ALL CLEAR) +
 *              안전재고 미달 네온 게이지(현재고/안전재고 충족률) + 하단 기한·보류 LOT 흐르는 티커.
 */
import { useTranslation } from "react-i18next";
import { useNow, formatClock } from "@/components/monitoring/BoardClock";
import { actionTotal, holdReasonKey, type InventorySkinProps } from "../types";

const RED = "#ef4444";
const AMBER = "#fbbf24";
const GREEN = "#34d399";
const CYAN = "#22d3ee";

export default function ControlTowerSkin({ kpi, shortages, expiry, holds, updatedAt }: InventorySkinProps) {
  const { t } = useTranslation();
  const now = useNow();
  const clock = now ? formatClock(now) : null;

  const total = actionTotal(kpi);
  const clear = total === 0;
  const totalColor = clear ? GREEN : RED;
  const counterColor = (n: number, warn: string) => (n > 0 ? warn : GREEN);

  const tickerBase = [
    ...expiry.map((e) => ({
      key: `E:${e.matUid}`,
      color: e.daysLeft < 0 ? RED : AMBER,
      name: e.itemName ?? e.itemCode,
      ref: e.matUid,
      qty: e.qty,
      tag: e.daysLeft < 0
        ? t("monitoring.board.inventory.expiredDays", { days: Math.abs(e.daysLeft) })
        : t("monitoring.board.inventory.daysLeft", { days: e.daysLeft }),
    })),
    ...holds.map((h) => {
      const k = holdReasonKey(h.reason);
      return {
        key: `H:${h.kind}:${h.ref}:${h.reason}`,
        color: AMBER,
        name: h.itemName ?? h.itemCode,
        ref: h.ref,
        qty: h.qty,
        tag: k ? t(k) : h.reason,
      };
    }),
  ];
  const ticker = tickerBase.length > 0 ? [...tickerBase, ...tickerBase] : [];

  return (
    <div className="w-full h-full flex flex-col overflow-hidden text-[#e6edf7]"
      style={{ background: "radial-gradient(1200px 700px at 75% -10%, #0c1626 0%, #070b12 55%)" }}>
      <style>{`
        @keyframes ict-ticker { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
        @keyframes ict-pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.25; } }
        .ict-num { font-family: 'Rajdhani', var(--font-sans), sans-serif; font-variant-numeric: tabular-nums; }
      `}</style>

      {/* 헤더 */}
      <div className="flex items-center justify-between px-10 pt-5 pb-4 border-b border-[#16233a] flex-shrink-0">
        <div className="flex items-center gap-4">
          <span className="w-3.5 h-3.5 rounded-full" style={{ background: totalColor, boxShadow: `0 0 14px ${totalColor}`, animation: "ict-pulse 1.6s ease-in-out infinite" }} />
          <span className="text-3xl font-black tracking-[0.22em] text-[#f1f6ff]">{t("monitoring.board.inventory.title")}</span>
          <span className="ict-num text-xl font-semibold tracking-[0.3em]" style={{ color: CYAN }}>LIVE</span>
        </div>
        <div className="flex items-baseline gap-5">
          <span className="text-lg tracking-[0.2em] text-[#6b7d99]">{clock?.date ?? ""}</span>
          <span className="ict-num text-5xl font-bold text-[#f1f6ff]" style={{ textShadow: "0 0 24px rgba(34,211,238,0.35)" }}>
            {clock?.hm ?? "--:--"}<span className="text-[#3d5170]">:{clock?.sec ?? "--"}</span>
          </span>
        </div>
      </div>

      {/* 본문 */}
      <div className="flex-1 flex min-h-0">
        {/* 좌: 초대형 조치 필요 건수 + 4종 카운터 */}
        <div className="w-[34%] flex flex-col justify-center px-10 border-r border-[#16233a]">
          <div className="text-xl font-bold tracking-[0.28em] text-[#6b7d99]">ACTION REQUIRED</div>
          <div className="flex items-baseline gap-4">
            <span className="ict-num font-bold leading-[0.9] text-[13rem] 2xl:text-[15rem]"
              style={{ color: totalColor, textShadow: `0 0 60px ${clear ? "rgba(52,211,153,0.4)" : "rgba(239,68,68,0.45)"}` }}>{total}</span>
            {clear && <span className="ict-num text-4xl font-semibold tracking-[0.2em]" style={{ color: GREEN }}>ALL CLEAR</span>}
          </div>
          <div className="grid grid-cols-2 gap-x-8 gap-y-6 mt-8">
            <div>
              <div className="text-base tracking-[0.2em] text-[#6b7d99]">{t("monitoring.board.inventory.shortageTitle")}</div>
              <div className="ict-num text-6xl font-bold" style={{ color: counterColor(kpi?.shortageCount ?? 0, RED) }}>{kpi?.shortageCount ?? 0}</div>
            </div>
            <div>
              <div className="text-base tracking-[0.2em] text-[#6b7d99]">{t("monitoring.board.inventory.expired")}</div>
              <div className="ict-num text-6xl font-bold" style={{ color: counterColor(kpi?.expiredCount ?? 0, RED) }}>{kpi?.expiredCount ?? 0}</div>
            </div>
            <div>
              <div className="text-base tracking-[0.2em] text-[#6b7d99]">{t("monitoring.board.inventory.nearExpiry")}</div>
              <div className="ict-num text-6xl font-bold" style={{ color: counterColor(kpi?.nearExpiryCount ?? 0, AMBER) }}>{kpi?.nearExpiryCount ?? 0}</div>
            </div>
            <div>
              <div className="text-base tracking-[0.2em] text-[#6b7d99]">{t("monitoring.board.inventory.hold")}</div>
              <div className="ict-num text-6xl font-bold" style={{ color: counterColor(kpi?.holdCount ?? 0, AMBER) }}>{kpi?.holdCount ?? 0}</div>
            </div>
          </div>
          <div className="border-t border-[#16233a] mt-8 pt-6 flex items-baseline gap-6">
            <span className="text-sm tracking-[0.2em] text-[#6b7d99]">{t("monitoring.board.inventory.todayInOut")}</span>
            <span className="ict-num text-5xl font-bold" style={{ color: CYAN }}>{kpi?.inCount ?? 0}</span>
            <span className="text-2xl text-[#3d5170]">/</span>
            <span className="ict-num text-5xl font-bold text-[#f1f6ff]">{kpi?.outCount ?? 0}</span>
            <span className="text-sm text-[#3d5170]">{t("monitoring.board.inventory.todayInOutSub")}</span>
          </div>
        </div>

        {/* 우: 안전재고 미달 네온 게이지 */}
        <div className="flex-1 flex flex-col min-w-0 px-10 pt-6 pb-4">
          <div className="flex items-baseline justify-between mb-3">
            <span className="text-sm tracking-[0.28em] text-[#6b7d99]">{t("monitoring.board.inventory.shortageTitle")}</span>
            <span className="text-sm tracking-[0.2em] text-[#3d5170]">
              {t("monitoring.board.inventory.currentQty")} / {t("monitoring.board.inventory.safetyStock")}
            </span>
          </div>
          <div className="flex-1 min-h-0 overflow-hidden">
            {shortages.length === 0 ? (
              <div className="h-full flex items-center justify-center text-3xl" style={{ color: GREEN, textShadow: "0 0 20px rgba(52,211,153,0.4)" }}>
                {t("monitoring.board.inventory.noShortage")}
              </div>
            ) : (
              shortages.slice(0, 7).map((s, i) => {
                const ratio = s.safetyStock > 0 ? Math.min(1, s.qty / s.safetyStock) : 0;
                const critical = ratio < 0.5;
                const color = critical ? RED : AMBER;
                return (
                  <div key={s.itemCode} className="flex items-center gap-5 py-2">
                    <span className="ict-num text-3xl font-bold text-[#3d5170] w-9 text-right">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-3">
                        <span className="text-2xl font-bold text-[#f1f6ff] truncate">{s.itemName ?? s.itemCode}</span>
                        <span className="font-mono text-sm text-[#6b7d99]">{s.itemCode}</span>
                        <span className="ict-num text-2xl font-semibold text-[#e6edf7] ml-auto">
                          {s.qty.toLocaleString()}<span className="text-[#3d5170]"> / {s.safetyStock.toLocaleString()}</span>
                        </span>
                        <span className="ict-num text-3xl font-bold w-32 text-right" style={{ color, textShadow: `0 0 16px ${color}66` }}>
                          -{s.shortage.toLocaleString()}
                        </span>
                      </div>
                      <div className="h-2 bg-[#101b2e] mt-1.5">
                        <div className="h-full" style={{
                          width: `${Math.max(2, ratio * 100)}%`,
                          background: critical ? "linear-gradient(90deg,#7f1d1d,#ef4444)" : "linear-gradient(90deg,#78350f,#fbbf24)",
                          boxShadow: `0 0 14px ${color}80`,
                        }} />
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* 하단 티커: 기한 문제 LOT + 보류/불량 재고 */}
      <div className="h-[76px] border-t border-[#16233a] flex items-center overflow-hidden bg-[#060910] flex-shrink-0">
        <div className="flex-shrink-0 px-6 h-full flex flex-col justify-center bg-[#0c1626] border-r border-[#16233a]">
          <span className="text-base font-bold tracking-[0.25em] text-[#6b7d99]">{t("monitoring.board.inventory.expiryTitle")} · {t("monitoring.board.inventory.holdTitle")}</span>
          <span className="font-mono text-[11px] text-[#3d5170]">{t("monitoring.board.updatedAt")} {updatedAt}</span>
        </div>
        <div className="flex-1 overflow-hidden">
          {ticker.length === 0 ? (
            <div className="pl-10 text-2xl" style={{ color: GREEN }}>{t("monitoring.board.inventory.noExpiry")} · {t("monitoring.board.inventory.noHold")}</div>
          ) : (
            <div className="flex gap-16 w-max pl-10" style={{ animation: `ict-ticker ${Math.max(14, tickerBase.length * 7)}s linear infinite` }}>
              {ticker.map((x, i) => (
                <span key={`${x.key}-${i}`} className="font-mono text-2xl whitespace-nowrap text-[#e6edf7]">
                  <span style={{ color: x.color }}>● </span>
                  <span className="font-sans font-bold">{x.name}</span>{" "}
                  <span className="text-[#6b7d99] text-lg">{x.ref}</span>{" "}
                  <b className="tabular-nums">{x.qty.toLocaleString()}</b>
                  <span style={{ color: x.color }}> {x.tag}</span>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
