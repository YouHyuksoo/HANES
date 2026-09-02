"use client";

/**
 * @file .../job-order-board/components/skins/RingWallSkin.tsx
 * @description 작업지시 스킨 B "링 월" — 작업지시마다 큰 도넛 링(달성률)을 상태색으로 그려 벽처럼 배열.
 *              진행중은 링이 숨쉬고, 홀딩은 점선 링, 완료는 꽉 찬 링, 대기는 흐린 링.
 *              한 페이지 최대 18개(6×3), rollingSec 간격 순환. 순서: 진행→홀딩→대기→완료.
 */
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useNow, formatClock } from "@/components/monitoring/BoardClock";
import { useRotation } from "@/components/monitoring";
import { asJobStatus, STATUS_COLOR, STATUS_ORDER, type JobOrderSkinProps } from "../types";

const PER_PAGE = 18;
const COLS = 6;
const R = 44;
const C = 2 * Math.PI * R;

export default function RingWallSkin({ kpi, orders, byStatus, rollingSec, updatedAt }: JobOrderSkinProps) {
  const { t } = useTranslation();
  const now = useNow();
  const clock = now ? formatClock(now) : null;

  const sorted = useMemo(
    () => [...orders].sort((a, b) => (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9) || b.achieveRate - a.achieveRate),
    [orders],
  );
  const { pageItems, page, pageCount } = useRotation(sorted, PER_PAGE, rollingSec);
  const statusLabel = (s: string) => t(`comCode.JOB_ORDER_STATUS.${s}`, { defaultValue: s });
  const rows = Math.max(1, Math.ceil(Math.min(PER_PAGE, Math.max(1, pageItems.length)) / COLS));

  return (
    <div className="w-full h-full flex flex-col overflow-hidden bg-[#0b0f14] text-[#e6edf7]">
      <style>{`
        @keyframes jrw-breathe { 0%,100% { filter: drop-shadow(0 0 4px ${STATUS_COLOR.RUNNING}); } 50% { filter: drop-shadow(0 0 16px ${STATUS_COLOR.RUNNING}); } }
        @keyframes jrw-blink { 0%,100% { opacity: 1; } 50% { opacity: 0.35; } }
        @keyframes jrw-spin { to { stroke-dashoffset: -${C}; } }
        .jrw-num { font-family: 'Rajdhani', var(--font-sans), sans-serif; font-variant-numeric: tabular-nums; }
      `}</style>

      {/* 헤더 */}
      <div className="flex items-center justify-between px-8 py-3 border-b border-[#1c2530] flex-shrink-0">
        <div className="flex items-center gap-4 min-w-0 shrink">
          <span className="text-2xl font-black tracking-[0.2em] text-[#f1f6ff] whitespace-nowrap">{t("monitoring.board.jobOrder.title")}</span>
          <span className="jrw-num text-base font-semibold tracking-[0.3em] text-[#6b7d99] whitespace-nowrap">RING WALL</span>
          <span className="font-mono text-xs text-[#3d5170] ml-4 whitespace-nowrap hidden 2xl:inline">
            {t("monitoring.board.kpi.total")} {orders.length} · {t("monitoring.board.updatedAt")} {updatedAt}{pageCount > 1 ? ` · ${page + 1}/${pageCount}` : ""}
          </span>
        </div>
        <div className="flex items-center gap-6 mr-72 shrink-0">
          {(["RUNNING", "HOLD", "WAITING", "DONE"] as const).map((s) => (
            <span key={s} className="flex items-baseline gap-2 whitespace-nowrap">
              <span className="w-2.5 h-2.5 rounded-full self-center" style={{ background: STATUS_COLOR[s] }} />
              <span className="text-sm text-[#6b7d99]">{statusLabel(s)}</span>
              <span className="jrw-num text-2xl font-bold" style={{ color: STATUS_COLOR[s] }}>{byStatus[s].length}</span>
            </span>
          ))}
          <span className="flex items-baseline gap-2 whitespace-nowrap border-l border-[#1c2530] pl-6">
            <span className="text-sm text-[#6b7d99]">{t("monitoring.board.kpi.achieveRate")}</span>
            <span className="jrw-num text-3xl font-bold text-[#f1f6ff]">{kpi?.achieveRate ?? 0}%</span>
          </span>
          <span className="jrw-num text-3xl font-bold text-[#f1f6ff]">{clock?.hm ?? "--:--"}</span>
        </div>
      </div>

      {/* 링 벽 */}
      <div className="flex-1 min-h-0 p-4">
        {pageItems.length === 0 ? (
          <div className="h-full flex items-center justify-center text-2xl text-[#3d5170]">{t("monitoring.board.noOrders")}</div>
        ) : (
          <div className="h-full grid gap-3" style={{ gridTemplateColumns: `repeat(${COLS}, minmax(0, 1fr))`, gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))` }}>
            {pageItems.map((o) => {
              const st = asJobStatus(o.status);
              const color = STATUS_COLOR[st];
              const rate = Math.min(100, Math.max(0, o.achieveRate));
              const offset = C * (1 - rate / 100);
              return (
                <div key={o.orderNo} className="min-w-0 min-h-0 flex items-center gap-3 px-2 border border-[#151c26]"
                  style={{ background: st === "RUNNING" ? "rgba(34,211,238,0.04)" : "transparent", animation: st === "HOLD" ? "jrw-blink 1.6s infinite" : "none" }}>
                  <div className="relative h-[82%] aspect-square shrink-0">
                    <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                      <circle cx="50" cy="50" r={R} fill="none" stroke="#151c26" strokeWidth="9" />
                      {st === "HOLD" ? (
                        <circle cx="50" cy="50" r={R} fill="none" stroke={color} strokeWidth="9" strokeDasharray="6 6" opacity="0.9" />
                      ) : (
                        <circle cx="50" cy="50" r={R} fill="none" stroke={color} strokeWidth="9" strokeLinecap="round"
                          strokeDasharray={C} strokeDashoffset={st === "DONE" ? 0 : offset}
                          opacity={st === "WAITING" ? 0.35 : 1}
                          style={{ transition: "stroke-dashoffset 0.6s", animation: st === "RUNNING" ? "jrw-breathe 2s ease-in-out infinite" : "none" }} />
                      )}
                      {st === "RUNNING" && rate < 100 && (
                        <circle cx="50" cy="50" r={R} fill="none" stroke={color} strokeWidth="2" strokeDasharray="2 18" opacity="0.5"
                          style={{ animation: "jrw-spin 6s linear infinite" }} />
                      )}
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="jrw-num font-bold leading-none" style={{ fontSize: "clamp(18px, 2.6vw, 44px)", color: st === "WAITING" ? "#6b7d99" : color }}>
                        {st === "WAITING" ? "—" : `${o.achieveRate}%`}
                      </span>
                      <span className="text-[10px] tracking-[0.2em] mt-1" style={{ color: `${color}cc` }}>{statusLabel(st)}</span>
                    </div>
                  </div>
                  <div className="flex-1 min-w-0 flex flex-col justify-center">
                    <div className="text-lg font-bold leading-tight text-[#f1f6ff] line-clamp-2" title={o.itemName ?? o.itemCode}>{o.itemName ?? o.itemCode}</div>
                    <div className="font-mono text-[11px] text-[#6b7d99] truncate">{o.orderNo}</div>
                    <div className="text-xs text-[#6b7d99] truncate">{o.processCode ?? "—"}{o.equipCode ? ` · ${o.equipCode}` : ""}</div>
                    <div className="jrw-num text-base tabular-nums text-[#8fa3bf] mt-0.5">
                      <span className="text-[#f1f6ff] font-bold">{o.goodQty.toLocaleString()}</span> / {o.planQty.toLocaleString()}
                      {o.defectQty > 0 && <span className="text-[#ef4444]"> · {t("monitoring.board.defect")} {o.defectQty}</span>}
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
