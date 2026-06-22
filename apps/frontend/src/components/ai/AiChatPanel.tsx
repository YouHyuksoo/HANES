"use client";

/**
 * @file src/components/ai/AiChatPanel.tsx
 * @description AI 채팅 우측 슬라이드 패널 (Mistral)
 *  - 1단계: 일반 대화
 *  - 2단계: MES 데이터 질의(text-to-SQL). 조회는 즉시 분석, INSERT/UPDATE는 승인 후 실행.
 *  - 응답은 마크다운(표) 렌더.
 */
import { useState, useRef, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Sparkles, X, Send, LoaderCircle, Trash2, Database, Play } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import api from "@/services/api";
import { useAiChatStore } from "@/stores/aiChatStore";

const MD_COMPONENTS = {
  table: ({ node: _n, ...p }: { node?: unknown }) => (
    <div className="my-1 overflow-x-auto">
      <table className="w-full border-collapse text-xs" {...p} />
    </div>
  ),
  th: ({ node: _n, ...p }: { node?: unknown }) => (
    <th className="border border-border bg-surface-secondary px-2 py-1 text-left font-semibold" {...p} />
  ),
  td: ({ node: _n, ...p }: { node?: unknown }) => (
    <td className="border border-border px-2 py-1" {...p} />
  ),
  code: ({ node: _n, ...p }: { node?: unknown }) => (
    <code className="rounded bg-surface px-1 py-0.5 text-[11px]" {...p} />
  ),
  a: ({ node: _n, ...p }: { node?: unknown }) => <a className="text-primary underline" {...p} />,
};

export default function AiChatPanel() {
  const { t } = useTranslation();
  const { isOpen, messages, close, addMessage, clear } = useAiChatStore();
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [approvedIdx, setApprovedIdx] = useState<Set<number>>(new Set());
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
      const data = res.data?.data ?? {};
      addMessage({
        role: "assistant",
        content: data.content || t("ai.chat.empty", "응답이 비어 있습니다."),
        sql: data.sql,
        requiresApproval: data.requiresApproval,
        executed: data.executed,
      });
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      addMessage({ role: "assistant", content: msg || t("ai.chat.error", "응답을 가져오지 못했습니다.") });
    } finally {
      setSending(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [input, sending, messages, addMessage, t]);

  const approve = useCallback(
    async (idx: number, sql?: string) => {
      if (!sql || sending) return;
      setSending(true);
      try {
        const res = await api.post("/ai/execute-sql", { sql });
        const data = res.data?.data ?? {};
        addMessage({ role: "assistant", content: data.content || t("ai.chat.executed", "실행이 완료되었습니다."), executed: true });
      } catch (e: unknown) {
        const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
        addMessage({ role: "assistant", content: msg || t("ai.chat.error", "응답을 가져오지 못했습니다.") });
      } finally {
        setApprovedIdx((prev) => new Set(prev).add(idx));
        setSending(false);
      }
    },
    [sending, addMessage, t],
  );

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
    <div className="fixed right-0 top-[var(--header-height)] bottom-0 z-[55] flex w-[440px] max-w-[92vw] flex-col border-l border-border bg-background shadow-2xl animate-slide-in-right">
      {/* 헤더 */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 className="flex items-center gap-2 text-base font-bold text-text">
          <Sparkles className="h-5 w-5 text-violet-500" />
          {t("ai.chat.title", "AI 채팅")}
        </h2>
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => { clear(); setApprovedIdx(new Set()); }} title={t("ai.chat.clear", "대화 비우기")} className="rounded p-1.5 text-text-muted hover:bg-surface hover:text-text">
            <Trash2 className="h-4 w-4" />
          </button>
          <button type="button" onClick={close} title={t("common.close", "닫기")} className="rounded p-1.5 text-text-muted hover:bg-surface hover:text-text">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* 메시지 목록 */}
      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-center text-text-muted">
            <Sparkles className="h-10 w-10 opacity-20" />
            <p className="text-sm">{t("ai.chat.placeholder", "무엇이든 물어보세요. MES 데이터도 조회해 드립니다.")}</p>
          </div>
        ) : (
          messages.map((m, i) => (
            <div key={i} className={`flex flex-col ${m.role === "user" ? "items-end" : "items-start"}`}>
              <div
                className={`max-w-[92%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed ${
                  m.role === "user"
                    ? "whitespace-pre-wrap bg-primary text-white"
                    : "border border-border bg-surface text-text"
                }`}
              >
                {m.role === "user" ? (
                  m.content
                ) : (
                  <div className="ai-md text-sm [&_p]:my-1 [&_ul]:my-1 [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:my-1 [&_ol]:list-decimal [&_ol]:pl-4 [&_h1]:font-bold [&_h2]:font-bold [&_h3]:font-semibold">
                    <ReactMarkdown remarkPlugins={[remarkGfm]} components={MD_COMPONENTS}>
                      {m.content}
                    </ReactMarkdown>
                  </div>
                )}
              </div>

              {/* 쓰기 승인 카드 */}
              {m.role === "assistant" && m.requiresApproval && m.sql && !approvedIdx.has(i) && (
                <div className="mt-2 w-[92%] rounded-lg border border-amber-400 p-2.5 dark:border-amber-700">
                  <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-amber-700 dark:text-amber-400">
                    <Database className="h-3.5 w-3.5" />
                    {t("ai.chat.approveTitle", "데이터 변경 승인 필요")}
                  </div>
                  <pre className="mb-2 max-h-40 overflow-auto whitespace-pre-wrap rounded bg-surface px-2 py-1.5 font-mono text-[11px] text-text">{m.sql}</pre>
                  <div className="flex justify-end gap-2">
                    <button type="button" onClick={() => setApprovedIdx((p) => new Set(p).add(i))} className="rounded px-2.5 py-1 text-xs text-text-muted hover:bg-surface">
                      {t("ai.chat.cancel", "취소")}
                    </button>
                    <button type="button" onClick={() => approve(i, m.sql)} disabled={sending} className="flex items-center gap-1 rounded bg-amber-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-amber-700 disabled:opacity-50">
                      <Play className="h-3 w-3" />
                      {t("ai.chat.execute", "실행")}
                    </button>
                  </div>
                </div>
              )}

              {/* 실행된 SQL (조회) 접어보기 */}
              {m.role === "assistant" && m.executed && m.sql && (
                <details className="mt-1 w-[92%] text-[11px] text-text-muted">
                  <summary className="cursor-pointer select-none">{t("ai.chat.sqlLabel", "실행된 SQL")}</summary>
                  <pre className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap rounded bg-surface px-2 py-1 font-mono">{m.sql}</pre>
                </details>
              )}
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
