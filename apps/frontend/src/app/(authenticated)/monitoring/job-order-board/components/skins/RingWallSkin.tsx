"use client";

/**
 * @file .../job-order-board/components/skins/RingWallSkin.tsx
 * @description 작업지시 스킨 B "링 월" — 앰버 모노. 작업지시마다 큰 도넛 링(달성률)을 벽처럼 배열.
 *              진행중은 앰버 링이 숨쉬고, 홀딩은 레드 점선 링, 완료는 밝은 앰버로 꽉 찬 링, 대기는 흐린 링.
 *              한 페이지 최대 18개(6×3), rollingSec 간격 순환. 순서: 진행→홀딩→대기→완료.
 */
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useNow, formatClock } from "@/components/monitoring/BoardClock";
import { useRotation } from "@/components/monitoring";
import { asJobStatus, STATUS_ORDER, type JobOrderSkinProps, type JobStatus } from "../types";

const PER_PAGE = 18;
const COLS = 6;
const R = 44;
const C = 2 * Math.PI * R;

const AMBER = "#fbbf24";
const AMBER_LIGHT = "#fde68a";
const AMBER_DIM = "#8a6d1c";
const AMBER_DEEP = "#5b4a12";
const RED = "#ef4444";

/** 앰버 모노 상태색 — 레드는 홀딩에만 */
const RING: Record<JobStatus, string> = {
  RUNNING: AMBER,
  HOLD: RED,
  DONE: AMBER_LIGHT,
  WAITING: AMBER_DEEP,
};

export default function RingWallSkin({ kpi, orders, byStatus, rollingSec, paused, updatedAt }: JobOrderSkinProps) {
  const { t } = useTranslation();
  const now = useNow();
  const clock = now ? formatClock(now) : null;

  const sorted = useMemo(
    () => [...orders].sort((a, b) => (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9) || b.achieveRate - a.achieveRate),
    [orders],
  );
  const { pageItems, page, pageCount } = useRotation(sorted, PER_PAGE, rollingSec, paused);
  const statusLabel = (s: string) => t(`comCode.JOB_ORDER_STATUS.${s}`, { defaultValue: s });
  const rows = Math.max(1, Math.ceil(Math.min(PER_PAGE, Math.max(1, pageItems.length)) / COLS));

  return (
    <div className="w-full h-full flex flex-col overflow-hidden bg-[#0b0a07] text-[#fbbf24]"
      style={{ fontFamily: "'IBM Plex Mono', var(--font-sans), monospace" }}>
      <style>{`
        @keyframes jrw-breathe { 0%,100% { filter: drop-shadow(0 0 3px ${AMBER}); } 50% { filter: drop-shadow(0 0 14px ${AMBER}); } }
        @keyframes jrw-blink { 0%,100% { opacity: 1; } 50% { opacity: 0.35; } }
        @keyframes jrw-spin { to { stroke-dashoffset: -${C}; } }
      `}</style>

      {/* 헤더 */}
      <div className="flex items-baseline justify-between px-8 pt-4 pb-3 bg-[#131108] border-b-4 border-[#fbbf24] flex-shrink-0">
        <div className="flex items-baseline gap-5 min-w-0">
          <span className="font-sans text-3xl font-black tracking-[0.3em] whitespace-nowrap">{t("menu.monitoring.jobBoard")}</span>
          <span className="text-base tracking-[0.3em] whitespace-nowrap" style={{ color: AMBER_DIM }}>RING WALL</span>
          <span className="text-xs whitespace-nowrap hidden 2xl:inline" style={{ color: AMBER_DIM }}>
            {t("monitoring.board.kpi.total")} {orders.length} · {t("monitoring.board.updatedAt")} {updatedAt}{pageCount > 1 ? ` · ${page + 1}/${pageCount}` : ""}
          </span>
        </div>
        <div className="flex items-baseline gap-6 mr-72 shrink-0">
          {(["RUNNING", "HOLD", "WAITING", "DONE"] as const).map((s) => (
            <span key={s} className="flex items-baseline gap-2 whitespace-nowrap">
              <span className="w-2.5 h-2.5 rounded-full self-center" style={{ background: RING[s], boxShadow: byStatus[s].length > 0 ? `0 0 8px ${RING[s]}` : "none" }} />
              <span className="font-sans text-sm" style={{ color: AMBER_DIM }}>{statusLabel(s)}</span>
              <span className="text-2xl font-bold tabular-nums" style={{ color: byStatus[s].length > 0 ? RING[s] : AMBER_DEEP }}>{byStatus[s].length}</span>
            </span>
          ))}
          <span className="flex items-baseline gap-2 whitespace-nowrap border-l pl-6" style={{ borderColor: "#2b2410" }}>
            <span className="font-sans text-sm" style={{ color: AMBER_DIM }}>{t("monitoring.board.kpi.achieveRate")}</span>
            <span className="text-3xl font-bold tabular-nums" style={{ color: AMBER_LIGHT }}>{kpi?.achieveRate ?? 0}%</span>
          </span>
          <span className="text-4xl font-bold" style={{ color: AMBER_LIGHT, textShadow: "0 0 18px rgba(251,191,36,0.4)" }}>{clock?.hm ?? "--:--"}</span>
        </div>
      </div>

      {/* 링 벽 */}
      <div className="flex-1 min-h-0 p-4">
        {pageItems.length === 0 ? (
          <div className="h-full flex items-center justify-center font-sans text-2xl" style={{ color: AMBER_DIM }}>{t("monitoring.board.noOrders")}</div>
        ) : (
          <div className="h-full grid gap-3" style={{ gridTemplateColumns: `repeat(${COLS}, minmax(0, 1fr))`, gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))` }}>
            {pageItems.map((o) => {
              const st = asJobStatus(o.status);
              const color = RING[st];
              const rate = Math.min(100, Math.max(0, o.achieveRate));
              const offset = C * (1 - rate / 100);
              const dim = st === "WAITING";
              return (
                <div key={o.orderNo} className="min-w-0 min-h-0 flex items-center gap-3 px-2 border border-[#1c1809]"
                  style={{ background: st === "RUNNING" ? "rgba(251,191,36,0.04)" : "transparent", animation: st === "HOLD" ? "jrw-blink 1.6s infinite" : "none" }}>
                  <div className="relative h-[82%] aspect-square shrink-0">
                    <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                      <circle cx="50" cy="50" r={R} fill="none" stroke="#1c1809" strokeWidth="9" />
                      {st === "HOLD" ? (
                        <circle cx="50" cy="50" r={R} fill="none" stroke={color} strokeWidth="9" strokeDasharray="6 6" opacity="0.9" />
                      ) : (
                        <circle cx="50" cy="50" r={R} fill="none" stroke={color} strokeWidth="9" strokeLinecap="round"
                          strokeDasharray={C} strokeDashoffset={st === "DONE" ? 0 : offset}
                          opacity={dim ? 0.6 : 1}
                          style={{ transition: "stroke-dashoffset 0.6s", animation: st === "RUNNING" ? "jrw-breathe 2s ease-in-out infinite" : "none" }} />
                      )}
                      {st === "RUNNING" && rate < 100 && (
                        <circle cx="50" cy="50" r={R} fill="none" stroke={color} strokeWidth="2" strokeDasharray="2 18" opacity="0.5"
                          style={{ animation: "jrw-spin 6s linear infinite" }} />
                      )}
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="font-bold leading-none tabular-nums" style={{ fontSize: "clamp(18px, 2.6vw, 44px)", color: dim ? AMBER_DIM : color }}>
                        {dim ? "—" : `${o.achieveRate}%`}
                      </span>
                      <span className="font-sans text-[10px] tracking-[0.2em] mt-1" style={{ color: dim ? AMBER_DIM : color }}>{statusLabel(st)}</span>
                    </div>
                  </div>
                  <div className="flex-1 min-w-0 flex flex-col justify-center" style={{ opacity: dim ? 0.6 : 1 }}>
                    <div className="font-sans text-lg font-bold leading-tight line-clamp-2" style={{ color: AMBER_LIGHT }} title={o.itemName ?? o.itemCode}>{o.itemName ?? o.itemCode}</div>
                    <div className="text-[11px] truncate" style={{ color: AMBER_DIM }}>{o.orderNo}</div>
                    <div className="font-sans text-xs truncate" style={{ color: AMBER_DIM }}>{o.processCode ?? "—"}{o.equipCode ? ` · ${o.equipCode}` : ""}</div>
                    <div className="text-base tabular-nums mt-0.5" style={{ color: AMBER_DIM }}>
                      <span className="font-bold" style={{ color: AMBER_LIGHT }}>{o.goodQty.toLocaleString()}</span> / {o.planQty.toLocaleString()}
                      {o.defectQty > 0 && <span style={{ color: RED }}> · {t("monitoring.board.defect")} {o.defectQty}</span>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
