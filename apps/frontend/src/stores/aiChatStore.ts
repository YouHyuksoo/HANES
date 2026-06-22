/**
 * @file src/stores/aiChatStore.ts
 * @description AI 채팅 패널 전역 상태 (열림 여부 + 세션 메시지)
 *
 * 1단계: 대화 이력은 세션 메모리만 유지(패널 닫아도 유지, 새로고침 시 초기화).
 */
import { create } from "zustand";

/** 승인 후 실행할 페이지 도구 호출 제안(write 도구) */
export interface AiPageToolCallProposal {
  pageId: string;
  toolName: string;
  label: string;
  input: Record<string, unknown>;
}

export interface AiChatMessage {
  role: "user" | "assistant";
  content: string;
  /** 생성/실행된 SQL (조회·쓰기 공통) */
  sql?: string;
  /** INSERT/UPDATE 승인 대기 여부 */
  requiresApproval?: boolean;
  /** 실행 완료 여부 */
  executed?: boolean;
  /** 페이지 도구 실행 제안(승인 카드) */
  pageToolCall?: AiPageToolCallProposal;
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
