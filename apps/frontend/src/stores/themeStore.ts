/**
 * @file src/stores/themeStore.ts
 * @description 테마 스토어는 공용 UI 패키지(@jisheng/ui)로 옮겨졌다.
 * HANES 의 기존 저장 키(harness-theme)를 그대로 써서 사용자의 테마 설정을 유지한다.
 */
import { configureThemeStore } from "@jisheng/ui";

export { useThemeStore, listenSystemThemeChange } from "@jisheng/ui";
export type { Theme, ResolvedTheme, ColorTheme } from "@jisheng/ui";

void configureThemeStore({ storageKey: "harness-theme" });
