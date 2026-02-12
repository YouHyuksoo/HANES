/**
 * @file src/hooks/useTheme.ts
 * @description 테마 관련 커스텀 훅 - Zustand 스토어 래퍼
 *
 * 초보자 가이드:
 * 1. **useTheme**: 테마 상태와 토글 함수 반환 (zustand 기반)
 */
import { useEffect } from "react";
import { useThemeStore, Theme } from "@/stores/themeStore";

export function useTheme() {
  const { theme, setTheme, toggleTheme } = useThemeStore();

  const isDark = theme === "dark";

  return {
    theme,
    isDark,
    setTheme,
    toggleTheme,
  };
}

export function useSystemTheme(followSystem: boolean = false) {
  const { setTheme } = useThemeStore();

  useEffect(() => {
    if (!followSystem) return;

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

    const handleChange = (e: MediaQueryListEvent | MediaQueryList) => {
      setTheme(e.matches ? "dark" : "light");
    };

    handleChange(mediaQuery);

    mediaQuery.addEventListener("change", handleChange);

    return () => {
      mediaQuery.removeEventListener("change", handleChange);
    };
  }, [followSystem, setTheme]);
}

export type { Theme };
