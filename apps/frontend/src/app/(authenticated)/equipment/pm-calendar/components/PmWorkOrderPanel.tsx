"use client";

/**
 * @file PmWorkOrderPanel.tsx
 * @description PM 캘린더 일별 WO 패널 - Work Order 카드 목록
 *
 * 초보자 가이드:
 * 1. **WO 카드**: WO번호, 설비코드/명, 유형/우선순위/상태 배지
 * 2. **실행 버튼**: PLANNED/IN_PROGRESS 상태의 WO만 실행 가능
 * 3. **계획명**: 연결된 PM 계획명 표시
 */

import { useTranslation } from "react-i18next";
import { Clock, Wrench, Play, CheckCircle, XCircle, AlertTriangle, Eye } from "lucide-react";
import { Button, ComCodeBadge } from "@/components/ui";

export interface WoResultItem {
  id: string;
  seq: number;
  itemName: string;
  itemType: string;
  criteria: string | null;
  result: string;
  remark: string | null;
}

export interface WoScheduleItem {
  id: string;
  workOrderNo: string;
  pmPlanId: string | null;
  equipId: string;
  woType: string;
  scheduledDate: string;
  status: string;
  priority: string;
  overallResult: string | null;
  assignedWorkerId: string | null;
  details: string | null;
  remark: string | null;
  completedAt: string | null;
  planName: string | null;
  equip: {
    equipCode: string;
    equipName: string;
    lineCode: string | null;
    equipType: string | null;
  };
  planItems: Array<{
    id: string;
    seq: number;
    itemName: string;
    itemType: string;
    criteria: string | null;
  }>;
  results: WoResultItem[];
}

interface PmWorkOrderPanelProps {
  date: string;
  data: WoScheduleItem[];
  loading: boolean;
  onExecute: (wo: WoScheduleItem) => void;
  onView: (wo: WoScheduleItem) => void;
}

const STATUS_COLORS: Record<string, string> = {
  PLANNED: "border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-900/10",
  IN_PROGRESS: "border-yellow-200 dark:border-yellow-800 bg-yellow-50/50 dark:bg-yellow-900/10",
  COMPLETED: "border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-900/10",
  OVERDUE: "border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-900/10",
  CANCELLED: "border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/30",
};

const STATUS_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  PLANNED: Clock,
  IN_PROGRESS: Wrench,
  COMPLETED: CheckCircle,
  OVERDUE: AlertTriangle,
  CANCELLED: XCircle,
};

export default function PmWorkOrderPanel({ date, data, loading, onExecute, onView }: PmWorkOrderPanelProps) {
  const { t } = useTranslation();

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
    return `${d.getMonth() + 1}/${d.getDate()}(${weekdays[d.getDay()]})`;
  };

  if (loading) {
    return (
      <div className="bg-surface border border-border rounded-lg p-4 h-full">
        <div className="animate-pulse space-y-3">
          <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
          <div className="h-24 bg-gray-200 dark:bg-gray-700 rounded" />
          <div className="h-24 bg-gray-200 dark:bg-gray-700 rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-surface border border-border rounded-lg p-4 h-full overflow-y-auto max-h-[calc(100vh-300px)]">
      <h3 className="text-base font-bold text-text mb-3">
        {formatDate(date)} {t("equipment.pmWorkOrder.woSchedule")}
      </h3>

      {data.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-text-muted">
          <Clock className="w-10 h-10 mb-2 opacity-50" />
          <p className="text-sm">{t("equipment.pmWorkOrder.noWo")}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {data.map((wo) => {
            const StatusIcon = STATUS_ICONS[wo.status] || Clock;
            const canExecute = wo.status === "PLANNED" || wo.status === "IN_PROGRESS" || wo.status === "OVERDUE";

            return (
              <div
                key={wo.id}
                className={`border rounded-lg p-3 transition-colors ${STATUS_COLORS[wo.status] || "border-gray-200 dark:border-gray-700"}`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <StatusIcon className={`w-4 h-4 ${
                      wo.status === "COMPLETED" ? "text-green-500" :
                      wo.status === "OVERDUE" ? "text-red-500" :
                      wo.status === "CANCELLED" ? "text-gray-400" : "text-blue-500"
                    }`} />
                    <span className="font-mono text-xs font-medium text-text">{wo.workOrderNo}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <ComCodeBadge groupCode="PM_WO_STATUS" code={wo.status} />
                    <ComCodeBadge groupCode="PM_PRIORITY" code={wo.priority} />
                  </div>
                </div>

                <div className="mb-2">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="font-mono text-text-muted">{wo.equip.equipCode}</span>
                    <span className="text-text">{wo.equip.equipName}</span>
                  </div>
                  {wo.planName && (
                    <p className="text-xs text-text-muted mt-0.5">
                      {t("equipment.pmWorkOrder.planName")}: {wo.planName}
                    </p>
                  )}
                  {wo.equip.lineCode && (
                    <p className="text-xs text-text-muted">
                      {t("equipment.pmWorkOrder.line")}: {wo.equip.lineCode}
                    </p>
                  )}
                </div>

                {wo.planItems.length > 0 && (
                  <div className="text-xs text-text-muted mb-2">
                    {t("equipment.pmWorkOrder.itemCount", { count: wo.planItems.length })}
                  </div>
                )}

                {wo.overallResult && (
                  <div className="mb-2">
                    <ComCodeBadge groupCode="INSPECT_JUDGE" code={wo.overallResult} />
                  </div>
                )}

                {canExecute ? (
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={() => onExecute(wo)}
                    className="w-full mt-1"
                  >
                    <Play className="w-3.5 h-3.5 mr-1" />
                    {t("equipment.pmWorkOrder.execute")}
                  </Button>
                ) : (wo.status === "COMPLETED" || wo.status === "CANCELLED") ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => onView(wo)}
                    className="w-full mt-1"
                  >
                    <Eye className="w-3.5 h-3.5 mr-1" />
                    {t("common.viewDetail")}
                  </Button>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
