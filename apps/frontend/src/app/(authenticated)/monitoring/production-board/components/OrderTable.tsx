"use client";

/**
 * @file src/app/(authenticated)/monitoring/production-board/components/OrderTable.tsx
 * @description 생산현황 보드 작업지시 테이블 — TV 가독성 기준 큰 폰트 + 달성률 진행바
 */
import { useTranslation } from "react-i18next";
import StatusBadge from "@/components/shared/StatusBadge";
import type { ProductionBoardOrder } from "./types";

interface OrderTableProps {
  orders: ProductionBoardOrder[];
  loading?: boolean;
}

export default function OrderTable({ orders, loading = false }: OrderTableProps) {
  const { t } = useTranslation();

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-sm text-text-muted">
        {t("monitoring.board.noOrders")}
      </div>
    );
  }

  return (
    <div className="h-full overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-xs text-text-muted">
            <th className="px-3 py-2 text-left font-medium">{t("monitoring.board.col.orderNo")}</th>
            <th className="px-3 py-2 text-left font-medium">{t("monitoring.board.col.item")}</th>
            <th className="px-3 py-2 text-left font-medium">{t("monitoring.board.col.process")}</th>
            <th className="px-3 py-2 text-right font-medium">{t("monitoring.board.col.plan")}</th>
            <th className="px-3 py-2 text-right font-medium">{t("monitoring.board.col.good")}</th>
            <th className="px-3 py-2 text-right font-medium">{t("monitoring.board.col.defect")}</th>
            <th className="px-3 py-2 text-left font-medium w-48">{t("monitoring.board.col.achieve")}</th>
            <th className="px-3 py-2 text-center font-medium">{t("monitoring.board.col.status")}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {orders.map((o) => (
            <tr key={o.orderNo} className={o.status === "RUNNING" ? "bg-primary/5" : ""}>
              <td className="px-3 py-2 font-mono text-xs text-text-muted">{o.orderNo}</td>
              <td className="px-3 py-2">
                <div className="font-semibold text-text truncate max-w-[26rem]">{o.itemName ?? o.itemCode}</div>
                <div className="font-mono text-[11px] text-text-muted">{o.itemCode}</div>
              </td>
              <td className="px-3 py-2 text-text">{o.processCode ?? "-"}</td>
              <td className="px-3 py-2 text-right tabular-nums text-text">{o.planQty.toLocaleString()}</td>
              <td className="px-3 py-2 text-right tabular-nums font-semibold text-primary">{o.goodQty.toLocaleString()}</td>
              <td className={`px-3 py-2 text-right tabular-nums ${o.defectQty > 0 ? "text-red-600 dark:text-red-400 font-semibold" : "text-text-muted"}`}>
                {o.defectQty.toLocaleString()}
              </td>
              <td className="px-3 py-2">
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-2 rounded-full bg-border overflow-hidden">
                    <div
                      className={`h-full rounded-full ${o.achieveRate >= 100 ? "bg-emerald-500" : "bg-primary"}`}
                      style={{ width: `${Math.min(100, o.achieveRate)}%` }}
                    />
                  </div>
                  <span className="tabular-nums text-xs font-semibold text-text w-12 text-right">{o.achieveRate}%</span>
                </div>
              </td>
              <td className="px-3 py-2 text-center">
                <StatusBadge codeType="JOB_ORDER_STATUS" value={o.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
