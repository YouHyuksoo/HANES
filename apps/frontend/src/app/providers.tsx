/**
 * @file src/app/providers.tsx
 * @description 클라이언트 사이드 Provider 조합 - Theme + QueryClient + Auth
 *
 * 개선사항:
 * 1. ThemeContext 제거 → Zustand themeStore 통합
 * 2. HTML dark 클래스 자동 적용 (ThemeEffect 컴포넌트)
 * 3. system 모드 지원 (OS 설정 연동)
 */

"use client";

import { ReactNode, useEffect, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useAuthStore } from "@/stores/authStore";
import { useComCodes } from "@/hooks/useComCode";
import { useThemeStore, listenSystemThemeChange } from "@/stores/themeStore";
import { useSysConfigStore } from "@/stores/sysConfigStore";
import "@/lib/i18n";

// React Query 클라이언트 설정
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

/** 테마 Effect - HTML 클래스 + 컬러 테마 자동 적용 */
function ThemeEffect() {
  const { theme, colorTheme, setTheme, _resolveTheme } = useThemeStore();

  // 초기 테마 설정 및 HTML 클래스 적용
  useEffect(() => {
    const resolved = _resolveTheme(theme);
    const root = document.documentElement;

    root.classList.remove("light", "dark");
    root.classList.add(resolved);

    // store의 resolvedTheme 동기화
    if (useThemeStore.getState().resolvedTheme !== resolved) {
      useThemeStore.setState({ resolvedTheme: resolved });
    }
  }, [theme, _resolveTheme]);

  // 컬러 테마 적용
  useEffect(() => {
    const root = document.documentElement;
    if (colorTheme === "default") {
      root.removeAttribute("data-color-theme");
    } else {
      root.setAttribute("data-color-theme", colorTheme);
    }
  }, [colorTheme]);

  // system 모드일 때 OS 테마 변경 감지
  useEffect(() => {
    if (theme !== "system") return;
    
    return listenSystemThemeChange((resolved) => {
      const root = document.documentElement;
      root.classList.remove("light", "dark");
      root.classList.add(resolved);
      useThemeStore.setState({ resolvedTheme: resolved });
    });
  }, [theme]);

  return null;
}

/** 인증 상태 초기화 */
function AuthInitializer() {
  const { fetchMe, isAuthenticated } = useAuthStore();

  useEffect(() => {
    if (isAuthenticated) {
      fetchMe();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}

/** 공통코드 프리페치 - 인증된 상태에서만 호출 */
function ComCodePrefetch() {
  const { isAuthenticated } = useAuthStore();
  useComCodes(isAuthenticated);
  return null;
}

/** 환경설정 프리페치 - 인증된 상태에서만 호출 */
function SysConfigPrefetch() {
  const { isAuthenticated } = useAuthStore();
  const { fetchConfigs, isLoaded } = useSysConfigStore();
  useEffect(() => {
    if (isAuthenticated && !isLoaded) {
      fetchConfigs();
    }
  }, [isAuthenticated, isLoaded, fetchConfigs]);
  return null;
}

/** HTML lang 속성 동기화 */
function LanguageSync() {
  const { i18n } = useTranslation();
  useEffect(() => {
    document.documentElement.lang = i18n.language;
  }, [i18n.language]);
  return null;
}

interface ProvidersProps {
  children: ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // hydration mismatch 방지 (초기 렌더링 시 테마 클래스 없음)
  if (!mounted) {
    return (
      <div style={{ visibility: "hidden" }}>{children}</div>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeEffect />
      <AuthInitializer />
      <ComCodePrefetch />
      <SysConfigPrefetch />
      <LanguageSync />
      {children}
    </QueryClientProvider>
  );
}
