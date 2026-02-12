/**
 * @file src/contexts/ThemeContext.tsx
 * @description
 * 테마(다크모드) 관리를 위한 Context입니다.
 * localStorage와 시스템 설정을 기반으로 테마를 관리합니다.
 *
 * 초보자 가이드:
 * 1. **ThemeProvider**: 앱 전체를 감싸서 테마 상태 제공
 * 2. **useTheme**: 현재 테마 상태와 토글 함수 접근
 * 3. **다크모드**: HTML에 'dark' 클래스 추가/제거로 구현
 *
 * 사용 방법:
 * ```tsx
 * const { theme, setTheme, toggleTheme } = useTheme();
 * ```
 */

"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  ReactNode,
} from "react";

/** 테마 타입 */
export type Theme = "light" | "dark" | "system";

/** 실제 적용되는 테마 타입 */
export type ResolvedTheme = "light" | "dark";

/** ThemeContext 값 타입 */
interface ThemeContextValue {
  /** 현재 설정된 테마 */
  theme: Theme;
  /** 실제 적용된 테마 (system일 경우 해석된 값) */
  resolvedTheme: ResolvedTheme;
  /** 테마 설정 함수 */
  setTheme: (theme: Theme) => void;
  /** 라이트/다크 토글 함수 */
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

/** localStorage 키 */
const THEME_STORAGE_KEY = "harness-theme";

/** ThemeProvider Props */
interface ThemeProviderProps {
  children: ReactNode;
  /** 기본 테마 (기본값: system) */
  defaultTheme?: Theme;
}

/**
 * 시스템 테마 감지 함수
 */
function getSystemTheme(): ResolvedTheme {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

/**
 * 테마 Provider 컴포넌트
 */
export function ThemeProvider({
  children,
  defaultTheme = "system",
}: ThemeProviderProps) {
  const [theme, setThemeState] = useState<Theme>(defaultTheme);
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>("light");
  const [mounted, setMounted] = useState(false);

  // 클라이언트에서 초기 테마 로드
  useEffect(() => {
    const stored = localStorage.getItem(THEME_STORAGE_KEY) as Theme | null;
    if (stored && ["light", "dark", "system"].includes(stored)) {
      setThemeState(stored);
    }
    setMounted(true);
  }, []);

  // 실제 테마 적용
  useEffect(() => {
    if (!mounted) return;

    const resolved = theme === "system" ? getSystemTheme() : theme;
    setResolvedTheme(resolved);

    // HTML 클래스 업데이트
    const root = document.documentElement;
    root.classList.remove("light", "dark");
    root.classList.add(resolved);
  }, [theme, mounted]);

  // 시스템 테마 변경 감지
  useEffect(() => {
    if (!mounted || theme !== "system") return;

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => {
      setResolvedTheme(getSystemTheme());
      const root = document.documentElement;
      root.classList.remove("light", "dark");
      root.classList.add(getSystemTheme());
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [theme, mounted]);

  // 테마 설정 함수
  const setTheme = useCallback((newTheme: Theme) => {
    setThemeState(newTheme);
    localStorage.setItem(THEME_STORAGE_KEY, newTheme);
  }, []);

  // 테마 토글 함수
  const toggleTheme = useCallback(() => {
    const newTheme = resolvedTheme === "light" ? "dark" : "light";
    setTheme(newTheme);
  }, [resolvedTheme, setTheme]);

  // 서버 렌더링 시 hydration mismatch 방지
  if (!mounted) {
    return (
      <ThemeContext.Provider
        value={{
          theme: defaultTheme,
          resolvedTheme: "light",
          setTheme: () => {},
          toggleTheme: () => {},
        }}
      >
        {children}
      </ThemeContext.Provider>
    );
  }

  return (
    <ThemeContext.Provider
      value={{ theme, resolvedTheme, setTheme, toggleTheme }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

/**
 * 테마 Hook
 * @throws ThemeProvider 내부에서만 사용 가능
 */
export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
