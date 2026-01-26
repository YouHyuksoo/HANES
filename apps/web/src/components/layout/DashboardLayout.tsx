/**
 * @file src/components/layout/DashboardLayout.tsx
 * @description
 * 대시보드 전체 레이아웃 컴포넌트입니다.
 * 사이드바, 헤더, 메인 콘텐츠 영역을 조합합니다.
 *
 * 초보자 가이드:
 * 1. **레이아웃 구조**: 사이드바(왼쪽) + 헤더(상단) + 콘텐츠(중앙)
 * 2. **반응형**: 모바일에서 사이드바 접힘
 * 3. **컴포넌트 조합**: Header, Sidebar를 조합하여 레이아웃 구성
 */

"use client";

import { useState, ReactNode } from "react";
import { DashboardHeader } from "./DashboardHeader";
import { DashboardSidebar } from "./DashboardSidebar";
import { cn } from "@/lib/utils";

interface DashboardLayoutProps {
  children: ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const toggleSidebar = () => {
    setSidebarCollapsed((prev) => !prev);
  };

  return (
    <div className="h-screen flex bg-background">
      {/* 사이드바 */}
      <DashboardSidebar collapsed={sidebarCollapsed} />

      {/* 메인 영역 */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* 헤더 */}
        <DashboardHeader onToggleSidebar={toggleSidebar} />

        {/* 콘텐츠 영역 */}
        <main
          className={cn(
            "flex-1 overflow-auto p-6",
            "bg-background"
          )}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
