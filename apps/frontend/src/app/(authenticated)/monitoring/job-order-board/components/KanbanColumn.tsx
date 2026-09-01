"use client";

/**
 * @file src/app/(authenticated)/monitoring/job-order-board/components/KanbanColumn.tsx
 * @description 작업지시 칸반 컬럼 — 전광판 스타일: 박스 없이 세로 괘선으로 구획(부모 divide-x),
 *              헤더는 상태명 + 초대형 건수, 카드는 좌측 컬러 룰 리스트 행. 넘치면 자동 순환.
 */
import { useTranslation } from "react-i18next";
import StatusBadge from "@/components/shared/StatusBadge";
import { useRotation, RotationIndicator } from "@/components/monitoring";
import type { ProductionBoardOrder } from "../../production-board/components/types";

const CARDS_PER_PAGE = 7;

/** 상태별 강조색 — 좌측 룰/카운트에만 절제 사용 */
const ACCENT: Record<string, { rule: string; count: string; bar: string }> = {
  WAITING: { rule: "border-l-slate-400", count: "text-text-muted", bar: "bg-slate-400" },
  RUNNING: { rule: "border-l-primary", count: "text-primary", bar: "bg-primary" },
  HOLD: { rule: "border-l-amber-500", count: "text-amber-600 dark:text-amber-400", bar: "bg-amber-500" },
  DONE: { rule: "border-l-emerald-500", count: "text-emerald-600 dark:text-emerald-400", bar: "bg-emerald-500" },
};

interface KanbanColumnProps {
  status: string;
  orders: ProductionBoardOrder[];
  rollingSec: number;
}

export default function KanbanColumn({ status, orders, rollingSec }: KanbanColumnProps) {
  const { t } = useTranslation();
  const { pageItems, page, pageCount } = useRotation(orders, CARDS_PER_PAGE, rollingSec);
  const accent = ACCENT[status] ?? ACCENT.WAITING;

  return (
    <div className="flex-1 min-w-0 flex flex-col overflow-hidden px-4 first:pl-1 last:pr-1">
      {/* 컬럼 헤더 — 상태명 + 초대형 건수, 굵은 괘선 마감 */}
      <div className="flex items-end justify-between pb-2 border-b-2 border-text/70 flex-shrink-0">
        <StatusBadge codeType="JOB_ORDER_STATUS" value={status} />
        <span className={`text-4xl font-extrabold tabular-nums leading-none ${accent.count}`}>{orders.length}</span>
      </div>

      {/* 항목 리스트 — 좌측 컬러 룰 + hairline 행 구분 */}
      <div className="flex-1 min-h-0 overflow-hidden pt-1">
        {orders.length === 0 ? (
          <div className="h-full flex items-center justify-center text-xs text-text-muted">
            {t("monitoring.board.noOrders")}
          </div>
        ) : (
          pageItems.map((o) => (
            <div key={o.orderNo} className={`border-l-4 ${accent.rule} border-b border-border/60 pl-3 pr-1 py-2`}>
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-mono text-[11px] text-text-muted truncate">{o.orderNo}</span>
                <span className="tabular-nums text-sm shrink-0">
                  <span className="font-bold text-text">{o.goodQty.toLocaleString()}</span>
                  <span className="text-text-muted"> / {o.planQty.toLocaleString()}</span>
                </span>
              </div>
              <div className="mt-0.5 text-base font-medium leading-tight text-text truncate">
                {o.itemName ?? o.itemCode}
              </div>
              <div className="mt-1 flex items-center gap-2">
                <span className="text-xs text-text-muted truncate">{o.processCode ?? "—"}</span>
                <div className="flex-1 h-1 bg-border overflow-hidden">
                  <div
                    className={`h-full ${o.achieveRate >= 100 ? "bg-emerald-500" : accent.bar}`}
                    style={{ width: `${Math.min(100, o.achieveRate)}%` }}
                  />
                </div>
                <span className="tabular-nums text-xs font-bold text-text w-11 text-right">{o.achieveRate}%</span>
              </div>
            </div>
          ))
        )}
      </div>

      {pageCount > 1 && (
        <div className="flex justify-center pt-1.5 flex-shrink-0">
          <RotationIndicator page={page} pageCount={pageCount} />
        </div>
      )}
    </div>
  );
}
