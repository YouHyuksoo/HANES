"use client";

/**
 * @file src/components/layout/MainLayout.tsx
 * @description 메인 레이아웃 - 헤더 + 사이드바(접기/펴기) + 콘텐츠 영역
 *
 * 초보자 가이드:
 * 1. **구조**: 고정 헤더 + 고정 사이드바 + 스크롤 가능한 메인 영역
 * 2. **반응형**: 모바일에서는 사이드바가 오버레이, 데스크톱에서는 고정
 * 3. **접기/펴기**: collapsed 상태에 따라 사이드바 너비 변경
 * 4. **서버 상태**: API 오류(503 등) 감지 시 ConnectionCheckOverlay 표시
 */
import { useState, useEffect, useCallback, useRef } from "react";
import Header from "./Header";
import Sidebar from "./Sidebar";
import TabBar from "./TabBar";
import KeepAlive from "./KeepAlive";
import ConnectionCheckOverlay from "@/app/login/components/ConnectionCheckOverlay";
import { api } from "@/services/api";

interface MainLayoutProps {
  children: React.ReactNode;
}

export default function MainLayout({ children }: MainLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [showConnectionCheck, setShowConnectionCheck] = useState(false);
  const errorCountRef = useRef(0);

  useEffect(() => {
    const interceptor = api.interceptors.response.use(
      (response) => {
        errorCountRef.current = 0;
        return response;
      },
      (error) => {
        const status = error?.response?.status;
        const isNetworkError = !error.response && error.code !== "ERR_CANCELED";
        const isServerError =
          status === 500 || status === 502 || status === 503 || status === 504;

        if (isNetworkError || isServerError) {
          errorCountRef.current += 1;
          if (errorCountRef.current >= 2) {
            setShowConnectionCheck(true);
          }
        }
        return Promise.reject(error);
      },
    );

    return () => {
      api.interceptors.response.eject(interceptor);
    };
  }, []);

  const handleReady = useCallback(() => {
    errorCountRef.current = 0;
    setShowConnectionCheck(false);
  }, []);

  return (
    <div className="h-screen overflow-hidden bg-background">
      {showConnectionCheck && <ConnectionCheckOverlay onReady={handleReady} />}

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
          pt-[var(--header-height)] h-screen flex flex-col overflow-hidden transition-all duration-300
          ${collapsed ? "lg:pl-[var(--sidebar-collapsed-width)]" : "lg:pl-[var(--sidebar-width)]"}
        `}
      >
        <TabBar />
        <div className="flex-1 min-h-0 overflow-hidden">
          <KeepAlive>{children}</KeepAlive>
        </div>
      </main>
    </div>
  );
}
