"use client";

/**
 * @file .../production-board/components/skins/DataWallSkin.tsx
 * @description 스킨 C "데이터 월" — 다크 초대형 편집 타이포(신문 1면). 본색 초대형 숫자 +
 *              레드 포인트 하나, 비대칭 2단. 밝은 공장/반사 환경용. (시안 DataWall.dc.html 구현)
 */
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useNow, formatClock } from "@/components/monitoring/BoardClock";
import type { BoardSkinProps } from "../types";

const RED = "#f0402c";

export default function DataWallSkin({ kpi, orders, pageItems, page, pageCount, pageSize, updatedAt }: BoardSkinProps) {
  const { t } = useTranslation();
  const now = useNow();
  const clock = now ? formatClock(now) : null;

  const counts = useMemo(() => {
    const c: Record<string, number> = { RUNNING: 0, WAITING: 0, HOLD: 0, DONE: 0 };
    orders.forEach((o) => { c[o.status] = (c[o.status] ?? 0) + 1; });
    return c;
  }, [orders]);

  const rate = Math.round(kpi?.achieveRate ?? 0);
  const statusLabel = (s: string) => t(`comCode.JOB_ORDER_STATUS.${s}`);

  return (
    <div className="w-full h-full flex flex-col overflow-hidden bg-[#14120e] text-[#ece7da]">
      <style>{`
        @keyframes dw-sweep { from { width: 0; } to { width: ${Math.min(100, kpi?.achieveRate ?? 0)}%; } }
        @keyframes dw-blink { 0%,100% { opacity: 1; } 50% { opacity: 0.2; } }
        .dw-disp { font-family: 'Anton', var(--font-sans), sans-serif; font-variant-numeric: tabular-nums; }
      `}</style>

      {/* 마스트헤드 */}
      <div className="flex items-baseline justify-between px-12 pt-6 pb-3.5 border-b-[6px] border-[#ece7da] flex-shrink-0">
        <div className="flex items-baseline gap-6">
          <span className="text-4xl font-black">{t("menu.monitoring.prodBoard")}</span>
          <span className="inline-flex items-center gap-2.5">
            <span className="w-3 h-3 rounded-full" style={{ background: RED, animation: "dw-blink 1.6s infinite" }} />
            <span className="font-mono text-base tracking-[0.3em]" style={{ color: RED }}>LIVE</span>
          </span>
        </div>
        <div className="flex items-baseline gap-5">
          <span className="font-mono text-base text-[#8d887c]">{clock?.date ?? ""}</span>
          <span className="dw-disp text-5xl">{clock?.hm ?? "--:--"}</span>
        </div>
      </div>

      {/* 본문: 비대칭 2단 */}
      <div className="flex-1 flex min-h-0">
        {/* 좌: 압도적 달성률 */}
        <div className="w-[40%] border-r-2 border-[#ece7da] flex flex-col px-12 pt-6 pb-8">
          <div className="text-lg font-bold tracking-[0.3em] text-[#8d887c]">TODAY {t("monitoring.board.kpi.achieveRate")}</div>
          <div className="flex items-baseline -mt-2">
            <span className="dw-disp leading-none tracking-tight text-[19rem] 2xl:text-[23rem]">{rate}</span>
            <span className="dw-disp text-8xl" style={{ color: RED }}>%</span>
          </div>
          <div className="h-5 bg-[#2a2721] mt-2">
            <div className="h-full bg-[#ece7da]" style={{ animation: "dw-sweep 1.2s cubic-bezier(0.2,0.8,0.2,1) both" }} />
          </div>
          <div className="flex mt-8 border-t-2 border-[#ece7da]">
            <div className="flex-1 py-4 border-r border-[#3a352c]">
              <div className="text-sm tracking-[0.2em] text-[#8d887c]">{t("monitoring.board.kpi.planQty")}</div>
              <div className="dw-disp text-6xl">{(kpi?.planQty ?? 0).toLocaleString()}</div>
            </div>
            <div className="flex-1 py-4 pl-7 border-r border-[#3a352c]">
              <div className="text-sm tracking-[0.2em] text-[#8d887c]">{t("monitoring.board.kpi.goodQty")}</div>
              <div className="dw-disp text-6xl">{(kpi?.goodQty ?? 0).toLocaleString()}</div>
            </div>
            <div className="flex-1 py-4 pl-7">
              <div className="text-sm tracking-[0.2em]" style={{ color: RED }}>{t("monitoring.board.kpi.defectQty")}</div>
              <div className="dw-disp text-6xl" style={{ color: RED }}>{(kpi?.defectQty ?? 0).toLocaleString()}</div>
            </div>
          </div>
          <div className="mt-auto flex items-center gap-3.5 flex-wrap">
            <span className="bg-[#ece7da] text-[#14120e] text-lg font-bold px-4 py-1.5 tracking-[0.15em]">{statusLabel("RUNNING")} {counts.RUNNING}</span>
            <span className="border-2 border-[#ece7da] text-lg font-bold px-3.5 py-1 tracking-[0.15em]">{statusLabel("WAITING")} {counts.WAITING}</span>
            <span className="border-2 text-lg font-bold px-3.5 py-1 tracking-[0.15em]" style={{ borderColor: RED, color: RED }}>{statusLabel("HOLD")} {counts.HOLD}</span>
            <span className="border-2 border-[#8d887c] text-[#8d887c] text-lg font-bold px-3.5 py-1 tracking-[0.15em]">{statusLabel("DONE")} {counts.DONE}</span>
          </div>
        </div>

        {/* 우: 거대 행 리스트 */}
        <div className="flex-1 flex flex-col min-w-0 px-12 pt-6 pb-4">
          <div className="flex items-baseline justify-between mb-1">
            <span className="text-lg font-bold tracking-[0.3em] text-[#8d887c]">{t("monitoring.board.todayOrders")}</span>
            <span className="font-mono text-sm text-[#8d887c]">
              {t("monitoring.board.updatedAt")} {updatedAt}{pageCount > 1 ? ` · ${page + 1}/${pageCount}` : ""}
            </span>
          </div>

          <div className="flex-1 flex flex-col justify-evenly min-h-0">
            {pageItems.length === 0 ? (
              <div className="text-2xl text-[#8d887c] text-center">{t("monitoring.board.noOrders")}</div>
            ) : (
              pageItems.map((o, i) => {
                const rank = page * pageSize + i + 1;
                const dimmed = o.status === "DONE" || o.status === "WAITING";
                return (
                  <div key={o.orderNo}
                    className={`flex items-baseline gap-6 border-b border-[#3a352c] last:border-b-0 py-3.5 ${dimmed ? "text-[#8d887c]" : ""}`}>
                    <span className="dw-disp text-4xl w-14" style={{ color: dimmed ? undefined : RED }}>{String(rank).padStart(2, "0")}</span>
                    <div className="flex-1 min-w-0">
                      <div className={`text-4xl font-black leading-tight truncate ${o.status === "DONE" ? "line-through decoration-4" : ""}`}>
                        {o.itemName ?? o.itemCode}
                        {o.status === "HOLD" && (
                          <span className="align-middle text-xl font-bold text-[#14120e] px-3.5 py-1 ml-4 tracking-[0.1em]" style={{ background: RED }}>
                            {statusLabel("HOLD")}
                          </span>
                        )}
                      </div>
                      <div className="font-mono text-base mt-1 text-[#8d887c]">
                        {o.orderNo} · {o.processCode ?? "—"} · {statusLabel(o.status)}
                      </div>
                    </div>
                    <span className="dw-disp text-5xl">
                      {o.goodQty.toLocaleString()}<span className="text-2xl text-[#8d887c]">/{o.planQty.toLocaleString()}</span>
                    </span>
                    <span className="dw-disp text-5xl w-40 text-right" style={{ color: o.status === "HOLD" ? RED : undefined }}>
                      {o.goodQty > 0 || o.status !== "WAITING" ? <>{Math.round(o.achieveRate)}<span className="text-3xl">%</span></> : "—"}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
