"use client";

/**
 * @file src/components/ai/AiChatPanel.tsx
 * @description AI 채팅 우측 슬라이드 패널 (Mistral)
 *  - 1단계: 일반 대화
 *  - 2단계: MES 데이터 질의(text-to-SQL). 조회는 즉시 분석, INSERT/UPDATE는 승인 후 실행.
 *  - 응답은 마크다운(표) 렌더.
 */
import { useState, useRef, useEffect, useCallback } from "react";
import { usePathname } from "next/navigation";
import { useTranslation } from "react-i18next";
import { Sparkles, X, Send, LoaderCircle, Trash2, Database, Play, Copy, Check, ThumbsUp, ThumbsDown } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import api from "@/services/api";
import { usePageToolStore } from "@/ai-page-tools/pageToolStore";
import { useAiChatStore, type AiChatMessage, type AiChatSource } from "@/stores/aiChatStore";
import { useHelpStore } from "@/stores/helpStore";
import { findMenuCodeByPath } from "@/config/menuConfig";
import { slugify } from "@/lib/help";
import PageToolExecutionLog from "./PageToolExecutionLog";
import PageToolInspector from "./PageToolInspector";

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
  const pathname = usePathname();
  const { isOpen, messages, close, addMessage, clear } = useAiChatStore();
  const activeTab = usePageToolStore((state) => state.activeTab);
  const manifest = usePageToolStore((state) => state.manifest);
  const openChatTab = usePageToolStore((state) => state.openChatTab);
  const openToolsTab = usePageToolStore((state) => state.openToolsTab);
  const openLogTab = usePageToolStore((state) => state.openLogTab);
  const openHelpFor = useHelpStore((state) => state.openHelpFor);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [approvedIdx, setApprovedIdx] = useState<Set<number>>(new Set());
  const [expandedSources, setExpandedSources] = useState<Set<number>>(new Set());
  const [feedbackByIdx, setFeedbackByIdx] = useState<Map<number, { feedbackId: number; rating: "LIKE" | "DISLIKE" }>>(new Map());
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const [width, setWidth] = useState(440);
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
      const pageToolContext = manifest
        ? {
            pageId: manifest.pageId,
            executionLevel: manifest.executionLevel,
            tools: manifest.tools.map(({ name, label, description, riskLevel, source, neverPersists, confirmationPolicy }) => ({
              name,
              label,
              description,
              riskLevel,
              source,
              neverPersists,
              confirmationPolicy,
            })),
          }
        : undefined;
      const knowledgeContext = {
        route: pathname,
        menuCode: findMenuCodeByPath(pathname),
        language: "ko",
      };
      const res = await api.post("/ai/chat", { messages: history, pageToolContext, knowledgeContext });
      const data = res.data?.data ?? {};
      addMessage({
        role: "assistant",
        content: data.content || t("ai.chat.empty", "응답이 비어 있습니다."),
        sql: data.sql,
        requiresApproval: data.requiresApproval,
        executed: data.executed,
        pageToolCall: data.pageToolCall,
        sources: data.sources,
      });
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      addMessage({ role: "assistant", content: msg || t("ai.chat.error", "응답을 가져오지 못했습니다.") });
    } finally {
      setSending(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [input, sending, messages, addMessage, t, manifest, pathname]);

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

  const executeTool = useCallback(
    async (idx: number, call?: { pageId: string; toolName: string; input: Record<string, unknown> }) => {
      if (!call || sending) return;
      setSending(true);
      try {
        const res = await api.post(`/ai/page-tools/${call.pageId}/execute`, { toolName: call.toolName, input: call.input });
        const data = res.data?.data ?? {};
        addMessage({ role: "assistant", content: data.summary || t("ai.chat.executed", "실행이 완료되었습니다."), executed: true });
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

  const toggleSources = useCallback((idx: number) => {
    setExpandedSources((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }, []);

  const openSource = useCallback(
    (source: AiChatSource) => {
      if (!source.menuCode) return;
      const tab = source.audience === "operator" ? "operator" : "user";
      openHelpFor(source.menuCode, tab, source.heading ? slugify(source.heading) : undefined);
    },
    [openHelpFor],
  );

  const copyMessage = useCallback(async (idx: number, content: string) => {
    await navigator.clipboard.writeText(content);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx((cur) => (cur === idx ? null : cur)), 1500);
  }, []);

  const rate = useCallback(
    async (idx: number, message: AiChatMessage, rating: "LIKE" | "DISLIKE") => {
      const existing = feedbackByIdx.get(idx);
      if (existing) {
        try {
          await api.delete(`/ai/chat/feedback/${existing.feedbackId}`);
        } catch {
          // 삭제 실패해도 사용자 흐름을 막지 않는다
        }
        setFeedbackByIdx((prev) => {
          const next = new Map(prev);
          next.delete(idx);
          return next;
        });
        if (existing.rating === rating) return;
      }
      const question = [...messages.slice(0, idx)].reverse().find((m) => m.role === "user")?.content ?? "";
      try {
        const res = await api.post("/ai/chat/feedback", {
          question,
          answer: message.content,
          sources: message.sources,
          route: pathname,
          menuCode: findMenuCodeByPath(pathname),
          rating,
        });
        const feedbackId = res.data?.data?.id;
        if (feedbackId) {
          setFeedbackByIdx((prev) => new Map(prev).set(idx, { feedbackId, rating }));
        }
      } catch {
        // 피드백 저장 실패는 조용히 무시(대화 흐름에 영향 없음)
      }
    },
    [feedbackByIdx, messages, pathname],
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

  // 좌측 경계 드래그로 너비 조절
  const startResize = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      const startX = e.clientX;
      const startW = width;
      const onMove = (ev: MouseEvent) => {
        const next = startW + (startX - ev.clientX);
        setWidth(Math.min(Math.max(360, next), Math.round(window.innerWidth * 0.95)));
      };
      const onUp = () => {
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
        document.body.style.userSelect = "";
      };
      document.body.style.userSelect = "none";
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    },
    [width],
  );

  if (!isOpen) return null;

  return (
    <div style={{ width }} className="fixed right-0 top-[var(--header-height)] bottom-0 z-[55] flex max-w-[95vw] flex-col border-l border-border bg-background shadow-2xl animate-slide-in-right">
      {/* 좌측 리사이즈 핸들 (드래그하여 너비 조절) */}
      <div
        onMouseDown={startResize}
        title={t("ai.chat.resize", "드래그하여 너비 조절")}
        className="absolute left-0 top-0 bottom-0 z-10 w-1.5 cursor-col-resize hover:bg-primary/40"
      />
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

      <div className="flex gap-1 border-b border-border px-3 py-2">
        <button
          type="button"
          onClick={openChatTab}
          className={`rounded px-3 py-1.5 text-xs font-medium ${activeTab === "chat" ? "bg-primary text-white" : "text-text-muted hover:bg-surface hover:text-text"}`}
        >
          {t("ai.chat.tab.chat", "채팅")}
        </button>
        <button
          type="button"
          onClick={openToolsTab}
          className={`rounded px-3 py-1.5 text-xs font-medium ${activeTab === "tools" ? "bg-primary text-white" : "text-text-muted hover:bg-surface hover:text-text"}`}
        >
          {t("ai.chat.tab.tools", "도구")}
        </button>
        <button
          type="button"
          onClick={openLogTab}
          className={`rounded px-3 py-1.5 text-xs font-medium ${activeTab === "log" ? "bg-primary text-white" : "text-text-muted hover:bg-surface hover:text-text"}`}
        >
          {t("ai.chat.tab.log", "실행로그")}
        </button>
      </div>

      {activeTab === "tools" && (
        <div className="flex-1 min-h-0 overflow-y-auto">
          <PageToolInspector />
        </div>
      )}
      {activeTab === "log" && (
        <div className="flex-1 min-h-0 overflow-y-auto">
          <PageToolExecutionLog />
        </div>
      )}

      {/* 메시지 목록 */}
      <div ref={scrollRef} className={`flex-1 space-y-3 overflow-y-auto p-4 ${activeTab === "chat" ? "" : "hidden"}`}>
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

              {/* 페이지 도구 실행 승인 카드 */}
              {m.role === "assistant" && m.pageToolCall && !approvedIdx.has(i) && (
                <div className="mt-2 w-[92%] rounded-lg border border-amber-400 p-2.5 dark:border-amber-700">
                  <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-amber-700 dark:text-amber-400">
                    <Play className="h-3.5 w-3.5" />
                    {t("ai.chat.toolApproveTitle", "작업 실행 승인 필요")}: {m.pageToolCall.label}
                  </div>
                  <pre className="mb-2 max-h-40 overflow-auto whitespace-pre-wrap rounded bg-surface px-2 py-1.5 font-mono text-[11px] text-text">{JSON.stringify(m.pageToolCall.input, null, 2)}</pre>
                  <div className="flex justify-end gap-2">
                    <button type="button" onClick={() => setApprovedIdx((p) => new Set(p).add(i))} className="rounded px-2.5 py-1 text-xs text-text-muted hover:bg-surface">
                      {t("ai.chat.cancel", "취소")}
                    </button>
                    <button type="button" onClick={() => executeTool(i, m.pageToolCall)} disabled={sending} className="flex items-center gap-1 rounded bg-amber-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-amber-700 disabled:opacity-50">
                      <Play className="h-3 w-3" />
                      {t("ai.chat.execute", "실행")}
                    </button>
                  </div>
                </div>
              )}

              {/* 실행된/생성된 SQL 접어보기 (실행 실패 시 자동 펼침) */}
              {m.role === "assistant" && m.sql && !m.requiresApproval && (
                <details open={!m.executed} className="mt-1 w-[92%] text-[11px] text-text-muted">
                  <summary className="cursor-pointer select-none">
                    {m.executed ? t("ai.chat.sqlLabel", "실행된 SQL") : t("ai.chat.sqlLabelGen", "생성된 SQL (실행 실패)")}
                  </summary>
                  <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap rounded bg-surface px-2 py-1 font-mono">{m.sql}</pre>
                </details>
              )}

              {/* 출처 + 복사/좋아요/싫어요 액션 줄 */}
              {m.role === "assistant" && (
                <div className="mt-1.5 flex w-[92%] items-center justify-between">
                  <div>
                    {m.sources && m.sources.length > 0 && (
                      <button
                        type="button"
                        onClick={() => toggleSources(i)}
                        className="text-[11px] text-text-muted underline hover:text-text"
                      >
                        {t("ai.chat.sourcesToggle", "출처 {{count}}건", { count: m.sources.length })} {expandedSources.has(i) ? "▲" : "▼"}
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => copyMessage(i, m.content)}
                      title={t("ai.chat.copy", "복사")}
                      className="rounded p-1 text-text-muted hover:bg-surface hover:text-text"
                    >
                      {copiedIdx === i ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => rate(i, m, "LIKE")}
                      title={t("ai.chat.like", "좋아요")}
                      className={`rounded p-1 hover:bg-surface ${feedbackByIdx.get(i)?.rating === "LIKE" ? "text-primary" : "text-text-muted hover:text-text"}`}
                    >
                      <ThumbsUp className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => rate(i, m, "DISLIKE")}
                      title={t("ai.chat.dislike", "싫어요")}
                      className={`rounded p-1 hover:bg-surface ${feedbackByIdx.get(i)?.rating === "DISLIKE" ? "text-red-500" : "text-text-muted hover:text-text"}`}
                    >
                      <ThumbsDown className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              )}
              {m.role === "assistant" && m.sources && m.sources.length > 0 && expandedSources.has(i) && (
                <div className="mt-1 w-[92%] space-y-1 rounded-lg border border-border bg-surface/60 p-2">
                  {m.sources.map((source, si) => (
                    <button
                      key={si}
                      type="button"
                      onClick={() => openSource(source)}
                      className="block w-full rounded px-1.5 py-1 text-left text-[11px] text-text-muted hover:bg-surface hover:text-text"
                    >
                      <span className="font-medium text-text">{source.title ?? source.menuCode ?? source.sourcePath}</span>
                      {source.heading ? ` > ${source.heading}` : ""}
                    </button>
                  ))}
                </div>
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
      <div className={`items-end gap-2 border-t border-border p-3 ${activeTab === "chat" ? "flex" : "hidden"}`}>
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
