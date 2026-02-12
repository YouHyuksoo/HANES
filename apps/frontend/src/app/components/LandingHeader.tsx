"use client";

/**
 * @file src/app/components/LandingHeader.tsx
 * @description 랜딩페이지 상단 네비게이션 - 로고, 로그인/대시보드 버튼
 *
 * 초보자 가이드:
 * 1. **인증 상태에 따라** 버튼 텍스트가 변경됨 (로그인 / 대시보드)
 * 2. **스크롤 시** 배경색 변경으로 가독성 확보
 */

import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Factory, LogIn, LayoutDashboard } from "lucide-react";
import Link from "next/link";
import LanguageSwitcher from "@/components/layout/LanguageSwitcher";

interface LandingHeaderProps {
  isAuthenticated: boolean;
  onNavigate: () => void;
}

export default function LandingHeader({ isAuthenticated, onNavigate }: LandingHeaderProps) {
  const { t } = useTranslation();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header
      className={`
        fixed top-0 left-0 right-0 z-50
        transition-all duration-300
        ${scrolled
          ? "bg-background/95 backdrop-blur-md border-b border-border shadow-sm"
          : "bg-transparent"
        }
      `}
    >
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-3 group">
          <div className="w-9 h-9 bg-primary rounded-lg flex items-center justify-center
                          group-hover:scale-105 transition-transform">
            <Factory className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-lg text-text">HARNESS MES</span>
        </Link>

        {/* 우측 액션 */}
        <div className="flex items-center gap-2">
          <LanguageSwitcher />
          <button
            onClick={onNavigate}
            className="
              flex items-center gap-2 px-5 py-2.5
              bg-primary text-white rounded-lg
              text-sm font-medium
              hover:bg-primary-hover active:scale-95
              transition-all duration-200
            "
          >
            {isAuthenticated ? (
              <>
                <LayoutDashboard className="w-4 h-4" />
                {t('landing.dashboard')}
              </>
            ) : (
              <>
                <LogIn className="w-4 h-4" />
                {t('landing.login')}
              </>
            )}
          </button>
        </div>
      </div>
    </header>
  );
}
