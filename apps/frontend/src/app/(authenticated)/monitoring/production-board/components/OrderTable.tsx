"use client";

/**
 * @file src/app/(authenticated)/monitoring/production-board/components/OrderTable.tsx
 * @description 생산현황 보드 작업지시 테이블 — 전광판 스타일: TV 시청거리 기준 대형 타이포,
 *              박스 대신 hairline 행 구분 + RUNNING 행 좌측 컬러 룰로 강조
 */
import { useTranslation } from "react-i18next";
import StatusBadge from "@/components/shared/StatusBadge";
import type { ProductionBoardOrder } from "./types";

interface OrderTableProps {
  orders: ProductionBoardOrder[];
  loading?: boolean;
}

const thCls = "px-3 pb-2 text-sm font-semibold uppercase tracking-[0.12em] text-text-muted";

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
      <div className="h-full flex items-center justify-center text-xl text-text-muted">
        {t("monitoring.board.noOrders")}
      </div>
    );
  }

  return (
    <div className="h-full overflow-hidden">
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-border text-left">
            <th className={thCls}>{t("monitoring.board.col.orderNo")}</th>
            <th className={thCls}>{t("monitoring.board.col.item")}</th>
            <th className={thCls}>{t("monitoring.board.col.process")}</th>
            <th className={`${thCls} text-right`}>{t("monitoring.board.col.plan")}</th>
            <th className={`${thCls} text-right`}>{t("monitoring.board.col.good")}</th>
            <th className={`${thCls} text-right`}>{t("monitoring.board.col.defect")}</th>
            <th className={`${thCls} w-56`}>{t("monitoring.board.col.achieve")}</th>
            <th className={`${thCls} text-center`}>{t("monitoring.board.col.status")}</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((o) => {
            const running = o.status === "RUNNING";
            return (
              <tr key={o.orderNo} className="border-b border-border/60">
                <td className={`py-3 pl-3 pr-3 font-mono text-base text-text-muted border-l-4 ${running ? "border-l-primary" : "border-l-transparent"}`}>
                  {o.orderNo}
                </td>
                <td className="py-3 px-3">
                  <span className={`text-xl leading-tight ${running ? "font-bold text-text" : "font-medium text-text"}`}>
                    {o.itemName ?? o.itemCode}
                  </span>
                  <span className="ml-2.5 font-mono text-sm text-text-muted">{o.itemCode}</span>
                </td>
                <td className="py-3 px-3 text-lg text-text-muted">{o.processCode ?? "—"}</td>
                <td className="py-3 px-3 text-right text-2xl tabular-nums text-text">{o.planQty.toLocaleString()}</td>
                <td className="py-3 px-3 text-right text-2xl tabular-nums font-bold text-primary">{o.goodQty.toLocaleString()}</td>
                <td className={`py-3 px-3 text-right text-2xl tabular-nums ${o.defectQty > 0 ? "font-bold text-red-600 dark:text-red-400" : "text-text-muted"}`}>
                  {o.defectQty > 0 ? o.defectQty.toLocaleString() : "—"}
                </td>
                <td className="py-3 px-3">
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-1.5 bg-border overflow-hidden">
                      <div
                        className={`h-full ${o.achieveRate >= 100 ? "bg-emerald-500" : "bg-primary"}`}
                        style={{ width: `${Math.min(100, o.achieveRate)}%` }}
                      />
                    </div>
                    <span className="tabular-nums text-xl font-bold text-text w-20 text-right">{o.achieveRate}%</span>
                  </div>
                </td>
                <td className="py-3 px-3 text-center">
                  <StatusBadge codeType="JOB_ORDER_STATUS" value={o.status} className="text-base px-3 py-1" />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
