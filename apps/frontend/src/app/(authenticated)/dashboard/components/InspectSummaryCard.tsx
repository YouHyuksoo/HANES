"use client";

/**
 * @file InspectSummaryCard.tsx
 * @description 대시보드 점검 요약 카드 — 오늘 일상/정기/예방점검 현황을 표시
 *
 * 초보자 가이드:
 * 1. **title**: 카드 제목 (일상점검 / 정기점검 / 예방보전)
 * 2. **items**: 설비별 점검 현황 목록
 * 3. **결과 배지**: PASS(초록), FAIL(빨강), CONDITIONAL(노랑), 미실시(회색)
 * 4. **링크**: 제목 클릭 시 해당 캘린더 페이지로 이동
 */

import { useTranslation } from "react-i18next";
import { useRouter } from "next/navigation";
import {
  CheckCircle, XCircle, AlertTriangle, Clock,
  ChevronRight,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui";

export interface InspectItem {
  equipCode: string;
  equipName: string;
  result: string | null;
  inspectorName?: string | null;
  lineCode?: string | null;
}

interface Props {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  iconColor: string;
  items: InspectItem[];
  total: number;
  completed: number;
  pass: number;
  fail: number;
  loading?: boolean;
  linkPath: string;
}

const resultConfig: Record<string, { icon: typeof CheckCircle; color: string; bgColor: string }> = {
  PASS: { icon: CheckCircle, color: "text-green-600 dark:text-green-400", bgColor: "bg-green-50 dark:bg-green-900/20" },
  FAIL: { icon: XCircle, color: "text-red-600 dark:text-red-400", bgColor: "bg-red-50 dark:bg-red-900/20" },
  CONDITIONAL: { icon: AlertTriangle, color: "text-yellow-600 dark:text-yellow-400", bgColor: "bg-yellow-50 dark:bg-yellow-900/20" },
  COMPLETED: { icon: CheckCircle, color: "text-green-600 dark:text-green-400", bgColor: "bg-green-50 dark:bg-green-900/20" },
};

export default function InspectSummaryCard({
  title, icon: Icon, iconColor, items, total, completed, pass, fail,
  loading, linkPath,
}: Props) {
  const { t } = useTranslation();
  const router = useRouter();

  const rate = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <Card className="flex flex-col h-full">
      <CardContent>
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className={`p-1.5 rounded-md ${iconColor}`}>
              <Icon className="w-4 h-4 text-white" />
            </div>
            <h3 className="text-sm font-bold text-text">{title}</h3>
          </div>
          <button
            onClick={() => router.push(linkPath)}
            className="flex items-center gap-0.5 text-xs text-primary hover:text-primary/80 font-medium"
          >
            {t("common.viewMore", "더보기")}
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-4 gap-2 mb-3">
          <div className="text-center p-1.5 bg-surface rounded-lg">
            <p className="text-lg font-bold text-text">{total}</p>
            <p className="text-[10px] text-text-muted">{t("common.total")}</p>
          </div>
          <div className="text-center p-1.5 bg-surface rounded-lg">
            <p className="text-lg font-bold text-blue-600 dark:text-blue-400">{completed}</p>
            <p className="text-[10px] text-text-muted">{t("dashboard.inspect.completed", "완료")}</p>
          </div>
          <div className="text-center p-1.5 bg-surface rounded-lg">
            <p className="text-lg font-bold text-green-600 dark:text-green-400">{pass}</p>
            <p className="text-[10px] text-text-muted">{t("dashboard.inspect.pass", "합격")}</p>
          </div>
          <div className="text-center p-1.5 bg-surface rounded-lg">
            <p className="text-lg font-bold text-red-600 dark:text-red-400">{fail}</p>
            <p className="text-[10px] text-text-muted">{t("dashboard.inspect.fail", "불합격")}</p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mb-3">
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-text-muted">{t("dashboard.inspect.progress", "진행률")}</span>
            <span className="font-medium text-text">{rate}%</span>
          </div>
          <div className="w-full h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${fail > 0 ? "bg-red-500" : "bg-green-500"}`}
              style={{ width: `${rate}%` }}
            />
          </div>
        </div>

        {/* Items list */}
        {loading ? (
          <div className="flex items-center justify-center py-6">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-4 text-xs text-text-muted">
            {t("dashboard.inspect.noData", "오늘 점검 대상이 없습니다.")}
          </div>
        ) : (
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {items.map((item, idx) => {
              const cfg = item.result ? resultConfig[item.result] : null;
              const ResultIcon = cfg?.icon || Clock;
              const colorCls = cfg?.color || "text-gray-400 dark:text-gray-500";
              const bgCls = cfg?.bgColor || "bg-gray-50 dark:bg-gray-800/50";
              return (
                <div key={idx} className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg ${bgCls}`}>
                  <div className="flex items-center gap-2 min-w-0">
                    <ResultIcon className={`w-3.5 h-3.5 flex-shrink-0 ${colorCls}`} />
                    <span className="text-xs font-mono font-medium text-text truncate">{item.equipCode}</span>
                    <span className="text-xs text-text-muted truncate">{item.equipName}</span>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {item.inspectorName && (
                      <span className="text-[10px] text-text-muted">{item.inspectorName}</span>
                    )}
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${colorCls}`}>
                      {item.result
                        ? t(`comCode.INSPECT_JUDGE.${item.result}`, { defaultValue: item.result })
                        : t("dashboard.inspect.notDone", "미실시")}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
