"use client";

/**
 * @file src/components/pda/PdaHeader.tsx
 * @description PDA 전용 헤더 - 뒤로가기 + 타이틀 + 사용자명 + 설정
 *
 * 초보자 가이드:
 * 1. **뒤로가기**: 메뉴 경로로 router.push
 * 2. **타이틀**: 현재 페이지 이름 (i18n)
 * 3. **사용자명**: authStore.user.name
 * 4. **설정**: /pda/settings 이동
 */
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { ArrowLeft, Settings, LogOut } from "lucide-react";
import { useAuthStore } from "@/stores/authStore";

interface PdaHeaderProps {
  /** 페이지 타이틀 i18n 키 */
  titleKey: string;
  /** 뒤로가기 경로 (기본: /pda/menu) */
  backPath?: string;
  /** 뒤로가기 버튼 숨김 (메인 메뉴에서 사용) */
  hideBack?: boolean;
}

export default function PdaHeader({
  titleKey,
  backPath = "/pda/menu",
  hideBack = false,
}: PdaHeaderProps) {
  const router = useRouter();
  const { t } = useTranslation();
  const { user, logout } = useAuthStore();

  const handleBack = () => {
    router.push(backPath);
  };

  const handleLogout = () => {
    logout();
    router.replace("/login");
  };

  return (
    <header className="sticky top-0 z-40 flex items-center h-14 px-3 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 shadow-sm">
      {/* 뒤로가기 */}
      {!hideBack ? (
        <button
          onClick={handleBack}
          className="flex items-center justify-center w-9 h-9 -ml-1 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 active:bg-slate-200 dark:active:bg-slate-700 transition-colors"
          aria-label={t("common.back")}
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
      ) : (
        <div className="w-9" />
      )}

      {/* 타이틀 */}
      <h1 className="flex-1 text-center text-base font-bold text-slate-900 dark:text-white truncate mx-2">
        {t(titleKey)}
      </h1>

      {/* 우측 액션 */}
      <div className="flex items-center gap-1">
        {/* 사용자명 */}
        <span className="text-xs text-slate-500 dark:text-slate-400 mr-1 hidden min-[360px]:inline">
          {user?.name || user?.email?.split("@")[0] || ""}
        </span>

        {/* 메인 메뉴에서만 설정/로그아웃 표시 */}
        {hideBack && (
          <>
            <button
              onClick={() => router.push("/pda/settings")}
              className="flex items-center justify-center w-9 h-9 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 active:bg-slate-200 transition-colors"
              aria-label={t("pda.menu.settings")}
            >
              <Settings className="w-5 h-5" />
            </button>
            <button
              onClick={handleLogout}
              className="flex items-center justify-center w-9 h-9 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 active:bg-red-100 transition-colors"
              aria-label={t("auth.logout")}
            >
              <LogOut className="w-5 h-5" />
            </button>
          </>
        )}
      </div>
    </header>
  );
}
