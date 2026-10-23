/**
 * @file src/stores/tabStore.ts
 * @description 탭 스토어는 공용 UI 패키지(@jisung/ui)로 옮겨졌다.
 * HANES 는 여기서 대시보드 고정 탭과 최대 탭 수(시스템환경설정 MAX_OPEN_TABS)를 패키지에 넘긴다.
 */
import { configureTabStore, DEFAULT_MAX_TABS, normalizeMaxTabs } from "@jisung/ui";
import { useSysConfigStore } from "@/stores/sysConfigStore";

export { useTabStore, DEFAULT_MAX_TABS } from "@jisung/ui";
export type { Tab } from "@jisung/ui";

/** 최대 탭 수를 정하는 시스템환경설정 키 */
export const MAX_TABS_CONFIG_KEY = "MAX_OPEN_TABS";

/** 시스템환경설정(MAX_OPEN_TABS) 기반 최대 탭 수. React 외부에서 현재값이 필요할 때 사용한다. */
export function getMaxTabs(): number {
  return normalizeMaxTabs(
    useSysConfigStore.getState().getNumberConfig(MAX_TABS_CONFIG_KEY, DEFAULT_MAX_TABS),
  );
}

/** 최대 탭 수 — React 컴포넌트용 훅. 설정이 저장되면 새 값이 반영된다. */
export function useMaxTabs(): number {
  return useSysConfigStore((s) =>
    normalizeMaxTabs(Number(s.configMap[MAX_TABS_CONFIG_KEY] ?? DEFAULT_MAX_TABS)),
  );
}

configureTabStore({
  homeTab: { id: "dashboard", path: "/dashboard", labelKey: "menu.dashboard", parentId: "dashboard" },
  getMaxTabs,
});
