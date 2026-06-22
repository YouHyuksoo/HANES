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
import { usePathname, useSearchParams } from "next/navigation";
import Header from "./Header";
import Sidebar from "./Sidebar";
import TabBar from "./TabBar";
import TabKeepAlive from "./TabKeepAlive";
import ConnectionCheckOverlay from "@/app/login/components/ConnectionCheckOverlay";
import { api } from "@/services/api";
import ImprovementFAB from "@/components/improvement/ImprovementFAB";
import AiChatPanel from "@/components/ai/AiChatPanel";
import HelpPanel from "@/components/help/HelpPanel";

interface MainLayoutProps {
  children: React.ReactNode;
}

export default function MainLayout({ children }: MainLayoutProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [showConnectionCheck, setShowConnectionCheck] = useState(false);
  const errorCountRef = useRef(0);
  const isKioskWorkView =
    pathname === "/production/input-kiosk" && searchParams.get("view") === "work";
  /** view=full: 헤더/사이드바/탭을 모두 숨기는 전체화면(chromeless) 모드 — 검사 키오스크 등 */
  const isFullscreenView = searchParams.get("view") === "full";
  const isChromeless = isKioskWorkView || isFullscreenView;

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

      {isChromeless ? (
        <main className="h-screen overflow-hidden bg-background">
          {children}
        </main>
      ) : (
        <>
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
              <TabKeepAlive>{children}</TabKeepAlive>
            </div>
          </main>
        </>
      )}

      <ImprovementFAB />
      <AiChatPanel />
      <HelpPanel />
    </div>
  );
}
