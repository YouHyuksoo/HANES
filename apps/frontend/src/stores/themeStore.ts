/**
 * @file src/stores/themeStore.ts
 * @description Zustand 기반 테마 상태 관리 스토어
 *
 * 초보자 가이드:
 * 1. **persist**: localStorage에 테마 설정 저장
 * 2. **useThemeStore**: 컴포넌트에서 훅처럼 사용
 * 3. **toggleTheme**: 라이트/다크 모드 전환
 */
import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Theme = "light" | "dark";

interface ThemeState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      theme: "light",

      setTheme: (theme: Theme) => set({ theme }),

      toggleTheme: () =>
        set((state) => ({
          theme: state.theme === "light" ? "dark" : "light",
        })),
    }),
    {
      name: "hanes-theme",
    },
  ),
);
