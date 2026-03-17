"use client";

/**
 * @file src/app/(authenticated)/system/scheduler/page.tsx
 * @description 스케줄러 관리 메인 페이지 (3-탭 구조)
 *
 * 초보자 가이드:
 * 1. **작업 관리 탭**: 스케줄러 작업 CRUD + 즉시실행/토글
 * 2. **실행 이력 탭**: 실행 로그 목록 + 상세 모달
 * 3. **대시보드 탭**: 통계카드 + 차트 + 최근 실패 테이블
 */

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Timer, List, BarChart3 } from "lucide-react";
import SchedulerJobTab from "./components/SchedulerJobTab";
import SchedulerLogTab from "./components/SchedulerLogTab";
import SchedulerDashboardTab from "./components/SchedulerDashboardTab";

type TabValue = "jobs" | "logs" | "dashboard";

export default function SchedulerPage() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<TabValue>("jobs");

  const tabs: { key: TabValue; label: string; icon: React.ReactNode }[] = [
    { key: "jobs", label: t("scheduler.jobs"), icon: <Timer className="w-4 h-4" /> },
    { key: "logs", label: t("scheduler.logs"), icon: <List className="w-4 h-4" /> },
    { key: "dashboard", label: t("scheduler.dashboard"), icon: <BarChart3 className="w-4 h-4" /> },
  ];

  return (
    <div className="h-full flex flex-col overflow-hidden p-6 gap-4 animate-fade-in">
      {/* 헤더 */}
      <div className="flex-shrink-0">
        <h1 className="text-xl font-bold text-text flex items-center gap-2">
          <Timer className="w-7 h-7 text-primary" />
          {t("scheduler.title")}
        </h1>
      </div>

      {/* 탭 네비게이션 */}
      <div className="border-b border-border flex-shrink-0">
        <div className="flex gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.key
                  ? "border-primary text-primary"
                  : "border-transparent text-text-muted hover:text-text hover:border-border"
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* 탭 컨텐츠 */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {activeTab === "jobs" && <SchedulerJobTab />}
        {activeTab === "logs" && <SchedulerLogTab />}
        {activeTab === "dashboard" && <SchedulerDashboardTab />}
      </div>
    </div>
  );
}
