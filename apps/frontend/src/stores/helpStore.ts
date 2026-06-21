import { create } from "zustand";
import type { HelpTab } from "@/lib/help";

interface HelpState {
  isOpen: boolean;
  tab: HelpTab;
  openHelp: () => void;
  closeHelp: () => void;
  setTab: (tab: HelpTab) => void;
}

export const useHelpStore = create<HelpState>((set) => ({
  isOpen: false,
  tab: "user",
  openHelp: () => set({ isOpen: true }),
  closeHelp: () => set({ isOpen: false }),
  setTab: (tab) => set({ tab }),
}));
