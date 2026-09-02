"use client";

/**
 * @file .../inventory-board/components/skins/DepartureBoardSkin.tsx
 * @description 재고 스킨 B "출발 전광판" — 앰버 모노. 안전재고 미달 품목 행 + 상태 램프
 *              (재고 0 = 빨강 빠른 깜빡, 안전재고 50% 미만 = 빨강, 그 외 미달 = 앰버 깜빡).
 *              중간 스트립에 기한 문제 LOT TOP3, 하단에 KPI 합계.
 */
import { useTranslation } from "react-i18next";
import { useNow, formatClock } from "@/components/monitoring/BoardClock";
import { holdReasonKey, type InventorySkinProps, type ShortageItem } from "../types";

function lampFor(s: ShortageItem) {
  if (s.qty <= 0) return { color: "#ef4444", blink: true, speed: 0.8 };
  if (s.safetyStock > 0 && s.qty / s.safetyStock < 0.5) return { color: "#ef4444", blink: true, speed: 1.2 };
  return { color: "#fbbf24", blink: true, speed: 1.6 };
}

export default function DepartureBoardSkin({ kpi, shortagePageItems, page, pageCount, expiry, holds, updatedAt }: InventorySkinProps) {
  const { t } = useTranslation();
  const now = useNow();
  const clock = now ? formatClock(now) : null;
  const topExpiry = expiry.slice(0, 3);
  const topHold = holds[0];
  const topHoldReason = topHold ? holdReasonKey(topHold.reason) : null;

  return (
    <div className="w-full h-full flex flex-col overflow-hidden bg-[#0b0a07] text-[#fbbf24]"
      style={{ fontFamily: "'IBM Plex Mono', var(--font-sans), monospace" }}>
      <style>{`@keyframes idb-lamp { 0%,100% { opacity: 1; } 50% { opacity: 0.3; } }`}</style>

      {/* 헤더 */}
      <div className="flex items-baseline justify-between px-12 pt-6 pb-4 bg-[#131108] border-b-4 border-[#fbbf24] flex-shrink-0">
        <div className="flex items-baseline gap-6">
          <span className="font-sans text-4xl font-black tracking-[0.35em]">{t("monitoring.board.inventory.title")}</span>
          <span className="text-lg tracking-[0.3em] text-[#8a6d1c]">STOCK ALERTS</span>
        </div>
        <div className="flex items-baseline gap-5">
          <span className="text-lg text-[#8a6d1c]">{clock?.date ?? ""}</span>
          <span className="text-5xl font-bold text-[#fde68a]" style={{ textShadow: "0 0 18px rgba(251,191,36,0.4)" }}>{clock?.hm ?? "--:--"}</span>
        </div>
      </div>

      {/* 컬럼 헤더 */}
      <div className="flex px-12 pt-4 pb-3 text-base tracking-[0.25em] text-[#8a6d1c] border-b border-[#2b2410] flex-shrink-0">
        <span className="font-sans flex-1">{t("monitoring.board.inventory.shortageTitle")} · {t("monitoring.board.col.item")}</span>
        <span className="font-sans w-[16%] text-right">{t("monitoring.board.inventory.currentQty")}</span>
        <span className="font-sans w-[16%] text-right">{t("monitoring.board.inventory.safetyStock")}</span>
        <span className="font-sans w-[16%] text-right">{t("monitoring.board.inventory.shortageQty")}</span>
        <span className="font-sans w-[16%] text-center">{t("monitoring.board.col.status")}</span>
      </div>

      {/* 안전재고 미달 행 */}
      <div className="flex-1 flex flex-col px-12 min-h-0 justify-evenly">
        {shortagePageItems.length === 0 ? (
          <div className="font-sans text-3xl text-[#34d399] text-center">{t("monitoring.board.inventory.noShortage")}</div>
        ) : (
          shortagePageItems.map((s) => {
            const lamp = lampFor(s);
            const critical = lamp.color === "#ef4444";
            return (
              <div key={s.itemCode}
                className={`flex items-center border-b border-[#1c1809] py-3.5 text-3xl ${s.qty <= 0 ? "bg-[#1a0b08]" : ""}`}>
                <span className="flex-1 min-w-0 flex items-baseline gap-4 pr-4">
                  <span className="font-sans font-bold truncate text-[#fbbf24]">{s.itemName ?? s.itemCode}</span>
                  <span className="text-lg text-[#8a6d1c] shrink-0">{s.itemCode}</span>
                </span>
                <span className={`w-[16%] text-right tabular-nums font-bold ${s.qty <= 0 ? "text-[#ef4444]" : "text-[#fde68a]"}`}>{s.qty.toLocaleString()}</span>
                <span className="w-[16%] text-right tabular-nums text-[#8a6d1c]">{s.safetyStock.toLocaleString()}</span>
                <span className={`w-[16%] text-right tabular-nums font-bold ${critical ? "text-[#ef4444]" : "text-[#fbbf24]"}`}>
                  -{s.shortage.toLocaleString()}
                </span>
                <span className="w-[16%] flex items-center justify-center">
                  <span className="w-4 h-4 rounded-full" style={{
                    background: lamp.color,
                    boxShadow: `0 0 12px ${lamp.color}`,
                    animation: lamp.blink ? `idb-lamp ${lamp.speed}s infinite` : "none",
                  }} />
                </span>
              </div>
            );
          })
        )}
      </div>

      {/* 기한 문제 LOT TOP3 스트립 */}
      <div className="flex items-center gap-6 px-12 py-3 border-t border-[#2b2410] flex-shrink-0 overflow-hidden">
        <span className="font-sans text-base tracking-[0.25em] text-[#8a6d1c] shrink-0">{t("monitoring.board.inventory.expiryTitle")}</span>
        {topExpiry.length === 0 ? (
          <span className="font-sans text-xl text-[#34d399]">{t("monitoring.board.inventory.noExpiry")}</span>
        ) : (
          topExpiry.map((e, i) => {
            const expired = e.daysLeft < 0;
            return (
              <span key={e.matUid} className={`font-sans truncate ${i === 0 ? "text-2xl font-bold text-[#fde68a]" : "text-xl text-[#b9922a]"}`}>
                {i + 1}. {e.itemName ?? e.itemCode}{" "}
                <span className="text-base text-[#8a6d1c]">{e.matUid}</span>{" "}
                <b className={`tabular-nums ${expired ? "text-[#ef4444]" : "text-[#fbbf24]"}`}>
                  {expired
                    ? t("monitoring.board.inventory.expiredDays", { days: Math.abs(e.daysLeft) })
                    : t("monitoring.board.inventory.daysLeft", { days: e.daysLeft })}
                </b>
              </span>
            );
          })
        )}
        {topHold && (
          <span className="font-sans text-xl text-[#b9922a] truncate ml-auto shrink-0">
            <span className="text-base tracking-[0.25em] text-[#8a6d1c]">{t("monitoring.board.inventory.holdTitle")}</span>{" "}
            {topHold.itemName ?? topHold.itemCode}{" "}
            <b className="tabular-nums text-[#fde68a]">{topHold.qty.toLocaleString()}</b>{" "}
            <span className="text-[#ef4444]">{topHoldReason ? t(topHoldReason) : topHold.reason}</span>
          </span>
        )}
      </div>

      {/* 하단 합계 */}
      <div className="flex items-center bg-[#131108] border-t-4 border-[#fbbf24] px-12 py-4 gap-10 flex-shrink-0">
        {[
          { label: t("monitoring.board.inventory.shortageTitle"), n: kpi?.shortageCount ?? 0, warn: "text-[#ef4444]" },
          { label: t("monitoring.board.inventory.expired"), n: kpi?.expiredCount ?? 0, warn: "text-[#ef4444]" },
          { label: t("monitoring.board.inventory.nearExpiry"), n: kpi?.nearExpiryCount ?? 0, warn: "text-[#fde68a]" },
          { label: t("monitoring.board.inventory.hold"), n: kpi?.holdCount ?? 0, warn: "text-[#fde68a]" },
        ].map((k) => (
          <div key={k.label} className="flex items-baseline gap-3 shrink-0">
            <span className="font-sans text-base tracking-[0.2em] text-[#8a6d1c] whitespace-nowrap">{k.label}</span>
            <span className={`text-5xl font-bold tabular-nums ${k.n > 0 ? k.warn : "text-[#34d399]"}`}
              style={k.n > 0 && k.warn === "text-[#ef4444]" ? { textShadow: "0 0 16px rgba(239,68,68,0.4)" } : undefined}>
              {k.n}
            </span>
          </div>
        ))}
        <div className="ml-auto flex flex-col items-end gap-1 min-w-0">
          <span className="font-sans text-lg text-[#8a6d1c] whitespace-nowrap">
            {t("monitoring.board.inventory.todayInOut")} <b className="tabular-nums text-[#fde68a]">{kpi?.inCount ?? 0} / {kpi?.outCount ?? 0}</b>
          </span>
          <span className="text-xs text-[#6e5a18]">
            {t("monitoring.board.updatedAt")} {updatedAt}{pageCount > 1 ? ` · ${page + 1}/${pageCount}` : ""}
          </span>
        </div>
      </div>
    </div>
  );
}
