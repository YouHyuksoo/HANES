"use client";

/**
 * @file src/components/layout/MainLayout.tsx
 * @description 메인 레이아웃 - 헤더 + 사이드바(접기/펴기) + 콘텐츠 영역
 *
 * 초보자 가이드:
 * 1. **구조**: 고정 헤더 + 고정 사이드바 + 스크롤 가능한 메인 영역
 * 2. **반응형**: 모바일에서는 사이드바가 오버레이, 데스크톱에서는 고정
 * 3. **접기/펴기**: collapsed 상태에 따라 사이드바 너비 변경
 */
import { useState } from "react";
import Header from "./Header";
import Sidebar from "./Sidebar";

interface MainLayoutProps {
  children: React.ReactNode;
}

export default function MainLayout({ children }: MainLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      <Header
        onMenuToggle={() => setSidebarOpen(!sidebarOpen)}
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed(!collapsed)}
      />

      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed(!collapsed)}
      />

      <main
        className={`
          pt-[var(--header-height)] min-h-screen transition-all duration-300
          ${collapsed ? "lg:pl-[var(--sidebar-collapsed-width)]" : "lg:pl-[var(--sidebar-width)]"}
        `}
      >
        <div className="p-4 lg:p-6">
          {children}
        </div>
      </main>
    </div>
  );
}
