"use client";

/**
 * @file .../job-order-board/components/parts.tsx
 * @description 작업지시 보드 스킨 3종(A 레저 / B 스코어보드 / C 게이지 월)이 공유하는 조각.
 *              같은 헤더·푸터·팔레트·숫자 서체를 쓰게 해 스킨이 바뀌어도 읽는 법이 바뀌지 않는다.
 *              다크 전광판 고정. 카드/박스 없음. 코드(지시번호·품목코드)는 절대 줄이지 않는다 — 넘치면 줄바꿈.
 */
import { useTranslation } from "react-i18next";
import { useNow, formatClock } from "@/components/monitoring/BoardClock";
import { ALERT, STATUS_COLOR, type JobStatus, type ProductionBoardKpi, type ProductionBoardOrder } from "./types";
import { metricsOf } from "./metrics";

export const BG = "#07090d";
export const ROW_ALT = "#0d1118";
export const LINE = "#25304a";
export const LINE_STRONG = "#3a4a6b";
export const INK = "#f2f5fa";
export const MUTED = "#8494b0";
export const DIM = "#2a3548";
export const GOOD = "#22d3ee";
export const DONE = "#34d399";

export const BOARD_CSS = `
  .jb-num { font-family: 'Rajdhani', var(--font-sans), sans-serif; font-variant-numeric: tabular-nums; letter-spacing: 0.01em; }
  .jb-big { font-family: 'Anton', var(--font-sans), sans-serif; font-variant-numeric: tabular-nums; letter-spacing: 0.02em; }
  .jb-code { font-family: 'IBM Plex Mono', var(--font-mono), monospace; font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
  @keyframes jb-blink { 0%,100% { opacity: 1 } 50% { opacity: .3 } }
  @keyframes jb-scan { 0% { background-position: 0 0 } 100% { background-position: 36px 0 } }
`;

export const fmt = (n: number) => n.toLocaleString();

/** 달성률 색: 100% 이상 완료색, 그 외 진행색. 불량률은 0 초과면 경보색. */
export const rateColor = (achieveRate: number) => (achieveRate >= 100 ? DONE : GOOD);
export const defectColor = (defectRate: number) => (defectRate > 0 ? ALERT : DIM);

/** 헤더: 제목 · 스킨 태그 · 오늘 계획/실적/불량 · 달성률 · 불량률 · 상태 건수 · 시계 */
export function BoardHeader({ kpi, byStatus, tag }: {
  kpi?: ProductionBoardKpi;
  byStatus: Record<JobStatus, ProductionBoardOrder[]>;
  tag: string;
}) {
  const { t } = useTranslation();
  const now = useNow();
  const clock = now ? formatClock(now) : null;
  const m = metricsOf(kpi?.planQty ?? 0, kpi?.goodQty ?? 0, kpi?.defectQty ?? 0);
  const sl = (s: JobStatus) => t(`comCode.JOB_ORDER_STATUS.${s}`, { defaultValue: s });

  return (
    <div className="flex items-center px-10 h-[108px] flex-shrink-0" style={{ borderBottom: `3px solid ${LINE_STRONG}` }}>
      <div className="whitespace-nowrap">
        <div className="text-[34px] font-black tracking-[0.18em] leading-none">{t("menu.monitoring.jobBoard")}</div>
        <div className="text-[14px] tracking-[0.35em] mt-2" style={{ color: MUTED }}>{tag}</div>
      </div>

      <div className="ml-14 flex items-end gap-10 whitespace-nowrap">
        <Stat label={t("monitoring.board.col.plan")} value={fmt(m.plan)} />
        <Stat label={t("monitoring.board.col.good")} value={fmt(m.good)} color={GOOD} />
        <Stat label={t("monitoring.board.col.defect")} value={fmt(m.defect)} color={m.defect > 0 ? ALERT : DIM} />
        <span className="self-stretch w-px" style={{ background: LINE }} />
        <Stat label={t("monitoring.board.col.achieve")} value={`${m.achieveRate}%`} color={rateColor(m.achieveRate)} size={56} />
        <Stat label={t("monitoring.board.jobOrder.defectRate")} value={`${m.defectRate}%`} color={defectColor(m.defectRate)} size={44} />
      </div>

      <div className="ml-auto mr-72 flex items-end gap-7 whitespace-nowrap">
        {(["RUNNING", "HOLD", "WAITING", "DONE"] as const).map((s) => (
          <Stat key={s} label={sl(s)} value={String(byStatus[s].length)} color={byStatus[s].length > 0 ? STATUS_COLOR[s] : DIM} size={40} />
        ))}
        <span className="flex flex-col items-end leading-none ml-3">
          <span className="jb-num text-[18px] tracking-[0.2em] mb-1.5" style={{ color: MUTED }}>{clock?.date ?? "----------"}</span>
          <span className="jb-num text-[52px] font-bold">{clock?.hm ?? "--:--"}</span>
        </span>
      </div>
    </div>
  );
}

function Stat({ label, value, color = INK, size = 36 }: { label: string; value: string; color?: string; size?: number }) {
  return (
    <span className="flex flex-col items-start leading-none">
      <span className="text-[14px] tracking-[0.2em] mb-1.5" style={{ color: MUTED }}>{label}</span>
      <span className="jb-num font-bold" style={{ color, fontSize: size }}>{value}</span>
    </span>
  );
}

export function BoardFooter({ updatedAt, page, pageCount, note }: { updatedAt: string; page: number; pageCount: number; note?: string }) {
  const { t } = useTranslation();
  return (
    <div className="h-[44px] flex items-center px-10 gap-8 flex-shrink-0 whitespace-nowrap text-[15px] tracking-[0.15em]"
      style={{ borderTop: `2px solid ${LINE}`, color: MUTED }}>
      {note && <span>{note}</span>}
      <span className="ml-auto">{t("monitoring.board.updatedAt")} {updatedAt}{pageCount > 1 ? `  ·  ${page + 1} / ${pageCount}` : ""}</span>
    </div>
  );
}

/** 실적(진행색) + 불량(경보색) 적층 바. 계획 대비 비율. */
export function StackBar({ plan, good, defect, height = 12, running = false }: { plan: number; good: number; defect: number; height?: number; running?: boolean }) {
  const g = plan > 0 ? Math.min(100, (good / plan) * 100) : 0;
  const d = plan > 0 ? Math.min(100 - g, (defect / plan) * 100) : 0;
  return (
    <div className="flex w-full" style={{ height, background: "#141b28" }}>
      <div style={{
        width: `${g}%`, background: g >= 100 ? DONE : GOOD, transition: "width .6s",
        backgroundImage: running ? `repeating-linear-gradient(90deg, transparent 0 18px, rgba(0,0,0,.25) 18px 36px)` : "none",
        animation: running ? "jb-scan 1.2s linear infinite" : "none",
      }} />
      <div style={{ width: `${d}%`, background: ALERT, transition: "width .6s" }} />
    </div>
  );
}
