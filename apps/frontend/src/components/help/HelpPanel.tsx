"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { ChevronDown, ChevronUp, Search, X, BookOpen, ExternalLink } from "lucide-react";
import { findMenuCodeByPath } from "@/config/menuConfig";
import { useHelpStore } from "@/stores/helpStore";
import { useHelpDoc } from "@/hooks/useHelpDoc";
import MarkdownRenderer from "./MarkdownRenderer";

const MIN_SEARCH_LENGTH = 2;

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function clearHelpSearchMarks(root: HTMLElement | null) {
  if (!root) return;
  const marks = Array.from(root.querySelectorAll<HTMLElement>("mark[data-help-search-match]"));
  for (const mark of marks) {
    const parent = mark.parentNode;
    if (!parent) continue;
    parent.replaceChild(document.createTextNode(mark.textContent ?? ""), mark);
    parent.normalize();
  }
}

function highlightHelpMatches(root: HTMLElement | null, query: string) {
  if (!root) return 0;
  clearHelpSearchMarks(root);
  const keyword = query.trim();
  if (keyword.length < MIN_SEARCH_LENGTH) return 0;

  const pattern = new RegExp(escapeRegExp(keyword), "gi");
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  let current: Node | null = walker.nextNode();
  while (current) {
    const textNode = current as Text;
    const parent = textNode.parentElement;
    if (parent && !parent.closest("script, style, mark") && pattern.test(textNode.data)) {
      nodes.push(textNode);
    }
    pattern.lastIndex = 0;
    current = walker.nextNode();
  }

  let count = 0;
  for (const node of nodes) {
    const fragment = document.createDocumentFragment();
    const text = node.data;
    let lastIndex = 0;
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null = pattern.exec(text);
    while (match) {
      if (match.index > lastIndex) {
        fragment.appendChild(document.createTextNode(text.slice(lastIndex, match.index)));
      }
      const mark = document.createElement("mark");
      mark.dataset.helpSearchMatch = "true";
      mark.className = "rounded bg-amber-200 px-0.5 text-slate-950 dark:bg-amber-300";
      mark.textContent = match[0];
      fragment.appendChild(mark);
      count += 1;
      lastIndex = match.index + match[0].length;
      match = pattern.exec(text);
    }
    if (lastIndex < text.length) {
      fragment.appendChild(document.createTextNode(text.slice(lastIndex)));
    }
    node.parentNode?.replaceChild(fragment, node);
  }

  return count;
}

export default function HelpPanel() {
  const { t } = useTranslation();
  const pathname = usePathname();
  const router = useRouter();
  const { isOpen, tab, overrideMenuCode, overrideHeadingSlug, closeHelp, setTab } = useHelpStore();
  const menuCode = overrideMenuCode ?? findMenuCodeByPath(pathname);
  const { content, loading, notFound } = useHelpDoc(isOpen ? menuCode : undefined, tab);
  const [width, setWidth] = useState(896);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchIndex, setSearchIndex] = useState(0);
  const [searchMatchCount, setSearchMatchCount] = useState(0);
  const contentRef = useRef<HTMLDivElement | null>(null);

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

  // Escape로 닫기
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeHelp();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen, closeHelp]);

  // 출처 딥링크: 본문 로드 완료 후 해당 헤딩으로 스크롤
  useEffect(() => {
    if (!isOpen || loading || !content || !overrideHeadingSlug) return;
    const id = overrideHeadingSlug;
    const timer = setTimeout(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
    return () => clearTimeout(timer);
  }, [isOpen, loading, content, overrideHeadingSlug]);

  useEffect(() => {
    if (!isOpen || loading) {
      setSearchMatchCount(0);
      return;
    }
    const timer = setTimeout(() => {
      const count = highlightHelpMatches(contentRef.current, searchQuery);
      setSearchMatchCount(count);
      setSearchIndex((prev) => (count > 0 ? Math.min(prev, count - 1) : 0));
    }, 0);
    return () => {
      clearTimeout(timer);
      clearHelpSearchMarks(contentRef.current);
    };
  }, [isOpen, loading, content, searchQuery, tab]);

  useEffect(() => {
    const root = contentRef.current;
    if (!root || searchMatchCount === 0) return;
    const matches = Array.from(root.querySelectorAll<HTMLElement>("mark[data-help-search-match]"));
    matches.forEach((match, index) => {
      const active = index === searchIndex;
      match.dataset.helpSearchActive = active ? "true" : "false";
      match.className = active
        ? "rounded bg-primary px-0.5 text-white ring-2 ring-primary/30"
        : "rounded bg-amber-200 px-0.5 text-slate-950 dark:bg-amber-300";
    });
    matches[searchIndex]?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [searchIndex, searchMatchCount]);

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-[9990] bg-black/40" onClick={closeHelp} aria-hidden />
      <aside style={{ width }} className="fixed right-0 top-0 z-[9991] flex h-screen max-w-[95vw] flex-col border-l border-border bg-background shadow-2xl animate-slide-in-right">
        {/* 좌측 리사이즈 핸들 (드래그하여 너비 조절) */}
        <div
          onMouseDown={startResize}
          title={t("help.resize", "드래그하여 너비 조절")}
          className="absolute left-0 top-0 bottom-0 z-10 w-1.5 cursor-col-resize hover:bg-primary/40"
        />
        {/* 헤더 */}
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <BookOpen className="h-5 w-5 text-primary" />
          <h2 className="flex-1 text-sm font-bold text-text">{t("help.title", "도움말")}</h2>
          <button onClick={closeHelp} className="rounded p-1 hover:bg-surface" aria-label={t("common.close", "닫기")}>
            <X className="h-4 w-4 text-text-muted" />
          </button>
        </div>

        {/* 탭 */}
        <div className="flex border-b border-border">
          <button
            onClick={() => setTab("user")}
            className={`flex-1 px-3 py-2 text-sm font-medium transition-colors ${
              tab === "user" ? "border-b-2 border-primary text-primary" : "text-text-muted hover:text-text"
            }`}
          >
            {t("help.tabUser", "사용자")}
          </button>
          <button
            onClick={() => setTab("operator")}
            className={`flex-1 px-3 py-2 text-sm font-medium transition-colors ${
              tab === "operator" ? "border-b-2 border-primary text-primary" : "text-text-muted hover:text-text"
            }`}
          >
            {t("help.tabOperator", "운영자")}
          </button>
        </div>

        {/* 현재 도움말 본문 찾기 */}
        <div className="flex items-center gap-2 border-b border-border bg-surface/40 px-4 py-2">
          <label className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && searchMatchCount > 0) {
                  e.preventDefault();
                  setSearchIndex((prev) => (e.shiftKey ? prev - 1 + searchMatchCount : prev + 1) % searchMatchCount);
                }
              }}
              placeholder={t("help.searchInCurrentDoc", "현재 도움말에서 찾기")}
              className="h-8 w-full rounded border border-border bg-background pl-8 pr-2 text-sm text-text outline-none focus:border-primary"
            />
          </label>
          <span className="w-16 shrink-0 text-right text-xs text-text-muted">
            {searchQuery.trim().length >= MIN_SEARCH_LENGTH ? `${searchMatchCount === 0 ? 0 : searchIndex + 1}/${searchMatchCount}` : "-"}
          </span>
          <button
            type="button"
            onClick={() => setSearchIndex((prev) => (prev - 1 + searchMatchCount) % searchMatchCount)}
            disabled={searchMatchCount === 0}
            className="rounded border border-border p-1.5 text-text-muted hover:text-text disabled:cursor-not-allowed disabled:opacity-40"
            title={t("common.previous", "이전")}
          >
            <ChevronUp className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setSearchIndex((prev) => (prev + 1) % searchMatchCount)}
            disabled={searchMatchCount === 0}
            className="rounded border border-border p-1.5 text-text-muted hover:text-text disabled:cursor-not-allowed disabled:opacity-40"
            title={t("common.next", "다음")}
          >
            <ChevronDown className="h-4 w-4" />
          </button>
        </div>

        {/* 본문 */}
        <div ref={contentRef} className="flex-1 overflow-y-auto px-4 py-3">
          {loading ? (
            <div className="flex h-full items-center justify-center">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : notFound || !content ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-center text-text-muted">
              <BookOpen className="h-10 w-10 opacity-30" />
              <p className="text-sm">{t("help.notReady", "이 화면의 도움말은 준비 중입니다.")}</p>
            </div>
          ) : (
            <MarkdownRenderer content={content} />
          )}
        </div>

        {/* 푸터 */}
        <div className="border-t border-border px-4 py-3">
          <button
            onClick={() => {
              closeHelp();
              router.push("/help");
            }}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            <ExternalLink className="h-4 w-4" />
            {t("help.viewAll", "전체 도움말 보기")}
          </button>
        </div>
      </aside>
    </>
  );
}
