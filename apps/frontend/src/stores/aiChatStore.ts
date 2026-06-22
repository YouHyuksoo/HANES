/**
 * @file src/stores/aiChatStore.ts
 * @description AI 채팅 패널 전역 상태 (열림 여부 + 세션 메시지)
 *
 * 1단계: 대화 이력은 세션 메모리만 유지(패널 닫아도 유지, 새로고침 시 초기화).
 */
import { create } from "zustand";

export interface AiChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface AiChatState {
  isOpen: boolean;
  messages: AiChatMessage[];
  open: () => void;
  close: () => void;
  toggle: () => void;
  addMessage: (message: AiChatMessage) => void;
  clear: () => void;
}

export const useAiChatStore = create<AiChatState>((set) => ({
  isOpen: false,
  messages: [],
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
  toggle: () => set((state) => ({ isOpen: !state.isOpen })),
  addMessage: (message) => set((state) => ({ messages: [...state.messages, message] })),
  clear: () => set({ messages: [] }),
}));
