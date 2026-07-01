import { create } from "zustand";
import type { HelpTab } from "@/lib/help";

interface HelpState {
  isOpen: boolean;
  tab: HelpTab;
  /** AI 채팅 출처 클릭 등 외부에서 특정 문서를 강제로 열 때 사용(현재 페이지 경로 대신 우선) */
  overrideMenuCode?: string;
  overrideHeadingSlug?: string;
  openHelp: () => void;
  /** menuCode/tab을 지정해 도움말 패널을 열고, headingSlug가 있으면 해당 섹션으로 스크롤 */
  openHelpFor: (menuCode: string, tab: HelpTab, headingSlug?: string) => void;
  closeHelp: () => void;
  setTab: (tab: HelpTab) => void;
}

export const useHelpStore = create<HelpState>((set) => ({
  isOpen: false,
  tab: "user",
  overrideMenuCode: undefined,
  overrideHeadingSlug: undefined,
  openHelp: () => set({ isOpen: true, overrideMenuCode: undefined, overrideHeadingSlug: undefined }),
  openHelpFor: (menuCode, tab, headingSlug) =>
    set({ isOpen: true, tab, overrideMenuCode: menuCode, overrideHeadingSlug: headingSlug }),
  closeHelp: () => set({ isOpen: false, overrideMenuCode: undefined, overrideHeadingSlug: undefined }),
  setTab: (tab) => set({ tab }),
}));
