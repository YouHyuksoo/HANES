/**
 * @file src/app/dashboard/page.tsx
 * @description
 * 대시보드 메인 페이지입니다.
 * 생산 현황, 품질 지표 등 핵심 KPI를 표시합니다.
 *
 * 초보자 가이드:
 * 1. **클라이언트 컴포넌트**: 다국어 Hook 사용을 위해 필요
 * 2. **KPI 카드**: 주요 지표를 카드 형태로 표시
 * 3. **추후 확장**: 차트, 실시간 데이터 등 추가 예정
 */

"use client";

import { useTranslation } from "react-i18next";
import {
  Factory,
  AlertTriangle,
  CheckCircle,
  TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";

/** KPI 카드 데이터 타입 */
interface KPICard {
  id: string;
  titleKey: string;
  value: string;
  change?: string;
  changeType?: "positive" | "negative" | "neutral";
  icon: React.ElementType;
  color: string;
}

/** 임시 KPI 데이터 */
const kpiCards: KPICard[] = [
  {
    id: "production",
    titleKey: "dashboard.todayProduction",
    value: "1,234",
    change: "+12%",
    changeType: "positive",
    icon: Factory,
    color: "bg-blue-500",
  },
  {
    id: "defect",
    titleKey: "dashboard.defectRate",
    value: "0.8%",
    change: "-0.2%",
    changeType: "positive",
    icon: AlertTriangle,
    color: "bg-orange-500",
  },
  {
    id: "equipment",
    titleKey: "dashboard.equipmentStatus",
    value: "98%",
    change: "+1%",
    changeType: "positive",
    icon: CheckCircle,
    color: "bg-green-500",
  },
  {
    id: "efficiency",
    titleKey: "dashboard.summary",
    value: "92%",
    change: "+3%",
    changeType: "positive",
    icon: TrendingUp,
    color: "bg-purple-500",
  },
];

export default function DashboardPage() {
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      {/* 페이지 헤더 */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          {t("dashboard.title")}
        </h1>
        <p className="text-muted-foreground mt-1">
          {t("dashboard.welcome")}
        </p>
      </div>

      {/* KPI 카드 그리드 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiCards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.id}
              className={cn(
                "bg-card rounded-xl p-6 border border-border",
                "hover:shadow-md transition-shadow duration-200"
              )}
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">
                    {t(card.titleKey)}
                  </p>
                  <p className="text-2xl font-bold text-card-foreground mt-1">
                    {card.value}
                  </p>
                  {card.change && (
                    <p
                      className={cn(
                        "text-sm mt-1",
                        card.changeType === "positive" && "text-green-500",
                        card.changeType === "negative" && "text-red-500",
                        card.changeType === "neutral" && "text-muted-foreground"
                      )}
                    >
                      {card.change}
                    </p>
                  )}
                </div>
                <div
                  className={cn(
                    "w-10 h-10 rounded-lg flex items-center justify-center",
                    card.color
                  )}
                >
                  <Icon className="w-5 h-5 text-white" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* 최근 활동 섹션 (placeholder) */}
      <div className="bg-card rounded-xl p-6 border border-border">
        <h2 className="text-lg font-semibold text-card-foreground mb-4">
          {t("dashboard.recentActivities")}
        </h2>
        <div className="text-muted-foreground text-center py-12">
          {t("common.noData")}
        </div>
      </div>
    </div>
  );
}
