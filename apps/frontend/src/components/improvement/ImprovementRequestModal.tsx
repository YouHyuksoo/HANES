"use client";

/**
 * @file src/components/improvement/ImprovementRequestModal.tsx
 * @description 개선요청 입력 폼 모달 — 선택된 요소 정보 + 스크린샷 + 설명 입력
 *
 * 초보자 가이드:
 * 1. selectedElement가 null이 아니면 자동으로 열림
 * 2. 페이지 URL, 요소 정보, 스크린샷은 읽기전용으로 표시
 * 3. 저장 성공 시 reset()으로 상태 초기화 (모달 자동 닫힘)
 */
import { useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { usePathname } from "next/navigation";
import { X, Wrench } from "lucide-react";
import toast from "react-hot-toast";
import { useImprovementRequestStore } from "@/stores/improvementRequestStore";
import { improvementRequestService } from "@/services/improvementRequestService";

export default function ImprovementRequestModal() {
  const { t } = useTranslation();
  const pathname = usePathname();
  const { selectedElement, screenshot, reset } = useImprovementRequestStore();
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleClose = useCallback(() => {
    setDescription("");
    reset();
  }, [reset]);

  const handleSubmit = useCallback(async () => {
    if (!description.trim()) return;
    setIsSubmitting(true);
    try {
      await improvementRequestService.create({
        pageUrl: pathname,
        elementText: selectedElement?.text ?? undefined,
        elementTag: selectedElement?.tagName ?? undefined,
        description: description.trim(),
        screenshot: screenshot ?? undefined,
      });
      toast.success(t("improvement.submitSuccess"));
      handleClose();
    } catch {
      toast.error(t("improvement.submitError"));
    } finally {
      setIsSubmitting(false);
    }
  }, [description, pathname, selectedElement, screenshot, t, handleClose]);

  if (!selectedElement) return null;
  const submitDisabledReason = description.trim()
    ? ""
    : t("improvement.submitError", "설명 입력은 필수입니다.");

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      {/* 배경 */}
      <div className="absolute inset-0 bg-black/50" onClick={handleClose} />

      {/* 모달 */}
      <div className="relative bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-border w-full max-w-lg mx-4 overflow-hidden">
        {/* 헤더 */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-border bg-surface">
          <Wrench className="w-5 h-5 text-orange-500" />
          <h3 className="flex-1 text-sm font-bold text-text">
            {t("improvement.modalTitle")}
          </h3>
          <button
            onClick={handleClose}
            className="p-1 rounded hover:bg-surface-hover transition-colors"
          >
            <X className="w-4 h-4 text-text-muted" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* 페이지 URL */}
          <div>
            <p className="text-xs font-medium text-text-muted mb-1">
              {t("improvement.pageUrl")}
            </p>
            <p className="text-sm text-text font-mono bg-surface rounded px-2 py-1.5 break-all">
              {pathname}
            </p>
          </div>

          {/* 선택 요소 */}
          {selectedElement.text && (
            <div>
              <p className="text-xs font-medium text-text-muted mb-1">
                {t("improvement.selectedElement")}
              </p>
              <p className="text-sm text-text bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800 rounded px-2 py-1.5">
                <span className="text-xs text-orange-600 dark:text-orange-400 mr-2">
                  &lt;{selectedElement.tagName}&gt;
                </span>
                {selectedElement.text}
              </p>
            </div>
          )}

          {/* 스크린샷 */}
          {screenshot && (
            <div>
              <p className="text-xs font-medium text-text-muted mb-1">
                {t("improvement.screenshot")}
              </p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={screenshot}
                alt="screenshot"
                className="w-full rounded border border-border"
              />
            </div>
          )}

          {/* 설명 입력 */}
          <div>
            <p className="text-xs font-medium text-text-muted mb-1">
              {t("improvement.description")}
              <span className="text-red-500 ml-0.5">*</span>
            </p>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("improvement.descriptionPlaceholder")}
              rows={4}
              maxLength={2000}
              className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background text-text placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none"
            />
            <p className="text-xs text-text-muted text-right mt-0.5">
              {description.length} / 2000
            </p>
          </div>
        </div>

        {/* 푸터 */}
        <div className="flex justify-end gap-2 px-5 py-3 border-t border-border bg-surface/50">
          <button
            onClick={handleClose}
            className="px-4 py-2 text-sm rounded-lg border border-border text-text-muted hover:bg-surface transition-colors"
          >
            {t("common.cancel")}
          </button>
          <button
            onClick={handleSubmit}
            disabled={!description.trim() || isSubmitting}
            title={isSubmitting ? t("common.saving") : submitDisabledReason || t("improvement.submit")}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-orange-500 hover:bg-orange-600 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? t("common.saving") : t("improvement.submit")}
          </button>
          {submitDisabledReason ? (
            <p className="text-xs text-text-muted" title={submitDisabledReason}>
              {submitDisabledReason}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
