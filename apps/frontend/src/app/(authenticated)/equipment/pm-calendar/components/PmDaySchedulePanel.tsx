"use client";

/**
 * @file PmDaySchedulePanel.tsx
 * @description 예방보전 캘린더 일별 상세 패널 - 교체 예정 소모품 목록
 *
 * 초보자 가이드:
 * 1. **소모품 카드**: 코드, 이름, 카테고리, 수명 진행률 표시
 * 2. **상태 색상**: NORMAL(초록), WARNING(노랑), REPLACE(빨강)
 * 3. **진행률 바**: currentCount / expectedLife
 */

import { useTranslation } from "react-i18next";
import { Clock, Wrench, AlertTriangle, XCircle } from "lucide-react";
import { ComCodeBadge } from "@/components/ui";

export interface PmScheduleItem {
  id: string;
  consumableCode: string;
  consumableName: string;
  category: string;
  status: string;
  currentCount: number;
  expectedLife: number;
  warningCount: number;
  mountedEquipId: string | null;
  location: string | null;
  nextReplaceAt: string | null;
}

interface PmDaySchedulePanelProps {
  date: string;
  data: PmScheduleItem[];
  loading: boolean;
}

const STATUS_COLORS: Record<string, string> = {
  NORMAL: "border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-900/10",
  WARNING: "border-yellow-200 dark:border-yellow-800 bg-yellow-50/50 dark:bg-yellow-900/10",
  REPLACE: "border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-900/10",
};

const STATUS_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  NORMAL: Wrench,
  WARNING: AlertTriangle,
  REPLACE: XCircle,
};

export default function PmDaySchedulePanel({ date, data, loading }: PmDaySchedulePanelProps) {
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
          <div className="h-20 bg-gray-200 dark:bg-gray-700 rounded" />
          <div className="h-20 bg-gray-200 dark:bg-gray-700 rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-surface border border-border rounded-lg p-4 h-full overflow-y-auto max-h-[calc(100vh-300px)]">
      <h3 className="text-base font-bold text-text mb-3">
        {formatDate(date)} {t("equipment.pmCalendar.replaceSchedule")}
      </h3>

      {data.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-text-muted">
          <Clock className="w-10 h-10 mb-2 opacity-50" />
          <p className="text-sm">{t("equipment.pmCalendar.noSchedule")}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {data.map((item) => {
            const pct = item.expectedLife > 0
              ? Math.min(Math.round((item.currentCount / item.expectedLife) * 100), 100)
              : 0;
            const StatusIcon = STATUS_ICONS[item.status] || Wrench;
            const barColor = pct >= 90 ? "bg-red-500" : pct >= 70 ? "bg-yellow-500" : "bg-green-500";

            return (
              <div
                key={item.id}
                className={`border rounded-lg p-3 transition-colors ${STATUS_COLORS[item.status] || "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900"}`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <StatusIcon className={`w-5 h-5 ${
                      item.status === "REPLACE" ? "text-red-500" :
                      item.status === "WARNING" ? "text-yellow-500" : "text-green-500"
                    }`} />
                    <div>
                      <span className="font-mono text-sm font-medium text-text">{item.consumableCode}</span>
                      <span className="text-sm text-text-muted ml-2">{item.consumableName}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <ComCodeBadge groupCode="CONSUMABLE_CATEGORY" code={item.category} />
                    <ComCodeBadge groupCode="CONSUMABLE_STATUS" code={item.status} />
                  </div>
                </div>

                {/* Life progress bar */}
                <div className="mt-2">
                  <div className="flex items-center justify-between text-xs text-text-muted mb-1">
                    <span>{t("equipment.pmCalendar.lifeUsage")}</span>
                    <span>{item.currentCount.toLocaleString()} / {item.expectedLife.toLocaleString()} ({pct}%)</span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all ${barColor}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>

                {item.location && (
                  <p className="text-xs text-text-muted mt-2">
                    {t("equipment.pmCalendar.location")}: {item.location}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
