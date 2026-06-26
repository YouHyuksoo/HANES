/**
 * @file src/stores/tabStore.ts
 * @description Zustand 기반 탭 상태 관리 스토어
 *
 * 초보자 가이드:
 * 1. **Tab**: 열린 페이지를 나타내는 탭 객체 (id, path, labelKey, parentId)
 * 2. **pinned**: 고정 탭 (닫기 불가, 대시보드가 기본 고정)
 * 3. **비영속**: 탭 목록은 메모리에만 유지 — 새로고침/재진입 시 항상 초기 상태로 시작
 * 4. **최대 개수 제약**: 시스템환경설정(MAX_OPEN_TABS)으로 정하며, 미설정 시 기본 10개.
 *    한도에 도달한 상태에서 새 탭을 열면 추가를 차단하고 안내 모달을 띄운다
 */
import { create } from "zustand";
import { useSysConfigStore } from "@/stores/sysConfigStore";

/** 탭 인터페이스 */
export interface Tab {
  /** 고유 ID (메뉴 아이템 id와 동일) */
  id: string;
  /** 라우트 경로 */
  path: string;
  /** i18n 번역 키 */
  labelKey: string;
  /** 부모 메뉴 ID (아이콘 조회용) */
  parentId: string;
  /** 고정 탭 여부 */
  pinned?: boolean;
}

/** 시스템환경설정 미설정 시 사용할 기본 최대 탭 수 (고정 탭 포함) */
export const DEFAULT_MAX_TABS = 10;

/** 최대 탭 수를 정하는 시스템환경설정 키 */
export const MAX_TABS_CONFIG_KEY = "MAX_OPEN_TABS";

/** 설정값을 양의 정수로 정규화 — 비정상값이면 기본값으로 대체 */
function normalizeMaxTabs(value: number): number {
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : DEFAULT_MAX_TABS;
}

/**
 * 시스템환경설정(MAX_OPEN_TABS) 기반 최대 탭 수.
 * 스토어 로직 등 React 외부에서 현재값이 필요할 때 사용한다.
 */
export function getMaxTabs(): number {
  return normalizeMaxTabs(
    useSysConfigStore.getState().getNumberConfig(MAX_TABS_CONFIG_KEY, DEFAULT_MAX_TABS),
  );
}

/**
 * 최대 탭 수 — React 컴포넌트용 훅.
 * 시스템환경설정 변경이 저장되면 자동으로 새 값이 반영된다.
 */
export function useMaxTabs(): number {
  return useSysConfigStore((s) =>
    normalizeMaxTabs(Number(s.configMap[MAX_TABS_CONFIG_KEY] ?? DEFAULT_MAX_TABS)),
  );
}

/** 기본 대시보드 탭 */
const DASHBOARD_TAB: Tab = {
  id: "dashboard",
  path: "/dashboard",
  labelKey: "menu.dashboard",
  parentId: "dashboard",
  pinned: true,
};

interface TabState {
  tabs: Tab[];
  activeTabId: string | null;
  /** 탭 최대 개수 초과 안내 모달 표시 여부 */
  limitNoticeOpen: boolean;
  /** 탭 추가. 최대 개수 초과로 차단되면 false를 반환한다 */
  addTab: (tab: Omit<Tab, "pinned">) => boolean;
  removeTab: (tabId: string) => void;
  setActiveTab: (tabId: string) => void;
  closeOtherTabs: (tabId: string) => void;
  closeAllTabs: () => void;
  syncActiveTabByPath: (pathname: string) => void;
  closeLimitNotice: () => void;
}

export const useTabStore = create<TabState>()((set, get) => ({
  tabs: [DASHBOARD_TAB],
  activeTabId: "dashboard",
  limitNoticeOpen: false,

  addTab: (tab) => {
    const { tabs } = get();
    const existing = tabs.find((t) => t.id === tab.id);

    if (existing) {
      set({ activeTabId: existing.id });
      return true;
    }

    // 최대 탭 수 도달 시 추가 차단 + 안내 모달
    if (tabs.length >= getMaxTabs()) {
      set({ limitNoticeOpen: true });
      return false;
    }

    set({ tabs: [...tabs, { ...tab, pinned: false }], activeTabId: tab.id });
    return true;
  },

  removeTab: (tabId) => {
    const { tabs, activeTabId } = get();
    const tab = tabs.find((t) => t.id === tabId);
    if (!tab || tab.pinned) return;

    const tabIndex = tabs.findIndex((t) => t.id === tabId);
    const newTabs = tabs.filter((t) => t.id !== tabId);

    // 활성 탭을 닫은 경우 인접 탭 활성화
    if (activeTabId === tabId && newTabs.length > 0) {
      const nextTab =
        newTabs[tabIndex] || newTabs[tabIndex - 1] || newTabs[0];
      set({ tabs: newTabs, activeTabId: nextTab.id });
    } else {
      set({ tabs: newTabs });
    }
  },

  setActiveTab: (tabId) => {
    set({ activeTabId: tabId });
  },

  closeOtherTabs: (tabId) => {
    const { tabs } = get();
    const newTabs = tabs.filter((t) => t.id === tabId || t.pinned);
    set({ tabs: newTabs, activeTabId: tabId });
  },

  closeAllTabs: () => {
    const { tabs } = get();
    const pinnedTabs = tabs.filter((t) => t.pinned);
    const activeId = pinnedTabs.length > 0 ? pinnedTabs[0].id : null;
    set({ tabs: pinnedTabs, activeTabId: activeId });
  },

  syncActiveTabByPath: (pathname) => {
    const { tabs } = get();
    const matched = tabs.find((t) => t.path === pathname);
    if (matched) {
      set({ activeTabId: matched.id });
    }
  },

  closeLimitNotice: () => {
    set({ limitNoticeOpen: false });
  },
}));
