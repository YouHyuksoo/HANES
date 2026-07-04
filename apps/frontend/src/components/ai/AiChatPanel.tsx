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
import { Sparkles, X, Send, LoaderCircle, Trash2, Database, Play, Copy, Check, ThumbsUp, ThumbsDown, Mic, MicOff, Volume2, VolumeX, ImagePlus } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import api from "@/services/api";
import { usePageToolStore } from "@/ai-page-tools/pageToolStore";
import { useAiChatStore, type AiChatAttachment, type AiChatMessage, type AiChatPersona, type AiChatSource } from "@/stores/aiChatStore";
import { useHelpStore } from "@/stores/helpStore";
import { findMenuCodeByPath } from "@/config/menuConfig";
import { slugify } from "@/lib/help";
import PageToolExecutionLog from "./PageToolExecutionLog";
import PageToolInspector from "./PageToolInspector";

interface SpeechRecognitionEventLike {
  results: ArrayLike<ArrayLike<{ transcript: string }>>;
}

interface BrowserSpeechRecognition {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

declare global {
  interface Window {
    SpeechRecognition?: new () => BrowserSpeechRecognition;
    webkitSpeechRecognition?: new () => BrowserSpeechRecognition;
  }
}

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

const AI_PROVIDER_LABELS: Record<string, string> = {
  mistral: "Mistral",
  openai: "OpenAI",
  openrouter: "OpenRouter",
};

const AI_PERSONAS: Array<{
  value: AiChatPersona;
  label: string;
  audience: "user" | "operator" | "engineer";
  description: string;
}> = [
  {
    value: "user",
    label: "일반사용자",
    audience: "user",
    description: "사용자 도움말을 우선해 화면 사용 순서와 처리 전 확인사항을 쉽게 설명합니다.",
  },
  {
    value: "operator",
    label: "운영관리자",
    audience: "operator",
    description: "운영 절차, 취소/복원, 인터록, 장애 조치와 업무 영향을 중심으로 답합니다.",
  },
  {
    value: "engineer",
    label: "시스템엔지니어",
    audience: "engineer",
    description: "API, 서비스, DB 테이블, 트랜잭션 흐름을 근거 중심으로 설명합니다.",
  },
];

const AI_ROUTE_MODES = [
  { prefix: "/MES", label: "/MES", title: "MES 데이터 조회" },
  { prefix: "/HELP", label: "/HELP", title: "도움말 검색" },
  { prefix: "/DO", label: "/DO", title: "현재 화면 작업" },
  { prefix: "/WEB", label: "/WEB", title: "외부 웹 검색" },
];

const DEFAULT_AI_CHAT_WIDTH = 880;
const MAX_IMAGE_ATTACHMENTS = 3;
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

export default function AiChatPanel() {
  const { t } = useTranslation();
  const pathname = usePathname();
  const { isOpen, messages, persona, setPersona, close, addMessage, clear } = useAiChatStore();
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
  const [width, setWidth] = useState(DEFAULT_AI_CHAT_WIDTH);
  const [aiStatus, setAiStatus] = useState<{ provider: string; model: string } | null>(null);
  const [embeddingDegraded, setEmbeddingDegraded] = useState(false);
  const [attachments, setAttachments] = useState<AiChatAttachment[]>([]);
  const [listening, setListening] = useState(false);
  const [speakingIdx, setSpeakingIdx] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, sending]);

  useEffect(() => {
    if (isOpen) setTimeout(() => inputRef.current?.focus(), 120);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    api
      .get("/ai/status")
      .then((res) => {
        if (cancelled) return;
        const data = res.data?.data ?? {};
        if (data.provider && data.model) setAiStatus({ provider: data.provider, model: data.model });
      })
      .catch(() => {
        /* 상태 배지는 부가 정보 — 조회 실패해도 채팅 흐름을 막지 않는다 */
      });
    api
      .get("/ai/knowledge/status")
      .then((res) => {
        if (cancelled) return;
        const data = res.data?.data ?? res.data ?? {};
        setEmbeddingDegraded(data.realEmbeddingProvider === false);
      })
      .catch(() => {
        /* 배지는 부가 정보 — 실패해도 채팅 흐름을 막지 않는다 */
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
      window.speechSynthesis?.cancel();
    };
  }, []);

  const send = useCallback(async () => {
    const content = input.trim();
    if ((!content && attachments.length === 0) || sending) return;
    const effectiveContent = content || "첨부 이미지 분석해줘";
    const userMsg = {
      role: "user" as const,
      content: effectiveContent,
      attachments: attachments.length > 0 ? attachments : undefined,
    };
    addMessage(userMsg);
    setInput("");
    setAttachments([]);
    setSending(true);
    try {
      const history = [...messages, userMsg].map((m) => ({ role: m.role, content: m.content, attachments: m.attachments }));
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
        audience: AI_PERSONAS.find((item) => item.value === persona)?.audience ?? "user",
        persona,
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
  }, [input, attachments, sending, messages, addMessage, t, manifest, pathname, persona]);

  const applyRoutePrefix = useCallback((prefix: string) => {
    setInput((prev) => {
      const withoutPrefix = prev.trimStart().replace(/^\/(MES|HELP|DO|WEB)\b\s*/i, "");
      return `${prefix} ${withoutPrefix}`.trimEnd();
    });
    setTimeout(() => inputRef.current?.focus(), 0);
  }, []);

  const readImageAttachment = useCallback((file: File): Promise<AiChatAttachment | null> => {
    if (!file.type.startsWith("image/") || file.size > MAX_IMAGE_BYTES) return Promise.resolve(null);
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = typeof reader.result === "string" ? reader.result : "";
        resolve(dataUrl ? { type: "image", name: file.name, mimeType: file.type, dataUrl } : null);
      };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(file);
    });
  }, []);

  const appendImageFiles = useCallback(
    async (sourceFiles: Iterable<File>) => {
      const files = Array.from(sourceFiles)
        .filter((file) => file.type.startsWith("image/"))
        .slice(0, MAX_IMAGE_ATTACHMENTS);
      if (files.length === 0) return;
      const loaded = (await Promise.all(files.map(readImageAttachment))).filter((item): item is AiChatAttachment => Boolean(item));
      if (loaded.length > 0) setAttachments((prev) => [...prev, ...loaded].slice(0, MAX_IMAGE_ATTACHMENTS));
      setTimeout(() => inputRef.current?.focus(), 0);
    },
    [readImageAttachment],
  );

  const attachImages = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const input = event.currentTarget;
      const files = Array.from(input.files ?? []);
      await appendImageFiles(files);
      input.value = "";
    },
    [appendImageFiles],
  );

  const handlePaste = useCallback(
    (event: React.ClipboardEvent<HTMLElement>) => {
      const files = Array.from(event.clipboardData.files).filter((file) => file.type.startsWith("image/"));
      if (files.length === 0) return;
      event.preventDefault();
      void appendImageFiles(files);
    },
    [appendImageFiles],
  );

  const removeAttachment = useCallback((index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const toggleVoiceInput = useCallback(() => {
    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }
    const Recognition = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!Recognition) {
      addMessage({ role: "assistant", content: "이 브라우저는 음성입력을 지원하지 않습니다. Chrome 또는 Edge에서 다시 시도해 주세요." });
      return;
    }
    const recognition = new Recognition();
    recognition.lang = "ko-KR";
    recognition.interimResults = false;
    recognition.continuous = false;
    recognition.onresult = (event) => {
      const transcript = Array.from({ length: event.results.length }, (_, index) => event.results[index][0]?.transcript ?? "")
        .join(" ")
        .trim();
      if (transcript) setInput((prev) => [prev.trim(), transcript].filter(Boolean).join(" "));
    };
    recognition.onerror = () => setListening(false);
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
    setListening(true);
    recognition.start();
  }, [addMessage, listening]);

  const speakMessage = useCallback(
    (idx: number, content: string) => {
      if (!window.speechSynthesis) return;
      if (speakingIdx === idx) {
        window.speechSynthesis.cancel();
        setSpeakingIdx(null);
        return;
      }
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(content.replace(/[`*_#>\[\]()]/g, " "));
      utterance.lang = "ko-KR";
      utterance.onend = () => setSpeakingIdx(null);
      utterance.onerror = () => setSpeakingIdx(null);
      setSpeakingIdx(idx);
      window.speechSynthesis.speak(utterance);
    },
    [speakingIdx],
  );

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
    <div
      style={{ width }}
      onPaste={handlePaste}
      className="fixed right-0 top-[var(--header-height)] bottom-0 z-[55] flex max-w-[95vw] flex-col border-l border-border bg-background shadow-2xl animate-slide-in-right"
    >
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
          {aiStatus && (
            <span className="rounded-full border border-border px-2 py-0.5 text-[11px] font-normal text-text-muted">
              {AI_PROVIDER_LABELS[aiStatus.provider] ?? aiStatus.provider} · {aiStatus.model}
            </span>
          )}
          {embeddingDegraded && (
            <span
              className="rounded-full border border-amber-500 px-2 py-0.5 text-[11px] font-normal text-amber-600"
              title={t("ai.chat.embeddingDegradedHint", "임베딩 API 키가 없어 의미 검색이 비활성화되었습니다. 시스템 설정에서 AI 임베딩 키를 등록하세요.")}
            >
              {t("ai.chat.embeddingDegraded", "의미 검색 비활성")}
            </span>
          )}
        </h2>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => {
              clear();
              setApprovedIdx(new Set());
              setFeedbackByIdx(new Map());
              setExpandedSources(new Set());
              setCopiedIdx(null);
            }}
            title={t("ai.chat.clear", "대화 비우기")}
            className="rounded p-1.5 text-text-muted hover:bg-surface hover:text-text"
          >
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

      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <span className="text-[11px] font-medium text-text-muted">{t("ai.chat.persona", "페르소나")}</span>
        <div className="grid flex-1 grid-cols-3 rounded-md border border-border bg-surface p-0.5">
          {AI_PERSONAS.map((item) => (
            <div key={item.value} className="group relative min-w-0">
              <button
                type="button"
                onClick={() => setPersona(item.value)}
                className={`h-7 w-full min-w-0 rounded px-2 text-xs font-medium ${
                  persona === item.value
                    ? "bg-primary text-white shadow-sm"
                    : "text-text-muted hover:bg-background hover:text-text"
                }`}
                aria-describedby={`ai-persona-tip-${item.value}`}
                aria-pressed={persona === item.value}
              >
                {item.label}
              </button>
              <div
                id={`ai-persona-tip-${item.value}`}
                role="tooltip"
                className="pointer-events-none absolute left-1/2 top-full z-30 mt-2 w-56 -translate-x-1/2 rounded-md border border-border bg-background px-3 py-2 text-left text-[11px] leading-4 text-text shadow-lg opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100"
              >
                {item.description}
              </div>
            </div>
          ))}
        </div>
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
                  <>
                    {m.content}
                    {m.attachments && m.attachments.length > 0 && (
                      <div className="mt-2 grid grid-cols-3 gap-1.5">
                        {m.attachments.map((attachment, ai) => (
                          <img
                            key={`${attachment.name}-${ai}`}
                            src={attachment.dataUrl}
                            alt={attachment.name}
                            className="h-16 w-full rounded border border-white/30 object-cover"
                          />
                        ))}
                      </div>
                    )}
                  </>
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
                      onClick={() => speakMessage(i, m.content)}
                      title={speakingIdx === i ? "읽기 중지" : "답변 읽기"}
                      className={`rounded p-1 hover:bg-surface ${speakingIdx === i ? "text-primary" : "text-text-muted hover:text-text"}`}
                    >
                      {speakingIdx === i ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
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
      <div className={`border-t border-border p-3 ${activeTab === "chat" ? "block" : "hidden"}`}>
        <div className="mb-2 flex flex-wrap gap-1">
          {AI_ROUTE_MODES.map((mode) => (
            <button
              key={mode.prefix}
              type="button"
              onClick={() => applyRoutePrefix(mode.prefix)}
              title={mode.title}
              className={`h-7 rounded border px-2 text-[11px] font-medium ${
                input.trimStart().toUpperCase().startsWith(mode.prefix)
                  ? "border-primary bg-primary text-white"
                  : "border-border bg-surface text-text-muted hover:bg-surface-secondary hover:text-text"
              }`}
            >
              {mode.label}
            </button>
          ))}
        </div>
        {attachments.length > 0 && (
          <div className="mb-2 flex gap-2 overflow-x-auto">
            {attachments.map((attachment, index) => (
              <div key={`${attachment.name}-${index}`} className="relative h-16 w-16 shrink-0 overflow-hidden rounded-md border border-border bg-surface">
                <img src={attachment.dataUrl} alt={attachment.name} className="h-full w-full object-cover" />
                <button
                  type="button"
                  onClick={() => removeAttachment(index)}
                  title="첨부 제거"
                  className="absolute right-0.5 top-0.5 rounded bg-background/90 p-0.5 text-text-muted hover:text-text"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="flex items-end gap-2">
          <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={attachImages} />
          <button
            type="button"
            onClick={toggleVoiceInput}
            disabled={sending}
            title={listening ? "음성입력 중지" : "음성입력"}
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border ${
              listening ? "bg-primary text-white" : "bg-surface text-text-muted hover:bg-surface-secondary hover:text-text"
            } disabled:opacity-40`}
          >
            {listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={sending || attachments.length >= MAX_IMAGE_ATTACHMENTS}
            title="이미지 첨부"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border bg-surface text-text-muted hover:bg-surface-secondary hover:text-text disabled:opacity-40"
          >
            <ImagePlus className="h-4 w-4" />
          </button>
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
    </div>
  );
}
