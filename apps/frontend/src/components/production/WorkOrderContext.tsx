"use client";

/**
 * @file src/components/production/WorkOrderContext.tsx
 * @description 작업지시 컨텍스트 패널 - 실적입력 시 선택된 작업지시 정보를 표시
 *
 * 개선사항:
 * 1. 불필요한 useMemo 제거 (데이터가 7개뿐)
 * 2. 코드 단순화
 */

import { useTranslation } from "react-i18next";
import { ClipboardList, TrendingUp } from "lucide-react";
import { Select } from "@/components/ui";
import { useEffect, useMemo, useState } from "react";
import api from "@/services/api";

/** 작업지시 데이터 인터페이스 */
export interface WorkOrderSummary {
  orderNo: string;
  itemCode: string;
  itemName: string;
  processType: string;
  planQty: number;
  prodQty: number;
  lineName: string;
  status: string;
}

interface JobOrderApiRow {
  orderNo: string;
  itemCode: string;
  processType?: string;
  processCode?: string;
  planQty?: number;
  goodQty?: number;
  completedQty?: number;
  lineName?: string;
  status: string;
  part?: {
    itemName?: string;
  };
}

interface JobOrderListResponse {
  data?: JobOrderApiRow[];
}

const processColors: Record<string, string> = {
  CUT: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
  CRIMP: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  ASSY: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  INSP: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
  PACK: "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300",
};

interface WorkOrderContextProps {
  selectedOrderNo: string;
  onSelect: (orderNo: string) => void;
  /** 특정 공정만 필터링 */
  processFilter?: string[];
}

function WorkOrderContext({ selectedOrderNo, onSelect, processFilter }: WorkOrderContextProps) {
  const { t } = useTranslation();
  const [workOrders, setWorkOrders] = useState<WorkOrderSummary[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function fetchWorkOrders() {
      try {
        const response = await api.get<JobOrderListResponse | JobOrderApiRow[]>("/production/job-orders", {
          params: { statuses: "WAITING,RUNNING", limit: 200 },
        });
        const rawRows = Array.isArray(response.data) ? response.data : response.data?.data ?? [];
        const rows = rawRows.map((row) => ({
          orderNo: row.orderNo,
          itemCode: row.itemCode,
          itemName: row.part?.itemName ?? row.itemCode,
          processType: row.processType ?? row.processCode ?? "",
          planQty: row.planQty ?? 0,
          prodQty: row.goodQty ?? row.completedQty ?? 0,
          lineName: row.lineName ?? "",
          status: row.status,
        }));

        if (!cancelled) {
          setWorkOrders(rows);
        }
      } catch {
        if (!cancelled) {
          setWorkOrders([]);
        }
      }
    }

    fetchWorkOrders();

    return () => {
      cancelled = true;
    };
  }, []);

  const availableOrders = useMemo(() => {
    const activeOrders = workOrders.filter((o) => o.status !== "DONE");
    return processFilter?.length
      ? activeOrders.filter((o) => processFilter.includes(o.processType))
      : activeOrders;
  }, [processFilter, workOrders]);

  const options = [
    { value: "", label: t("production.workOrderCtx.selectOrder") },
    ...availableOrders.map((o) => ({
      value: o.orderNo,
      label: `${o.orderNo} (${o.itemName})`,
    })),
  ];

  const selected = workOrders.find((o) => o.orderNo === selectedOrderNo) ?? null;

  const remaining = selected ? Math.max(selected.planQty - selected.prodQty, 0) : 0;
  const progressPct = selected && selected.planQty > 0
    ? Math.min(Math.round((selected.prodQty / selected.planQty) * 100), 100)
    : 0;
  const barColor = progressPct >= 95 ? "bg-green-500" : progressPct >= 70 ? "bg-blue-500" : "bg-orange-500";

  return (
    <div className="space-y-3">
      <Select
        label={t("production.workOrderCtx.workOrder")}
        options={options}
        value={selectedOrderNo}
        onChange={onSelect}
        fullWidth
      />

      {selected && (
        <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg space-y-3">
          <div className="flex items-center gap-2">
            <ClipboardList className="w-4 h-4 text-primary" />
            <span className="text-sm font-semibold text-text">{t("production.workOrderCtx.orderInfo")}</span>
            <span className={`ml-auto px-2 py-0.5 text-xs font-medium rounded-full ${processColors[selected.processType] ?? "bg-gray-100 text-gray-700"}`}>
              {t(`production.order.process${selected.processType}`)}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
            <div className="text-text-muted">{t("production.workOrderCtx.partName")}</div>
            <div className="text-text font-medium">{selected.itemName}</div>
            <div className="text-text-muted">{t("production.workOrderCtx.partCode")}</div>
            <div className="text-text font-mono">{selected.itemCode}</div>
            <div className="text-text-muted">{t("production.workOrderCtx.line")}</div>
            <div className="text-text">{selected.lineName}</div>
          </div>

          <div className="pt-2 border-t border-primary/10">
            <div className="flex items-center justify-between text-sm mb-1">
              <span className="flex items-center gap-1 text-text-muted">
                <TrendingUp className="w-3.5 h-3.5" />
                {t("production.workOrderCtx.progress")}
              </span>
              <span className="text-text font-medium">{selected.prodQty.toLocaleString()} / {selected.planQty.toLocaleString()}</span>
            </div>
            <div className="h-2.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div className={`h-full ${barColor} rounded-full transition-all`} style={{ width: `${progressPct}%` }} />
            </div>
            <div className="flex justify-between mt-1.5 text-xs">
              <span className="text-text-muted">{progressPct}%</span>
              <span className="text-primary font-semibold">
                {t("production.workOrderCtx.remaining")}: {remaining.toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default WorkOrderContext;
