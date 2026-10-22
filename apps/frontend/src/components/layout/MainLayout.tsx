"use client";

/**
 * @file src/components/layout/MainLayout.tsx
 * @description 메인 레이아웃. 앱 틀(헤더 + 사이드바 + 탭 + keep-alive 본문)은 공용 UI 패키지(@jisheng/ui)의 AppShell 이고,
 * 여기서는 HANES 메뉴·즐겨찾기·탭 설정과 HANES 전용 표시를 넘긴다.
 *
 * 초보자 가이드:
 * 1. **메뉴/권한**: useMenuTree (DB 정렬 + 역할 권한, 권한 없는 메뉴는 흐리게)
 * 2. **탭 유지**: pageRegistry.generated 의 getPageComponent
 * 3. **HANES 전용 표시**: 스캐너·프린트 에이전트, 회사/사업장·접속 DB 배지, 내 정보 모달
 * 4. **서버 상태**: API 오류(503 등) 감지 시 ConnectionCheckOverlay 표시
 * 5. **chromeless**: 키오스크 작업화면·view=full 은 헤더/사이드바/탭 없이 본문만
 */
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import { BookOpen, Settings, User } from "lucide-react";
import { AppShell, HeaderMenuItem, type AppShellConfig } from "@jisheng/ui";
import ConnectionCheckOverlay from "@/app/login/components/ConnectionCheckOverlay";
import { api } from "@/services/api";
import ImprovementFAB from "@/components/improvement/ImprovementFAB";
import AiChatPanel from "@/components/ai/AiChatPanel";
import HelpPanel from "@/components/help/HelpPanel";
import HelpButton from "@/components/help/HelpButton";
import { menuConfig } from "@/config/menuConfig";
import { useMenuTree } from "@/hooks/useMenuTree";
import { useMenuFavorites } from "@/hooks/useMenuFavorites";
import { useMenuFavoriteFolders } from "@/hooks/useMenuFavoriteFolders";
import { useMaxTabs } from "@/stores/tabStore";
import { useAuthStore } from "@/stores/authStore";
import { I18N_LANGUAGE_STORAGE_KEY, supportedLanguages } from "@/lib/i18n";
import { getPageComponent } from "./pageRegistry.generated";
import SerialIndicator from "./SerialIndicator";
import PrintAgentIndicator from "./PrintAgentIndicator";
import HanesScopeBadge from "./HanesScopeBadge";
import HanesProfileModal from "./HanesProfileModal";

interface MainLayoutProps {
  children: React.ReactNode;
}

/** 렌더마다 바뀌지 않는 HANES 앱 틀 설정 */
const HANES_SHELL_BASE = {
  brand: { mark: "H", name: "HARNESS MES" },
  menuConfig,
  useMenu: useMenuTree,
  useFavorites: useMenuFavorites,
  useFavoriteFolders: useMenuFavoriteFolders,
  useMaxTabs,
  getPageComponent,
  sidebarSections: {
    pinned: { codes: ["WORKFLOW", "MONITORING"], labelKeys: ["menu.workflow", "menu.monitoring"] },
    /**
     * 하단 고정 영역(전체 도움말 위)으로 분리하는 관리자 성격 메뉴 그룹.
     * 시나리오 런너도 여기 둔다 — 업무 메뉴가 아니라 절차를 대신 실행하는 운영 도구이고,
     * "인터페이스 바로 위"라는 자리 자체가 이 고정 영역 안이다(순서는 SORT_ORDER 155 < 160).
     */
    admin: { codes: ["SCENARIO", "INTERFACE", "SYSTEM"], labelKeys: ["menu.interface", "menu.system"] },
  },
  defaultExpandedCodes: ["DASHBOARD", "FAVORITES"],
  helpMenu: { code: "HELP_INDEX", labelKey: "help.viewAll", path: "/help", icon: BookOpen },
  languages: supportedLanguages,
  languageStorageKey: I18N_LANGUAGE_STORAGE_KEY,
} satisfies Partial<AppShellConfig>;

export default function MainLayout({ children }: MainLayoutProps) {
  const { t } = useTranslation();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const [showConnectionCheck, setShowConnectionCheck] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const errorCountRef = useRef(0);

  const isKioskWorkView =
    (pathname === "/production/input-kiosk" || pathname === "/production/input-kiosk-b") && searchParams.get("view") === "work";
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

  const handleLogout = useCallback(() => {
    logout();
    router.replace("/login");
  }, [logout, router]);

  const config = useMemo<AppShellConfig>(() => ({
    ...HANES_SHELL_BASE,
    user,
    onLogout: handleLogout,
    chromeless: isChromeless,
    headerIndicators: (
      <>
        {/* 바코드 스캐너 연결 상태 */}
        <SerialIndicator />
        {/* 라벨 프린트 에이전트 연결/다운로드 */}
        <PrintAgentIndicator />
        {/* 알림 벨(NotificationBell)은 폴링 부하/오류 리포트 노이즈로 임시 비활성화. 재활성화 시 여기에 넣는다 */}
      </>
    ),
    helpButton: <HelpButton />,
    scopeBadge: <HanesScopeBadge />,
    userMenuItems: (close) => (
      <>
        <HeaderMenuItem icon={User} onClick={() => { close(); setShowProfileModal(true); }}>
          {t("header.profile")}
        </HeaderMenuItem>
        <HeaderMenuItem icon={Settings}>{t("header.settings")}</HeaderMenuItem>
      </>
    ),
    overlays: (
      <>
        {showConnectionCheck && <ConnectionCheckOverlay onReady={handleReady} />}
        <HanesProfileModal isOpen={showProfileModal} onClose={() => setShowProfileModal(false)} />
        <ImprovementFAB />
        <AiChatPanel />
        <HelpPanel />
      </>
    ),
  }), [user, handleLogout, isChromeless, t, showConnectionCheck, handleReady, showProfileModal]);

  return <AppShell config={config}>{children}</AppShell>;
}
