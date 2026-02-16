/**
 * @file src/contexts/index.ts
 * @description Context 모듈 통합 납치기 파일
 *
 * 개선사항:
 * Theme는 Zustand store로 이동하여 Context가 불필요해짐
 */

// Theme 관련 export는 stores/themeStore에서 제공
export { useThemeStore, type Theme, type ResolvedTheme } from "@/stores/themeStore";
