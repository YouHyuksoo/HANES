/**
 * @file src/app/providers.tsx
 * @description
 * 클라이언트 사이드 Provider들을 모아놓은 컴포넌트입니다.
 * ThemeProvider, i18n 초기화 등을 담당합니다.
 *
 * 초보자 가이드:
 * 1. **"use client"**: 클라이언트 컴포넌트로 지정
 * 2. **Provider 조합**: 여러 Provider를 중첩하여 사용
 * 3. **i18n 초기화**: 앱 시작 시 다국어 설정 로드
 */

"use client";

import { ReactNode, useEffect, useState } from "react";
import { ThemeProvider } from "@/contexts/ThemeContext";
import "@/lib/i18n"; // i18n 초기화

interface ProvidersProps {
  children: ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  const [mounted, setMounted] = useState(false);

  // 클라이언트 마운트 확인 (hydration mismatch 방지)
  useEffect(() => {
    setMounted(true);
  }, []);

  // 서버 렌더링 시에는 기본 상태로 렌더링
  if (!mounted) {
    return (
      <ThemeProvider defaultTheme="system">
        <div style={{ visibility: "hidden" }}>{children}</div>
      </ThemeProvider>
    );
  }

  return <ThemeProvider defaultTheme="system">{children}</ThemeProvider>;
}
