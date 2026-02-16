/**
 * @file src/stores/themeStore.ts
 * @description Zustand 기반 테마 상태 관리 스토어
 *
 * 개선사항:
 * 1. system 모드 지원 (OS 설정 따라가기)
 * 2. localStorage 동기화 (persist 미들웨어)
 * 3. HTML 클래스 자동 적용 (useThemeEffect 훅 제공)
 */
import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Theme = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

interface ThemeState {
  theme: Theme;
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  _resolveTheme: (theme: Theme) => ResolvedTheme;
}

function getSystemTheme(): ResolvedTheme {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      theme: "system",
      resolvedTheme: "light",

      setTheme: (theme: Theme) => {
        const resolved = theme === "system" ? getSystemTheme() : theme;
        set({ theme, resolvedTheme: resolved });
      },

      toggleTheme: () => {
        const current = get().resolvedTheme;
        const next = current === "light" ? "dark" : "light";
        set({ theme: next, resolvedTheme: next });
      },

      _resolveTheme: (theme: Theme) => {
        return theme === "system" ? getSystemTheme() : theme;
      },
    }),
    {
      name: "harness-theme",
      partialize: (state) => ({ theme: state.theme }),
      onRehydrateStorage: () => (state) => {
        // hydration 후 resolvedTheme 재계산
        if (state) {
          const resolved =
            state.theme === "system" ? getSystemTheme() : state.theme;
          state.resolvedTheme = resolved;
        }
      },
    }
  )
);

/**
 * 시스템 테마 변경 감지용 미디어쿼리 리스너
 * providers.tsx 또는 컴포넌트에서 사용
 */
export function listenSystemThemeChange(callback: (theme: ResolvedTheme) => void) {
  if (typeof window === "undefined") return () => {};
  
  const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
  const handler = (e: MediaQueryListEvent) => {
    callback(e.matches ? "dark" : "light");
  };
  
  mediaQuery.addEventListener("change", handler);
  return () => mediaQuery.removeEventListener("change", handler);
}
