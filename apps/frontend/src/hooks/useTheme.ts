/**
 * @file src/hooks/useTheme.ts
 * @description 테마 관련 커스텀 훅 - 시스템 테마 감지 및 토글 기능
 *
 * 초보자 가이드:
 * 1. **useTheme**: 테마 상태와 토글 함수 반환
 * 2. **useSystemTheme**: OS 다크모드 설정 감지
 */
import { useEffect } from 'react';
import { useThemeStore, Theme } from '@/stores/themeStore';

/**
 * 테마 상태 및 제어 훅
 */
export function useTheme() {
  const { theme, setTheme, toggleTheme } = useThemeStore();

  const isDark = theme === 'dark';

  return {
    theme,
    isDark,
    setTheme,
    toggleTheme,
  };
}

/**
 * 시스템 테마 감지 및 자동 적용 훅
 * @param followSystem - true면 시스템 테마를 자동으로 따름
 */
export function useSystemTheme(followSystem: boolean = false) {
  const { setTheme } = useThemeStore();

  useEffect(() => {
    if (!followSystem) return;

    // 시스템 다크모드 감지
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const handleChange = (e: MediaQueryListEvent | MediaQueryList) => {
      setTheme(e.matches ? 'dark' : 'light');
    };

    // 초기 설정
    handleChange(mediaQuery);

    // 시스템 테마 변경 감지
    mediaQuery.addEventListener('change', handleChange);

    return () => {
      mediaQuery.removeEventListener('change', handleChange);
    };
  }, [followSystem, setTheme]);
}

export type { Theme };
