"use client";

/**
 * @file DaySchedulePanel.tsx
 * @description 날짜별 설비 점검 목록 패널 - 선택한 날짜의 설비별 점검 현황 표시
 *
 * 초보자 가이드:
 * 1. **DayScheduleEquip**: 설비별 점검 스케줄 (items 배열 포함)
 * 2. **상태 표시**: 합격(초록), 불합격(빨강), 미점검(회색)
 * 3. **점검 실행 버튼**: 미점검 설비에 표시, 클릭 시 InspectExecuteModal 오픈
 */

import { useTranslation } from "react-i18next";
import { CheckCircle, XCircle, Clock, PlayCircle, Pencil } from "lucide-react";
import { Button } from "@/components/ui";

export interface DayScheduleItem {
  itemId: string;
  seq: number;
  itemName: string;
  criteria: string | null;
  cycle: string;
  result: string | null;
  remark: string;
}

export interface DayScheduleEquip {
  equipId: string;
  equipCode: string;
  equipName: string;
  lineCode: string | null;
  equipType: string | null;
  inspected: boolean;
  overallResult: string | null;
  inspectorName: string | null;
  logId: string | null;
  items: DayScheduleItem[];
}

interface DaySchedulePanelProps {
  date: string;
  data: DayScheduleEquip[];
  loading: boolean;
  onExecuteInspect: (equip: DayScheduleEquip) => void;
  inspectTitleKey?: string;
}

export default function DaySchedulePanel({
  date, data, loading, onExecuteInspect, inspectTitleKey = "equipment.inspectCalendar.inspectTitle",
}: DaySchedulePanelProps) {
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
        {formatDate(date)} {t(inspectTitleKey)}
      </h3>

      {data.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-text-muted">
          <Clock className="w-10 h-10 mb-2 opacity-50" />
          <p className="text-sm">{t("equipment.inspectCalendar.noInspection")}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {data.map((equip) => (
            <div
              key={equip.equipId}
              className={`border rounded-lg p-3 transition-colors ${
                equip.inspected
                  ? equip.overallResult === "PASS"
                    ? "border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-900/10"
                    : "border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-900/10"
                  : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900"
              }`}
            >
              {/* Equip header */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  {equip.inspected ? (
                    equip.overallResult === "PASS" ? (
                      <CheckCircle className="w-5 h-5 text-green-500" />
                    ) : (
                      <XCircle className="w-5 h-5 text-red-500" />
                    )
                  ) : (
                    <Clock className="w-5 h-5 text-gray-400" />
                  )}
                  <div>
                    <span className="font-mono text-sm font-medium text-text">{equip.equipCode}</span>
                    <span className="text-sm text-text-muted ml-2">{equip.equipName}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {equip.inspected ? (
                    <>
                      <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                        equip.overallResult === "PASS"
                          ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                          : "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"
                      }`}>
                        {equip.overallResult === "PASS"
                          ? t("equipment.inspectCalendar.pass")
                          : t("equipment.inspectCalendar.fail")}
                      </span>
                      <Button size="sm" variant="ghost" onClick={() => onExecuteInspect(equip)}>
                        <Pencil className="w-3.5 h-3.5 mr-1" />
                        {t("common.edit")}
                      </Button>
                    </>
                  ) : (
                    <Button size="sm" variant="secondary" onClick={() => onExecuteInspect(equip)}>
                      <PlayCircle className="w-4 h-4 mr-1" />
                      {t("equipment.inspectCalendar.executeInspect")}
                    </Button>
                  )}
                </div>
              </div>

              {/* Item results */}
              <div className="flex flex-wrap gap-1.5">
                {equip.items.map((item) => (
                  <span
                    key={item.itemId}
                    className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded ${
                      item.result === "PASS"
                        ? "bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300"
                        : item.result === "FAIL"
                        ? "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300"
                        : "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400"
                    }`}
                    title={item.criteria || ""}
                  >
                    {item.result === "PASS" ? "✅" : item.result === "FAIL" ? "❌" : "⏳"}
                    {item.itemName}
                  </span>
                ))}
              </div>

              {equip.inspectorName && (
                <p className="text-xs text-text-muted mt-2">
                  {t("equipment.inspectCalendar.inspectorName")}: {equip.inspectorName}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
