"use client";

import { useEffect, useState, useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { X, BookOpen, ExternalLink } from "lucide-react";
import { findMenuCodeByPath } from "@/config/menuConfig";
import { useHelpStore } from "@/stores/helpStore";
import { useHelpDoc } from "@/hooks/useHelpDoc";
import MarkdownRenderer from "./MarkdownRenderer";

export default function HelpPanel() {
  const { t } = useTranslation();
  const pathname = usePathname();
  const router = useRouter();
  const { isOpen, tab, overrideMenuCode, overrideHeadingSlug, closeHelp, setTab } = useHelpStore();
  const menuCode = overrideMenuCode ?? findMenuCodeByPath(pathname);
  const { content, loading, notFound } = useHelpDoc(isOpen ? menuCode : undefined, tab);
  const [width, setWidth] = useState(448);

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

        {/* 본문 */}
        <div className="flex-1 overflow-y-auto px-4 py-3">
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
