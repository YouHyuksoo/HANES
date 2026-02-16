/**
 * @file src/hooks/useTheme.ts
 * @description 테마 관련 커스텀 훅 - Zustand 스토어 래퍼
 *
 * 개선사항:
 * 1. resolvedTheme 반환 (실제 적용된 테마)
 * 2. system 모드 지원
 * 3. 간단한 사용법 제공
 */
import { useThemeStore, Theme, ResolvedTheme } from "@/stores/themeStore";

interface UseThemeReturn {
  /** 현재 설정된 테마 (light | dark | system) */
  theme: Theme;
  /** 실제 적용된 테마 (light | dark) */
  resolvedTheme: ResolvedTheme;
  /** 현재 다크모드인지 여부 */
  isDark: boolean;
  /** 테마 설정 함수 */
  setTheme: (theme: Theme) => void;
  /** 라이트/다크 토글 */
  toggleTheme: () => void;
}

/**
 * 테마 훅 - 컴포넌트에서 테마 상태 사용
 * 
 * 사용 예시:
 * ```tsx
 * const { theme, resolvedTheme, isDark, setTheme, toggleTheme } = useTheme();
 * 
 * // 특정 테마로 설정
 * setTheme('dark');
 * 
 * // OS 설정 따라가기
 * setTheme('system');
 * 
 * // 토글
 * toggleTheme();
 * ```
 */
export function useTheme(): UseThemeReturn {
  const { theme, resolvedTheme, setTheme, toggleTheme } = useThemeStore();

  return {
    theme,
    resolvedTheme,
    isDark: resolvedTheme === "dark",
    setTheme,
    toggleTheme,
  };
}

export type { Theme, ResolvedTheme };
