/**
 * @file src/hooks/useTheme.ts
 * @description 공용 UI 패키지(@jisheng/ui)로 옮겨졌다. 기존 import 경로 호환용 재수출.
 */
import "@/stores/themeStore";

export { useTheme } from "@jisheng/ui";
export type { Theme, ResolvedTheme } from "@jisheng/ui";
