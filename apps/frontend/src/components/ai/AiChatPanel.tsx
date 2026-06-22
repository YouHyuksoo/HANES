"use client";

/**
 * @file src/components/ai/AiChatPanel.tsx
 * @description AI 채팅 우측 슬라이드 패널 (Mistral 일반 대화 — 1단계)
 *
 * 초보자 가이드:
 * 1. FAB의 'AI 채팅' → aiChatStore.open() → 이 패널이 우측에서 슬라이드
 * 2. 메시지 입력 → POST /ai/chat → assistant 응답 추가
 * 3. system 프롬프트는 백엔드에서 주입(프론트는 user/assistant만 전송)
 */
import { useState, useRef, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Sparkles, X, Send, LoaderCircle, Trash2 } from "lucide-react";
import api from "@/services/api";
import { useAiChatStore } from "@/stores/aiChatStore";

export default function AiChatPanel() {
  const { t } = useTranslation();
  const { isOpen, messages, close, addMessage, clear } = useAiChatStore();
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, sending]);

  useEffect(() => {
    if (isOpen) setTimeout(() => inputRef.current?.focus(), 120);
  }, [isOpen]);

  const send = useCallback(async () => {
    const content = input.trim();
    if (!content || sending) return;
    const userMsg = { role: "user" as const, content };
    addMessage(userMsg);
    setInput("");
    setSending(true);
    try {
      const history = [...messages, userMsg].map((m) => ({ role: m.role, content: m.content }));
      const res = await api.post("/ai/chat", { messages: history });
      const reply: string = res.data?.data?.content ?? "";
      addMessage({ role: "assistant", content: reply || t("ai.chat.empty", "응답이 비어 있습니다.") });
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      addMessage({ role: "assistant", content: msg || t("ai.chat.error", "응답을 가져오지 못했습니다.") });
    } finally {
      setSending(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [input, sending, messages, addMessage, t]);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        send();
      }
    },
    [send],
  );

  if (!isOpen) return null;

  return (
    <div className="fixed right-0 top-[var(--header-height)] bottom-0 z-[55] flex w-[420px] max-w-[90vw] flex-col border-l border-border bg-background shadow-2xl animate-slide-in-right">
      {/* 헤더 */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 className="flex items-center gap-2 text-base font-bold text-text">
          <Sparkles className="h-5 w-5 text-violet-500" />
          {t("ai.chat.title", "AI 채팅")}
        </h2>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={clear}
            title={t("ai.chat.clear", "대화 비우기")}
            className="rounded p-1.5 text-text-muted hover:bg-surface hover:text-text"
          >
            <Trash2 className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={close}
            title={t("common.close", "닫기")}
            className="rounded p-1.5 text-text-muted hover:bg-surface hover:text-text"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* 메시지 목록 */}
      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-center text-text-muted">
            <Sparkles className="h-10 w-10 opacity-20" />
            <p className="text-sm">{t("ai.chat.placeholder", "무엇이든 물어보세요. MES 운영을 도와드립니다.")}</p>
          </div>
        ) : (
          messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-sm leading-relaxed ${
                  m.role === "user"
                    ? "bg-primary text-white"
                    : "border border-border bg-surface text-text"
                }`}
              >
                {m.content}
              </div>
            </div>
          ))
        )}
        {sending && (
          <div className="flex justify-start">
            <div className="flex items-center gap-2 rounded-2xl border border-border bg-surface px-3.5 py-2 text-sm text-text-muted">
              <LoaderCircle className="h-4 w-4 animate-spin" />
              {t("ai.chat.thinking", "생각 중...")}
            </div>
          </div>
        )}
      </div>

      {/* 입력 */}
      <div className="flex items-end gap-2 border-t border-border p-3">
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          rows={1}
          placeholder={t("ai.chat.inputPlaceholder", "메시지를 입력하세요 (Enter 전송, Shift+Enter 줄바꿈)")}
          className="max-h-32 min-h-[40px] flex-1 resize-none rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text outline-none focus:border-primary focus:ring-1 focus:ring-primary"
        />
        <button
          type="button"
          onClick={send}
          disabled={!input.trim() || sending}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary text-white transition-colors hover:bg-primary-dark disabled:opacity-40"
          title={t("ai.chat.send", "전송")}
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
