"use client";

/**
 * @file .../job-order-board/components/skins/FunnelSkin.tsx
 * @description 작업지시 스킨 C "퍼널" — 다크 편집. 대기→진행중→홀딩→완료 4단계를 가로 깔때기로 두고
 *              단계 폭(띠 두께)=계획수량 합, 단계 안에 건수·수량, 아래에 단계별 상위 지시 4건.
 *              순환 없음. 레드 포인트는 홀딩·불량에만.
 */
import { useTranslation } from "react-i18next";
import { useNow, formatClock } from "@/components/monitoring/BoardClock";
import { JOB_STATUSES, type JobOrderSkinProps, type JobStatus, type ProductionBoardOrder } from "../types";

const RED = "#f0402c";
const INK = "#ece7da";
const TOP_N = 4;

const STAGE_FILL: Record<JobStatus, string> = {
  WAITING: "#3a352c",
  RUNNING: INK,
  HOLD: RED,
  DONE: "#a39d8e",
};

export default function FunnelSkin({ kpi, orders, byStatus, updatedAt }: JobOrderSkinProps) {
  const { t } = useTranslation();
  const now = useNow();
  const clock = now ? formatClock(now) : null;
  const statusLabel = (s: string) => t(`comCode.JOB_ORDER_STATUS.${s}`, { defaultValue: s });

  const planOf = (list: ProductionBoardOrder[]) => list.reduce((s, o) => s + o.planQty, 0);
  const goodOf = (list: ProductionBoardOrder[]) => list.reduce((s, o) => s + o.goodQty, 0);
  const maxPlan = Math.max(1, ...JOB_STATUSES.map((s) => planOf(byStatus[s])));
  const holdCount = byStatus.HOLD.length;

  return (
    <div className="w-full h-full flex flex-col overflow-hidden bg-[#14120e] text-[#ece7da]">
      <style>{`
        @keyframes jfn-blink { 0%,100% { opacity: 1; } 50% { opacity: 0.2; } }
        .jfn-disp { font-family: 'Anton', var(--font-sans), sans-serif; font-variant-numeric: tabular-nums; }
      `}</style>

      {/* 마스트헤드 */}
      <div className="flex items-end justify-between px-12 pt-6 pb-3.5 border-b-[6px] border-[#ece7da] flex-shrink-0">
        <div className="flex items-baseline gap-6">
          <span className="text-4xl font-black">{t("menu.monitoring.jobBoard")}</span>
          <span className="inline-flex items-center gap-2.5">
            <span className="w-3 h-3 rounded-full" style={{ background: RED, animation: "jfn-blink 1.6s infinite" }} />
            <span className="font-mono text-base tracking-[0.3em]" style={{ color: RED }}>FUNNEL</span>
          </span>
        </div>
        <div className="flex items-end gap-10 mr-72">
          <div className="text-right">
            <div className="text-xs tracking-[0.3em] text-[#8d887c]">{t("monitoring.board.kpi.total")} {orders.length} · {t("monitoring.board.kpi.achieveRate")}</div>
            <div className="jfn-disp text-6xl leading-none" style={{ color: (kpi?.achieveRate ?? 0) >= 100 ? RED : undefined }}>{kpi?.achieveRate ?? 0}%</div>
          </div>
          <div className="flex items-baseline gap-5">
            <span className="font-mono text-base text-[#8d887c]">{clock?.date ?? ""}</span>
            <span className="jfn-disp text-5xl">{clock?.hm ?? "--:--"}</span>
          </div>
        </div>
      </div>

      {/* 퍼널 띠 */}
      <div className="flex-shrink-0 px-12 pt-6 pb-4 flex items-end gap-0 h-[36%] min-h-[220px]">
        {JOB_STATUSES.map((s, i) => {
          const list = byStatus[s];
          const plan = planOf(list);
          const good = goodOf(list);
          const h = Math.max(14, (plan / maxPlan) * 100);
          const fill = STAGE_FILL[s];
          const light = s === "WAITING";
          const rate = plan > 0 ? Math.round((good / plan) * 100) : 0;
          return (
            <div key={s} className="flex-1 min-w-0 h-full flex flex-col justify-end relative">
              {/* 단계 라벨 */}
              <div className="absolute top-0 left-0 right-0 flex items-baseline justify-between pr-6">
                <span className="text-lg font-black tracking-[0.15em]" style={{ color: s === "HOLD" ? RED : undefined }}>
                  {String(i + 1).padStart(2, "0")} {statusLabel(s)}
                </span>
                <span className="jfn-disp text-6xl leading-none" style={{ color: s === "HOLD" && holdCount > 0 ? RED : list.length === 0 ? "#3a352c" : undefined }}>
                  {list.length}
                </span>
              </div>
              {/* 띠 — 폭은 계획수량 합에 비례한 높이, 연결은 clip-path 사다리꼴 */}
              <div className="relative w-full" style={{ height: `${h}%`, marginTop: 72 }}>
                <div className="absolute inset-0" style={{
                  background: fill,
                  clipPath: i === JOB_STATUSES.length - 1 ? "polygon(0 0, 100% 0, 100% 100%, 0 100%)" : "polygon(0 0, 100% 0, 100% 100%, 0 100%)",
                  animation: s === "HOLD" && holdCount > 0 ? "jfn-blink 1.4s infinite" : "none",
                  opacity: s === "HOLD" && holdCount === 0 ? 0.25 : 1,
                }} />
                {/* 실적 채움 */}
                {s !== "HOLD" && s !== "WAITING" && (
                  <div className="absolute left-0 bottom-0 top-0 bg-[#14120e]/20" style={{ width: `${Math.min(100, rate)}%` }} />
                )}
                <div className="absolute inset-0 flex flex-col justify-center px-5 min-w-0" style={{ color: light ? INK : "#14120e" }}>
                  <div className="jfn-disp leading-none truncate" style={{ fontSize: h > 45 ? 40 : 24 }}>
                    {good.toLocaleString()} <span className="opacity-60 text-[0.6em]">/ {plan.toLocaleString()}</span>
                  </div>
                  {h > 30 && <div className="text-xs tracking-[0.2em] opacity-70 mt-1">{t("monitoring.board.kpi.goodQty")} / {t("monitoring.board.kpi.planQty")} · {rate}%</div>}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* 단계별 상위 지시 */}
      <div className="flex-1 min-h-0 flex divide-x-2 divide-[#ece7da] border-t-2 border-[#ece7da] px-12">
        {JOB_STATUSES.map((s) => {
          const list = [...byStatus[s]].sort((a, b) => b.planQty - a.planQty);
          return (
            <div key={s} className="flex-1 min-w-0 flex flex-col pt-3 px-4 first:pl-0 last:pr-0">
              {list.length === 0 ? (
                <div className="flex-1 flex items-center justify-center text-lg text-[#3a352c]">—</div>
              ) : (
                <>
                  {list.slice(0, TOP_N).map((o) => (
                    <div key={o.orderNo} className="border-b border-[#3a352c] py-2 min-w-0">
                      <div className="flex items-baseline gap-3 min-w-0">
                        <span className="text-xl font-black leading-tight truncate" title={o.itemName ?? o.itemCode}>{o.itemName ?? o.itemCode}</span>
                        <span className="jfn-disp text-3xl ml-auto shrink-0" style={{ color: s === "HOLD" ? RED : o.achieveRate >= 100 ? RED : undefined }}>
                          {s === "WAITING" ? "" : `${o.achieveRate}%`}
                        </span>
                      </div>
                      <div className="flex items-baseline gap-3 text-sm text-[#8d887c] min-w-0">
                        <span className="font-mono truncate">{o.orderNo}</span>
                        <span className="truncate">{o.processCode ?? "—"}</span>
                        <span className="ml-auto font-mono tabular-nums shrink-0">
                          <b className="text-[#ece7da]">{o.goodQty.toLocaleString()}</b> / {o.planQty.toLocaleString()}
                          {o.defectQty > 0 && <span style={{ color: RED }}> · {t("monitoring.board.defect")} {o.defectQty}</span>}
                        </span>
                      </div>
                      {s !== "WAITING" && (
                        <div className="h-1 bg-[#2a2721] mt-1.5">
                          <div className="h-full" style={{ width: `${Math.min(100, o.achieveRate)}%`, background: s === "HOLD" ? RED : INK }} />
                        </div>
                      )}
                    </div>
                  ))}
                  {list.length > TOP_N && <div className="text-sm text-[#8d887c] pt-2">+{list.length - TOP_N}</div>}
                </>
              )}
            </div>
          );
        })}
      </div>

      <div className="h-8 flex items-center justify-end px-12 border-t border-[#3a352c] font-mono text-xs text-[#8d887c] flex-shrink-0">
        {t("monitoring.board.updatedAt")} {updatedAt}
      </div>
    </div>
  );
}
