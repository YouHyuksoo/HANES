/**
 * @file src/components/layout/DashboardHeader.tsx
 * @description
 * 대시보드 헤더 컴포넌트입니다.
 * 테마 토글, 언어 전환, 사용자 메뉴를 포함합니다.
 *
 * 초보자 가이드:
 * 1. **테마 토글**: 라이트/다크 모드 전환 버튼
 * 2. **언어 전환**: 한국어/영어/베트남어 드롭다운
 * 3. **사용자 메뉴**: 프로필, 로그아웃 등
 */

"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Moon, Sun, Globe, Menu, Bell, User } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { supportedLanguages, type LanguageCode } from "@/lib/i18n";
import { cn } from "@/lib/utils";

interface DashboardHeaderProps {
  onToggleSidebar?: () => void;
}

export function DashboardHeader({ onToggleSidebar }: DashboardHeaderProps) {
  const { t, i18n } = useTranslation();
  const { resolvedTheme, toggleTheme } = useTheme();
  const [showLangMenu, setShowLangMenu] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  // 언어 변경 핸들러
  const handleLanguageChange = (langCode: LanguageCode) => {
    i18n.changeLanguage(langCode);
    setShowLangMenu(false);
  };

  // 현재 언어 정보
  const currentLang = supportedLanguages.find(
    (lang) => lang.code === i18n.language
  ) || supportedLanguages[0];

  return (
    <header className="h-16 bg-card border-b border-border flex items-center justify-between px-4">
      {/* 좌측: 사이드바 토글 */}
      <div className="flex items-center gap-4">
        <button
          onClick={onToggleSidebar}
          className={cn(
            "p-2 rounded-lg",
            "text-muted-foreground hover:text-foreground",
            "hover:bg-muted transition-colors"
          )}
          aria-label="Toggle sidebar"
        >
          <Menu className="w-5 h-5" />
        </button>
      </div>

      {/* 우측: 테마, 언어, 알림, 사용자 */}
      <div className="flex items-center gap-2">
        {/* 테마 토글 */}
        <button
          onClick={toggleTheme}
          className={cn(
            "p-2 rounded-lg",
            "text-muted-foreground hover:text-foreground",
            "hover:bg-muted transition-colors"
          )}
          aria-label={t("header.theme")}
        >
          {resolvedTheme === "dark" ? (
            <Sun className="w-5 h-5" />
          ) : (
            <Moon className="w-5 h-5" />
          )}
        </button>

        {/* 언어 선택 */}
        <div className="relative">
          <button
            onClick={() => setShowLangMenu(!showLangMenu)}
            className={cn(
              "flex items-center gap-2 px-3 py-2 rounded-lg",
              "text-muted-foreground hover:text-foreground",
              "hover:bg-muted transition-colors"
            )}
            aria-label={t("header.language")}
          >
            <Globe className="w-5 h-5" />
            <span className="text-sm hidden sm:inline">{currentLang.name}</span>
          </button>

          {/* 언어 드롭다운 */}
          {showLangMenu && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setShowLangMenu(false)}
              />
              <div className="absolute right-0 top-full mt-1 z-50 bg-popover border border-border rounded-lg shadow-lg py-1 min-w-[140px]">
                {supportedLanguages.map((lang) => (
                  <button
                    key={lang.code}
                    onClick={() => handleLanguageChange(lang.code)}
                    className={cn(
                      "w-full flex items-center gap-2 px-4 py-2 text-sm",
                      "hover:bg-muted transition-colors",
                      i18n.language === lang.code
                        ? "text-primary font-medium"
                        : "text-popover-foreground"
                    )}
                  >
                    <span>{lang.flag}</span>
                    <span>{lang.name}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* 알림 */}
        <button
          className={cn(
            "p-2 rounded-lg relative",
            "text-muted-foreground hover:text-foreground",
            "hover:bg-muted transition-colors"
          )}
          aria-label={t("header.notifications")}
        >
          <Bell className="w-5 h-5" />
          {/* 알림 뱃지 */}
          <span className="absolute top-1 right-1 w-2 h-2 bg-destructive rounded-full" />
        </button>

        {/* 사용자 메뉴 */}
        <div className="relative">
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className={cn(
              "flex items-center gap-2 px-3 py-2 rounded-lg",
              "text-muted-foreground hover:text-foreground",
              "hover:bg-muted transition-colors"
            )}
          >
            <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
              <User className="w-4 h-4 text-primary-foreground" />
            </div>
          </button>

          {/* 사용자 드롭다운 */}
          {showUserMenu && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setShowUserMenu(false)}
              />
              <div className="absolute right-0 top-full mt-1 z-50 bg-popover border border-border rounded-lg shadow-lg py-1 min-w-[160px]">
                <button
                  className={cn(
                    "w-full flex items-center gap-2 px-4 py-2 text-sm",
                    "text-popover-foreground hover:bg-muted transition-colors"
                  )}
                >
                  {t("header.profile")}
                </button>
                <hr className="my-1 border-border" />
                <button
                  className={cn(
                    "w-full flex items-center gap-2 px-4 py-2 text-sm",
                    "text-destructive hover:bg-muted transition-colors"
                  )}
                >
                  {t("header.logout")}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
