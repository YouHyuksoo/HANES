/**
 * @file src/app/providers.tsx
 * @description 클라이언트 사이드 Provider 조합 - Theme + QueryClient + Auth
 *
 * 초보자 가이드:
 * 1. **QueryClientProvider**: React Query 전역 상태 관리
 * 2. **ThemeProvider**: 다크모드 지원
 * 3. **AuthInitializer**: 앱 시작 시 토큰 검증
 * 4. **ComCodePrefetch**: 공통코드 프리페치
 */

"use client";

import { ReactNode, useEffect, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { useAuthStore } from "@/stores/authStore";
import { useComCodes } from "@/hooks/useComCode";
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

  if (!mounted) {
    return (
      <ThemeProvider defaultTheme="system">
        <div style={{ visibility: "hidden" }}>{children}</div>
      </ThemeProvider>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="system">
        <AuthInitializer />
        <ComCodePrefetch />
        <LanguageSync />
        {children}
      </ThemeProvider>
    </QueryClientProvider>
  );
}
