"use client";

/**
 * @file .../production-board/components/skins/ControlTowerSkin.tsx
 * @description 스킨 A "관제탑" — 다크 네온. 초대형 달성률 + NOW RUNNING 히어로 +
 *              LED 세그먼트 진행바 + 시간대 스카이라인 + 하단 흐르는 티커.
 *              어두운 현장 시인성 최우선. (디자인 시안 Main.dc.html 구현)
 */
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useRotation } from "@/components/monitoring";
import { useNow, formatClock } from "@/components/monitoring/BoardClock";
import type { BoardSkinProps, ProductionBoardOrder } from "../types";

const SEGMENTS = 18;

const STATUS_DOT: Record<string, string> = {
  RUNNING: "#22d3ee",
  DONE: "#34d399",
  WAITING: "#94a3b8",
  HOLD: "#fbbf24",
};

function TickerItem({ o, statusLabel }: { o: ProductionBoardOrder; statusLabel: string }) {
  const done = o.status === "DONE";
  return (
    <span className="font-mono text-2xl whitespace-nowrap text-[#e6edf7]">
      <span style={{ color: STATUS_DOT[o.status] ?? "#94a3b8" }}>● </span>
      {o.orderNo} <span className="font-sans font-bold">{o.itemName ?? o.itemCode}</span>{" "}
      <b className="tabular-nums">{o.goodQty.toLocaleString()}/{o.planQty.toLocaleString()}</b>{" "}
      <span style={{ color: STATUS_DOT[o.status] ?? "#94a3b8" }}>
        {done || o.status === "WAITING" || o.status === "HOLD" ? statusLabel : `${o.achieveRate}%`}
      </span>
    </span>
  );
}

export default function ControlTowerSkin({ kpi, orders, hourly, rollingSec, updatedAt }: BoardSkinProps) {
  const { t } = useTranslation();
  const now = useNow();
  const clock = now ? formatClock(now) : null;

  const running = useMemo(() => orders.filter((o) => o.status === "RUNNING"), [orders]);
  const { pageItems: heroSlice, page: heroIdx, pageCount: heroCount } = useRotation(running, 1, rollingSec);
  const hero = heroSlice[0] ?? orders[0] ?? null;

  const rate = kpi?.achieveRate ?? 0;
  const rateInt = Math.floor(rate);
  const rateDec = (rate - rateInt).toFixed(1).slice(1); // ".8"
  const litSegs = hero ? Math.round((Math.min(100, hero.achieveRate) / 100) * SEGMENTS) : 0;

  const skyline = useMemo(() => {
    const map = new Map(hourly.map((h) => [Number(h.hour), h.goodQty + h.defectQty]));
    const hours = Array.from({ length: 16 }, (_, i) => i + 6); // 06~21시
    const max = Math.max(1, ...hours.map((h) => map.get(h) ?? 0));
    let peak = -1;
    let peakQty = -1;
    hours.forEach((h) => {
      const q = map.get(h) ?? 0;
      if (q > peakQty) { peakQty = q; peak = h; }
    });
    return hours.map((h) => {
      const qty = map.get(h) ?? 0;
      return { hour: h, qty, pct: qty > 0 ? Math.max(6, (qty / max) * 100) : 3, isPeak: h === peak && qty > 0 };
    });
  }, [hourly]);

  const ticker = orders.length > 0 ? [...orders, ...orders] : [];
  const statusLabel = (s: string) => t(`comCode.JOB_ORDER_STATUS.${s}`);

  return (
    <div className="w-full h-full flex flex-col overflow-hidden text-[#e6edf7]"
      style={{ background: "radial-gradient(1200px 700px at 75% -10%, #0c1626 0%, #070b12 55%)" }}>
      <style>{`
        @keyframes ct-ticker { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
        @keyframes ct-pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.25; } }
        @keyframes ct-seg { 0%,100% { opacity: 1; } 50% { opacity: 0.55; } }
        .ct-num { font-family: 'Rajdhani', var(--font-sans), sans-serif; font-variant-numeric: tabular-nums; }
      `}</style>

      {/* 헤더 */}
      <div className="flex items-center justify-between px-10 pt-5 pb-4 border-b border-[#16233a] flex-shrink-0">
        <div className="flex items-center gap-4">
          <span className="w-3.5 h-3.5 rounded-full bg-[#ef4444]" style={{ boxShadow: "0 0 14px #ef4444", animation: "ct-pulse 1.6s ease-in-out infinite" }} />
          <span className="text-3xl font-black tracking-[0.22em] text-[#f1f6ff]">{t("menu.monitoring.prodBoard")}</span>
          <span className="ct-num text-xl font-semibold tracking-[0.3em] text-[#22d3ee]">LIVE</span>
        </div>
        <div className="flex items-baseline gap-5">
          <span className="text-lg tracking-[0.2em] text-[#6b7d99]">{clock?.date ?? ""}</span>
          <span className="ct-num text-5xl font-bold text-[#f1f6ff]" style={{ textShadow: "0 0 24px rgba(34,211,238,0.35)" }}>
            {clock?.hm ?? "--:--"}<span className="text-[#3d5170]">:{clock?.sec ?? "--"}</span>
          </span>
        </div>
      </div>

      {/* 본문 */}
      <div className="flex-1 flex min-h-0">
        {/* 좌: 초대형 달성률 */}
        <div className="w-[34%] flex flex-col justify-center px-10 border-r border-[#16233a]">
          <div className="text-xl font-bold tracking-[0.28em] text-[#6b7d99]">TODAY {t("monitoring.board.kpi.achieveRate")}</div>
          <div className="flex items-baseline">
            <span className="ct-num font-bold text-[#22d3ee] leading-[0.9] text-[15rem] 2xl:text-[17rem]" style={{ textShadow: "0 0 60px rgba(34,211,238,0.45)" }}>{rateInt}</span>
            <span className="ct-num text-7xl font-semibold text-[#22d3ee]">{rateDec}%</span>
          </div>
          <div className="h-2.5 bg-[#101b2e] mt-6 flex">
            <div style={{ width: `${Math.min(100, rate)}%`, background: "linear-gradient(90deg,#0ea5b7,#22d3ee)", boxShadow: "0 0 18px rgba(34,211,238,0.5)" }} />
          </div>
          <div className="flex gap-10 mt-10">
            <div>
              <div className="text-base tracking-[0.2em] text-[#6b7d99]">{t("monitoring.board.kpi.planQty")}</div>
              <div className="ct-num text-6xl font-bold">{(kpi?.planQty ?? 0).toLocaleString()}</div>
            </div>
            <div>
              <div className="text-base tracking-[0.2em] text-[#6b7d99]">{t("monitoring.board.kpi.goodQty")}</div>
              <div className="ct-num text-6xl font-bold text-[#22d3ee]">{(kpi?.goodQty ?? 0).toLocaleString()}</div>
            </div>
            <div>
              <div className="text-base tracking-[0.2em] text-[#6b7d99]">{t("monitoring.board.kpi.defectQty")}</div>
              <div className="ct-num text-6xl font-bold text-[#ef4444]" style={{ textShadow: "0 0 20px rgba(239,68,68,0.4)" }}>{(kpi?.defectQty ?? 0).toLocaleString()}</div>
            </div>
          </div>
        </div>

        {/* 우: NOW RUNNING 히어로 + 스카이라인 */}
        <div className="flex-1 flex flex-col min-w-0 px-10 pt-7">
          {hero ? (
            <>
              <div className="flex items-center gap-3.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#22d3ee]" style={{ boxShadow: "0 0 10px #22d3ee", animation: "ct-pulse 1.2s ease-in-out infinite" }} />
                <span className="text-lg font-bold tracking-[0.3em] text-[#22d3ee]">NOW RUNNING</span>
                <span className="font-mono text-base text-[#6b7d99]">
                  {hero.orderNo} · {hero.processCode ?? "—"}{hero.equipCode ? ` · ${hero.equipCode}` : ""}
                </span>
                {heroCount > 1 && <span className="ct-num text-base text-[#3d5170] ml-auto">{heroIdx + 1}/{heroCount}</span>}
              </div>
              <div className="text-6xl 2xl:text-7xl font-black leading-tight text-[#f1f6ff] mt-2 truncate">{hero.itemName ?? hero.itemCode}</div>
              <div className="flex items-baseline gap-6 mt-3">
                <span className="ct-num text-8xl 2xl:text-9xl font-bold text-[#f1f6ff]">{hero.goodQty.toLocaleString()}</span>
                <span className="ct-num text-4xl font-semibold text-[#3d5170]">/ {hero.planQty.toLocaleString()}</span>
                <span className="ct-num text-5xl font-bold text-[#fbbf24] ml-auto">{hero.achieveRate}%</span>
              </div>
              <div className="flex gap-1.5 mt-2.5">
                {Array.from({ length: SEGMENTS }, (_, i) => (
                  <div key={i} className="flex-1 h-6"
                    style={i < litSegs
                      ? { background: "#22d3ee", boxShadow: "0 0 10px rgba(34,211,238,0.6)", animation: `ct-seg 2s ${i * 0.08}s infinite` }
                      : { background: "#101b2e" }} />
                ))}
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-2xl text-[#6b7d99]">{t("monitoring.board.noOrders")}</div>
          )}

          {/* 시간대 스카이라인 */}
          <div className="flex-1 flex flex-col justify-end min-h-0 mt-6 pb-4">
            <div className="text-sm tracking-[0.28em] text-[#6b7d99] mb-3">{t("monitoring.board.hourlyTitle")}</div>
            <div className="flex items-end gap-3 h-[26%] min-h-[90px]">
              {skyline.map((b) => (
                <div key={b.hour} className="flex-1" style={{
                  height: `${b.pct}%`,
                  background: b.isPeak
                    ? "linear-gradient(180deg,#22d3ee,#0e7490)"
                    : b.qty > 0 ? "linear-gradient(180deg,#164e63,#0b2434)" : "#101b2e",
                  boxShadow: b.isPeak ? "0 0 22px rgba(34,211,238,0.45)" : "none",
                }} />
              ))}
            </div>
            <div className="flex gap-3 mt-2 font-mono text-xs text-[#3d5170]">
              {skyline.map((b) => <span key={b.hour} className="flex-1 text-center">{String(b.hour).padStart(2, "0")}</span>)}
            </div>
          </div>
        </div>
      </div>

      {/* 하단 티커 */}
      <div className="h-[76px] border-t border-[#16233a] flex items-center overflow-hidden bg-[#060910] flex-shrink-0">
        <div className="flex-shrink-0 px-6 h-full flex flex-col justify-center bg-[#0c1626] border-r border-[#16233a]">
          <span className="text-base font-bold tracking-[0.25em] text-[#6b7d99]">{t("monitoring.board.todayOrders")}</span>
          <span className="font-mono text-[11px] text-[#3d5170]">{t("monitoring.board.updatedAt")} {updatedAt}</span>
        </div>
        <div className="flex-1 overflow-hidden">
          {ticker.length > 0 && (
            <div className="flex gap-16 w-max pl-10" style={{ animation: `ct-ticker ${Math.max(14, orders.length * 6)}s linear infinite` }}>
              {ticker.map((o, i) => <TickerItem key={`${o.orderNo}-${i}`} o={o} statusLabel={statusLabel(o.status)} />)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
