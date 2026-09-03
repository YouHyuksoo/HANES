"use client";

/**
 * @file .../job-order-board/components/skins/LedgerSkin.tsx
 * @description 스킨 A "레저" — 출발 전광판식 장부. 공정 밴드(공정명 + 공정 합계) 아래에 지시 행이 이어진다.
 *              행 = [상태 바][지시번호][품목코드 전체 + 품명(작게)][계획 | 실적 | 불량][달성률 바 + %].
 *              숫자 세 열이 세로로 정렬돼 위아래 지시끼리 바로 비교된다. 코드는 줄이지 않는다.
 */
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useRotation } from "@/components/monitoring";
import { ALERT, STATUS_COLOR, type JobOrderSkinProps } from "../types";
import { groupByProcess, type OrderRow, type ProcessGroup } from "../metrics";
import { BG, BOARD_CSS, BoardFooter, BoardHeader, DIM, INK, LINE, LINE_STRONG, MUTED, ROW_ALT, StackBar, defectColor, fmt, rateColor } from "../parts";

const PER_PAGE = 7;
const GRID = "17.5rem 30rem minmax(0,1fr) 11rem 11rem 11rem 22rem";

type Line = { kind: "band"; g: ProcessGroup; cont: boolean } | { kind: "order"; r: OrderRow; g: ProcessGroup };

export default function LedgerSkin({ kpi, orders, byStatus, rollingSec, paused, updatedAt }: JobOrderSkinProps) {
  const { t } = useTranslation();
  const groups = useMemo(() => groupByProcess(orders), [orders]);

  // 밴드+지시 행을 한 줄 단위로 펼쳐 페이지네이션. 페이지가 지시 행으로 시작하면 "계속" 밴드를 앞에 붙인다.
  const lines = useMemo<Line[]>(() => groups.flatMap((g) => [{ kind: "band", g, cont: false } as Line, ...g.rows.map((r) => ({ kind: "order", r, g }) as Line)]), [groups]);
  const { pageItems, page, pageCount } = useRotation(lines, PER_PAGE, rollingSec, paused);
  const view = useMemo<Line[]>(() => {
    if (pageItems.length > 0 && pageItems[0].kind === "order") return [{ kind: "band", g: pageItems[0].g, cont: true }, ...pageItems];
    return pageItems;
  }, [pageItems]);
  const rowsOnPage = Math.max(5, Math.min(PER_PAGE + 1, view.length));

  return (
    <div className="w-full h-full flex flex-col overflow-hidden" style={{ background: BG, color: INK }}>
      <style>{BOARD_CSS}</style>
      <BoardHeader kpi={kpi} byStatus={byStatus} tag="A · LEDGER" />

      <div className="grid h-9 items-center text-[15px] tracking-[0.2em] flex-shrink-0"
        style={{ gridTemplateColumns: GRID, color: MUTED, borderBottom: `1px solid ${LINE}`, padding: "0 2.5rem 0 calc(2.5rem + 1rem + 10px)" }}>
        <span>{t("monitoring.board.col.orderNo")}</span>
        <span>{t("monitoring.board.col.item")}</span>
        <span />
        <span className="text-right pr-6">{t("monitoring.board.col.plan")}</span>
        <span className="text-right pr-6">{t("monitoring.board.col.good")}</span>
        <span className="text-right pr-6">{t("monitoring.board.col.defect")}</span>
        <span>{t("monitoring.board.col.achieve")}</span>
      </div>

      <div className="flex-1 min-h-0 flex flex-col px-10 overflow-hidden">
        {view.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-3xl" style={{ color: MUTED }}>{t("monitoring.board.noOrders")}</div>
        ) : view.map((ln, i) => ln.kind === "band"
          ? <Band key={`b-${ln.g.process}-${i}`} g={ln.g} cont={ln.cont} n={rowsOnPage} />
          : <Row key={ln.r.order.orderNo} r={ln.r} alt={i % 2 === 1} n={rowsOnPage} />)}
      </div>

      <BoardFooter updatedAt={updatedAt} page={page} pageCount={pageCount} />
    </div>
  );
}

function Band({ g, cont, n }: { g: ProcessGroup; cont: boolean; n: number }) {
  const { t } = useTranslation();
  const sl = (s: string) => t(`comCode.JOB_ORDER_STATUS.${s}`, { defaultValue: s });
  return (
    <div className="grid items-center min-h-0"
      style={{ flex: `0 0 calc(100% / ${n})`, gridTemplateColumns: GRID, borderBottom: `3px solid ${LINE_STRONG}`, background: "#0f1522", paddingLeft: "calc(1rem + 10px)" }}>
      <div className="col-span-3 flex items-baseline gap-5 whitespace-nowrap min-w-0">
        <span className="text-[14px] tracking-[0.3em]" style={{ color: MUTED }}>{t("monitoring.board.col.process")}</span>
        <span className="jb-num text-[44px] font-bold leading-none">{g.process}</span>
        {cont && <span className="text-[16px] tracking-[0.2em]" style={{ color: MUTED }}>· {t("monitoring.board.jobOrder.continued")}</span>}
        <span className="ml-6 flex items-baseline gap-4 text-[18px]" style={{ color: MUTED }}>
          {(["RUNNING", "HOLD", "WAITING", "DONE"] as const).filter((s) => g.counts[s] > 0).map((s) => (
            <span key={s}><b className="jb-num text-[26px]" style={{ color: STATUS_COLOR[s] }}>{g.counts[s]}</b> {sl(s)}</span>
          ))}
        </span>
      </div>
      <Num v={g.total.plan} size={30} />
      <Num v={g.total.good} size={30} color={rateColor(g.total.achieveRate)} />
      <Num v={g.total.defect} size={30} color={defectColor(g.total.defectRate)} />
      <div className="flex items-center gap-4 pr-2">
        <div className="flex-1"><StackBar plan={g.total.plan} good={g.total.good} defect={g.total.defect} height={10} /></div>
        <span className="jb-num text-[34px] font-bold leading-none w-[5.5rem] text-right" style={{ color: rateColor(g.total.achieveRate) }}>{g.total.achieveRate}%</span>
      </div>
    </div>
  );
}

function Row({ r, alt, n }: { r: OrderRow; alt: boolean; n: number }) {
  const { order: o, status, m } = r;
  const color = STATUS_COLOR[status];
  return (
    <div className="grid items-center min-h-0"
      style={{ flex: `0 0 calc(100% / ${n})`, gridTemplateColumns: GRID, borderBottom: `2px solid ${LINE}`, background: alt ? ROW_ALT : "transparent",
        borderLeft: `10px solid ${color}`, paddingLeft: "1rem", opacity: status === "DONE" ? 0.55 : 1 }}>
      <div className="jb-code text-[27px] font-semibold leading-tight pr-3 whitespace-nowrap" style={{ animation: status === "HOLD" ? "jb-blink 1.6s infinite" : "none" }}>{o.orderNo}</div>
      <div className="min-w-0 pr-4">
        <div className="jb-code text-[27px] font-semibold leading-tight">{o.itemCode}</div>
        {o.itemName && o.itemName !== o.itemCode && <div className="text-[16px] mt-1 leading-tight" style={{ color: MUTED }}>{o.itemName}</div>}
      </div>
      <div className="text-[18px] pr-4" style={{ color: MUTED }}>{o.equipCode ?? ""}</div>
      <Num v={m.plan} />
      <Num v={m.good} color={m.good > 0 ? rateColor(m.achieveRate) : DIM} />
      <Num v={m.defect} color={defectColor(m.defectRate)} />
      <div className="flex items-center gap-4 pr-2">
        <div className="flex-1"><StackBar plan={m.plan} good={m.good} defect={m.defect} running={status === "RUNNING"} /></div>
        <span className="jb-num text-[36px] font-bold leading-none w-[5.5rem] text-right" style={{ color: m.defectRate > 0 && m.achieveRate < 100 ? ALERT : rateColor(m.achieveRate) }}>{m.achieveRate}%</span>
      </div>
    </div>
  );
}

function Num({ v, size = 36, color = INK }: { v: number; size?: number; color?: string }) {
  return <div className="jb-num font-bold leading-none text-right pr-6" style={{ fontSize: size, color: v === 0 ? (color === INK ? MUTED : color) : color }}>{fmt(v)}</div>;
}
