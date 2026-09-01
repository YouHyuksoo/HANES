"use client";

/**
 * @file src/app/(authenticated)/monitoring/job-order-board/components/KanbanColumn.tsx
 * @description 작업지시 칸반 컬럼 — 상태별 카드 목록, 넘치면 자동 순환
 */
import { useTranslation } from "react-i18next";
import StatusBadge from "@/components/shared/StatusBadge";
import { useRotation, RotationIndicator } from "@/components/monitoring";
import type { ProductionBoardOrder } from "../../production-board/components/types";

const CARDS_PER_PAGE = 6;

/** 컬럼 상단 색 라인 — 파스텔 배경 대신 테두리/텍스트로 구분 */
const COLUMN_ACCENT: Record<string, string> = {
  WAITING: "border-t-slate-400",
  RUNNING: "border-t-blue-500",
  HOLD: "border-t-amber-500",
  DONE: "border-t-emerald-500",
};

interface KanbanColumnProps {
  status: string;
  orders: ProductionBoardOrder[];
  rollingSec: number;
}

export default function KanbanColumn({ status, orders, rollingSec }: KanbanColumnProps) {
  const { t } = useTranslation();
  const { pageItems, page, pageCount } = useRotation(orders, CARDS_PER_PAGE, rollingSec);

  return (
    <div
      className={`flex-1 min-w-0 rounded-xl border border-border border-t-4 ${COLUMN_ACCENT[status] ?? "border-t-border"} bg-surface flex flex-col overflow-hidden`}
    >
      <div className="flex items-center justify-between px-3 py-2 border-b border-border flex-shrink-0">
        <StatusBadge codeType="JOB_ORDER_STATUS" value={status} />
        <span className="text-sm font-bold tabular-nums text-text">{orders.length}</span>
      </div>

      <div className="flex-1 min-h-0 overflow-hidden p-2 space-y-2">
        {orders.length === 0 ? (
          <div className="h-full flex items-center justify-center text-xs text-text-muted">
            {t("monitoring.board.noOrders")}
          </div>
        ) : (
          pageItems.map((o) => (
            <div key={o.orderNo} className="rounded-lg border border-border px-3 py-2">
              <div className="font-mono text-[11px] text-text-muted">{o.orderNo}</div>
              <div className="font-semibold text-sm text-text truncate">{o.itemName ?? o.itemCode}</div>
              <div className="mt-1 flex items-center justify-between text-xs">
                <span className="text-text-muted truncate">{o.processCode ?? "-"}</span>
                <span className="tabular-nums text-text">
                  <span className="font-semibold text-primary">{o.goodQty.toLocaleString()}</span>
                  <span className="text-text-muted"> / {o.planQty.toLocaleString()}</span>
                </span>
              </div>
              <div className="mt-1.5 h-1.5 rounded-full bg-border overflow-hidden">
                <div
                  className={`h-full rounded-full ${o.achieveRate >= 100 ? "bg-emerald-500" : "bg-primary"}`}
                  style={{ width: `${Math.min(100, o.achieveRate)}%` }}
                />
              </div>
            </div>
          ))
        )}
      </div>

      {pageCount > 1 && (
        <div className="flex justify-center pb-2 flex-shrink-0">
          <RotationIndicator page={page} pageCount={pageCount} />
        </div>
      )}
    </div>
  );
}
