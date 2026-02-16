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

/** 작업지시 데이터 인터페이스 */
export interface WorkOrderSummary {
  orderNo: string;
  partCode: string;
  partName: string;
  processType: string;
  planQty: number;
  prodQty: number;
  lineName: string;
  status: string;
}

/** Mock 작업지시 (모든 실적입력 페이지에서 공유) */
export const mockWorkOrders: WorkOrderSummary[] = [
  { orderNo: "JO-20250126-001", partCode: "H-001", partName: "메인 하네스 A", processType: "ASSY", planQty: 200, prodQty: 145, lineName: "L3-조립", status: "RUNNING" },
  { orderNo: "JO-20250126-002", partCode: "T-001", partName: "110형 단자 압착", processType: "CRIMP", planQty: 1500, prodQty: 1480, lineName: "L2-압착", status: "RUNNING" },
  { orderNo: "JO-20250126-003", partCode: "H-003", partName: "도어 하네스 C", processType: "ASSY", planQty: 300, prodQty: 0, lineName: "L3-조립", status: "WAITING" },
  { orderNo: "JO-20250126-004", partCode: "W-002", partName: "AVSS 0.3sq 흰색", processType: "CUT", planQty: 6000, prodQty: 5900, lineName: "L1-절단", status: "RUNNING" },
  { orderNo: "JO-20250126-005", partCode: "H-001", partName: "메인 하네스 A", processType: "INSP", planQty: 150, prodQty: 148, lineName: "L4-검사", status: "RUNNING" },
  { orderNo: "JO-20250126-006", partCode: "T-002", partName: "250형 단자 압착", processType: "CRIMP", planQty: 4000, prodQty: 3960, lineName: "L2-압착", status: "RUNNING" },
  { orderNo: "JO-20250126-007", partCode: "H-003", partName: "도어 하네스 C", processType: "PACK", planQty: 100, prodQty: 100, lineName: "L5-포장", status: "DONE" },
];

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

  // useMemo 제거 - 데이터가 7개뿐이고 filter 연산은 매우 빠름
  let availableOrders = mockWorkOrders.filter((o) => o.status !== "DONE");
  if (processFilter?.length) {
    availableOrders = availableOrders.filter((o) => processFilter.includes(o.processType));
  }

  const options = [
    { value: "", label: t("production.workOrderCtx.selectOrder") },
    ...availableOrders.map((o) => ({
      value: o.orderNo,
      label: `${o.orderNo} (${o.partName})`,
    })),
  ];

  const selected = mockWorkOrders.find((o) => o.orderNo === selectedOrderNo) ?? null;

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
            <div className="text-text font-medium">{selected.partName}</div>
            <div className="text-text-muted">{t("production.workOrderCtx.partCode")}</div>
            <div className="text-text font-mono">{selected.partCode}</div>
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
