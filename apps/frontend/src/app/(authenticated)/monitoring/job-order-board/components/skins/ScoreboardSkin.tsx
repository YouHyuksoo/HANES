"use client";

/**
 * @file .../job-order-board/components/skins/ScoreboardSkin.tsx
 * @description 스킨 B "스코어보드" — 지시 하나가 한 줄, 계획·실적·불량이 경기장 전광판처럼 거대 숫자 3개.
 *              왼쪽에 공정 + 지시번호 + 품목코드(전체), 오른쪽 끝에 달성률·불량률·잔량. 4행/페이지.
 *              숫자 자체가 그림이 되도록 Anton 서체 72px. 진행 중은 실적 숫자가 숨쉰다.
 */
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useRotation } from "@/components/monitoring";
import { STATUS_COLOR, type JobOrderSkinProps } from "../types";
import { sortRows, toRow, type OrderRow } from "../metrics";
import { BG, BOARD_CSS, BoardFooter, BoardHeader, DIM, GOOD, INK, LINE, LINE_STRONG, MUTED, ROW_ALT, StackBar, defectColor, fmt, rateColor } from "../parts";

const PER_PAGE = 4;

export default function ScoreboardSkin({ kpi, orders, byStatus, rollingSec, paused, updatedAt }: JobOrderSkinProps) {
  const { t } = useTranslation();
  const rows = useMemo(() => sortRows(orders.map(toRow)), [orders]);
  const { pageItems, page, pageCount } = useRotation(rows, PER_PAGE, rollingSec, paused);
  const n = Math.max(3, Math.min(PER_PAGE, pageItems.length));

  return (
    <div className="w-full h-full flex flex-col overflow-hidden" style={{ background: BG, color: INK }}>
      <style>{BOARD_CSS}</style>
      <BoardHeader kpi={kpi} byStatus={byStatus} tag="B · SCOREBOARD" />

      <div className="flex-1 min-h-0 flex flex-col px-10 overflow-hidden">
        {pageItems.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-3xl" style={{ color: MUTED }}>{t("monitoring.board.noOrders")}</div>
        ) : pageItems.map((r, i) => <Row key={r.order.orderNo} r={r} alt={i % 2 === 1} n={n} />)}
      </div>

      <BoardFooter updatedAt={updatedAt} page={page} pageCount={pageCount} />
    </div>
  );
}

function Row({ r, alt, n }: { r: OrderRow; alt: boolean; n: number }) {
  const { t } = useTranslation();
  const { order: o, status, m } = r;
  const color = STATUS_COLOR[status];
  const sl = t(`comCode.JOB_ORDER_STATUS.${status}`, { defaultValue: status });

  return (
    <div className="grid items-stretch min-h-0"
      style={{ flex: `0 0 calc(100% / ${n})`, gridTemplateColumns: "minmax(0,1fr) 15rem 15rem 15rem 20rem", borderBottom: `3px solid ${LINE_STRONG}`,
        background: alt ? ROW_ALT : "transparent", borderLeft: `12px solid ${color}`, opacity: status === "DONE" ? 0.55 : 1 }}>
      {/* 공정 · 지시번호 · 품목코드 */}
      <div className="min-w-0 flex flex-col justify-center pl-6 pr-6 py-3">
        <div className="flex items-baseline gap-5 whitespace-nowrap">
          <span className="jb-num text-[40px] font-bold leading-none">{o.processCode ?? "—"}</span>
          <span className="text-[18px] font-bold tracking-[0.15em] leading-none" style={{ color, animation: status === "HOLD" ? "jb-blink 1.6s infinite" : "none" }}>{sl}</span>
          {o.equipCode && <span className="text-[18px] leading-none" style={{ color: MUTED }}>{o.equipCode}</span>}
        </div>
        <div className="jb-code text-[34px] font-semibold leading-tight mt-2">{o.orderNo}</div>
        <div className="jb-code text-[24px] leading-tight mt-1" style={{ color: INK }}>{o.itemCode}{o.itemName && o.itemName !== o.itemCode && <span className="font-sans text-[16px] ml-3" style={{ color: MUTED }}>{o.itemName}</span>}</div>
      </div>

      <Score label={t("monitoring.board.col.plan")} v={m.plan} color={INK} />
      <Score label={t("monitoring.board.col.good")} v={m.good} color={m.good > 0 ? GOOD : DIM} pulse={status === "RUNNING"} />
      <Score label={t("monitoring.board.col.defect")} v={m.defect} color={defectColor(m.defectRate)} />

      {/* 파생 지표 */}
      <div className="flex flex-col justify-center pl-6 pr-4 py-3" style={{ borderLeft: `1px solid ${LINE}` }}>
        <div className="flex items-baseline justify-between whitespace-nowrap">
          <span className="text-[15px] tracking-[0.2em]" style={{ color: MUTED }}>{t("monitoring.board.col.achieve")}</span>
          <span className="jb-num text-[48px] font-bold leading-none" style={{ color: rateColor(m.achieveRate) }}>{m.achieveRate}%</span>
        </div>
        <div className="my-2"><StackBar plan={m.plan} good={m.good} defect={m.defect} height={10} running={status === "RUNNING"} /></div>
        <div className="flex items-baseline justify-between whitespace-nowrap text-[18px]" style={{ color: MUTED }}>
          <span>{t("monitoring.board.jobOrder.defectRate")} <b className="jb-num text-[24px]" style={{ color: defectColor(m.defectRate) }}>{m.defectRate}%</b></span>
          <span>{t("monitoring.board.jobOrder.remaining")} <b className="jb-num text-[24px]" style={{ color: m.remaining === 0 ? rateColor(100) : INK }}>{fmt(m.remaining)}</b></span>
        </div>
      </div>
    </div>
  );
}

function Score({ label, v, color, pulse = false }: { label: string; v: number; color: string; pulse?: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center" style={{ borderLeft: `1px solid ${LINE}` }}>
      <span className="text-[15px] tracking-[0.3em]" style={{ color: MUTED }}>{label}</span>
      <span className="jb-big leading-none mt-1" style={{ fontSize: v >= 100000 ? 56 : 72, color, animation: pulse && v > 0 ? "jb-blink 2.4s ease-in-out infinite" : "none" }}>{fmt(v)}</span>
    </div>
  );
}
