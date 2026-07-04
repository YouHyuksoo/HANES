/**
 * @file src/stores/aiChatStore.ts
 * @description AI 채팅 패널 전역 상태 (열림 여부 + 세션 메시지)
 *
 * 대화 이력과 페르소나는 브라우저 localStorage에 유지한다.
 */
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type AiChatPersona = "user" | "operator" | "engineer";

/** 승인 후 실행할 페이지 도구 호출 제안(write 도구) */
export interface AiPageToolCallProposal {
  pageId: string;
  toolName: string;
  label: string;
  input: Record<string, unknown>;
}

/** 답변 근거로 사용한 RAG 지식 청크 요약 */
export interface AiChatSource {
  chunkId: string;
  sourcePath: string;
  menuCode?: string;
  audience?: string;
  title?: string;
  heading?: string;
  score: number;
}

export interface AiChatAttachment {
  type: "image";
  name: string;
  mimeType: string;
  dataUrl: string;
}

export interface AiChatMessage {
  role: "user" | "assistant";
  content: string;
  attachments?: AiChatAttachment[];
  /** 생성/실행된 SQL (조회·쓰기 공통) */
  sql?: string;
  /** INSERT/UPDATE 승인 대기 여부 */
  requiresApproval?: boolean;
  /** 실행 완료 여부 */
  executed?: boolean;
  /** 페이지 도구 실행 제안(승인 카드) */
  pageToolCall?: AiPageToolCallProposal;
  /** 답변 근거 출처 (RAG 검색 결과가 있을 때만) */
  sources?: AiChatSource[];
}

interface AiChatState {
  isOpen: boolean;
  messages: AiChatMessage[];
  persona: AiChatPersona;
  open: () => void;
  close: () => void;
  toggle: () => void;
  addMessage: (message: AiChatMessage) => void;
  setPersona: (persona: AiChatPersona) => void;
  clear: () => void;
}

export const useAiChatStore = create<AiChatState>()(
  persist(
    (set) => ({
      isOpen: false,
      messages: [],
      persona: "user",
      open: () => set({ isOpen: true }),
      close: () => set({ isOpen: false }),
      toggle: () => set((state) => ({ isOpen: !state.isOpen })),
      addMessage: (message) => set((state) => ({ messages: [...state.messages, message] })),
      setPersona: (persona) => set({ persona }),
      clear: () => set({ messages: [] }),
    }),
    {
      name: "hanes.aiChat.v1",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ messages: state.messages, persona: state.persona }),
    },
  ),
);
