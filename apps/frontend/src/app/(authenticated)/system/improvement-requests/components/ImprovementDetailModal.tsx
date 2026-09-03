"use client";

/**
 * @file components/ImprovementDetailModal.tsx
 * @description 개선요청 상세 모달 — 스크린샷 전체 표시 + 상태 변경
 *
 * 초보자 가이드:
 * 1. imprId로 단건 API 호출하여 스크린샷 포함 전체 데이터 로드
 * 2. 상태 변경 버튼으로 PENDING → IN_PROGRESS → DONE 전이
 * 3. DONE 전이는 수정 커밋 해시·테스트 근거·배포 SHA 3개를 입력해야 활성화된다(shared missingImprDoneEvidence — 서버도 같은 규칙으로 거부)
 */
import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";
import toast from "react-hot-toast";
import { missingImprDoneEvidence, type ImprDoneEvidence } from "@harness/shared";
import {
  improvementRequestService,
  ImprRequestItem,
} from "@/services/improvementRequestService";

const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300",
  IN_PROGRESS: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  DONE: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
};

const NEXT_STATUS: Record<string, string | null> = {
  PENDING: "IN_PROGRESS",
  IN_PROGRESS: "DONE",
  DONE: null,
};

interface Props {
  imprId: string;
  onClose: () => void;
  onStatusChanged: () => void;
}

export default function ImprovementDetailModal({ imprId, onClose, onStatusChanged }: Props) {
  const { t } = useTranslation();
  const [item, setItem] = useState<ImprRequestItem | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [screenshotError, setScreenshotError] = useState(false);
  const [evidence, setEvidence] = useState<ImprDoneEvidence>({ fixCommit: "", fixTest: "", deploySha: "" });
  const nextStatus = item ? NEXT_STATUS[item.status] : null;
  const missingEvidence = nextStatus === "DONE" ? missingImprDoneEvidence(evidence) : [];

  // 스크린샷 변경 시 로드 에러 상태 리셋
  useEffect(() => { setScreenshotError(false); }, [item?.screenshot]);

  useEffect(() => {
    improvementRequestService.detail(imprId).then(setItem).catch(() => {
      toast.error(t("improvement.detailLoadError", "상세 조회 실패"));
      onClose();
    });
  }, [imprId, onClose, t]);

  const handleStatusChange = useCallback(async (newStatus: string) => {
    if (!item) return;
    setIsUpdating(true);
    try {
      const updated = await improvementRequestService.updateStatus(
        imprId,
        newStatus,
        newStatus === "DONE" ? evidence : undefined,
      );
      setItem(updated);
      onStatusChanged();
      toast.success(t("improvement.statusChanged", "상태가 변경되었습니다"));
    } catch {
      toast.error(t("improvement.statusChangeError", "상태 변경 실패"));
    } finally {
      setIsUpdating(false);
    }
  }, [item, imprId, onStatusChanged, t, evidence]);

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-border w-full max-w-2xl mx-4 max-h-[90vh] overflow-hidden flex flex-col">
        {/* 헤더 */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-border bg-surface flex-shrink-0">
          <h3 className="flex-1 text-sm font-bold text-text">
            {t("improvement.managePage")} — {t("common.detail", "상세")}
          </h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-surface-hover transition-colors">
            <X className="w-4 h-4 text-text-muted" />
          </button>
        </div>

        {/* 본문 */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {!item ? (
            <p className="text-sm text-text-muted text-center py-8">{t("common.loading", "로딩 중...")}</p>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <span className={`px-2 py-1 text-xs font-semibold rounded ${STATUS_COLORS[item.status] ?? ""}`}>
                  {t(`improvement.${item.status === "PENDING" ? "statusPending" : item.status === "IN_PROGRESS" ? "statusInProgress" : "statusDone"}`)}
                </span>
                <span className="text-xs text-text-muted">
                  {item.requesterNm ?? item.requesterId} · {new Date(item.createdAt).toLocaleString()}
                </span>
              </div>

              <div>
                <p className="text-xs font-medium text-text-muted mb-1">{t("improvement.pageUrl")}</p>
                <p className="text-sm font-mono text-text bg-surface rounded px-2 py-1.5 break-all">{item.pageUrl}</p>
              </div>

              {item.elementText && (
                <div>
                  <p className="text-xs font-medium text-text-muted mb-1">{t("improvement.selectedElement")}</p>
                  <p className="text-sm text-text bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800 rounded px-2 py-1.5">
                    <span className="text-xs text-orange-600 dark:text-orange-400 mr-2">&lt;{item.elementTag}&gt;</span>
                    {item.elementText}
                  </p>
                </div>
              )}

              <div>
                <p className="text-xs font-medium text-text-muted mb-1">{t("improvement.description")}</p>
                <p className="text-sm text-text bg-surface rounded px-3 py-2 whitespace-pre-wrap">{item.description}</p>
              </div>

              {item.status === "DONE" && (
                <div>
                  <p className="text-xs font-medium text-text-muted mb-1">{t("improvement.doneEvidenceTitle")}</p>
                  <dl className="text-xs bg-surface rounded px-3 py-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
                    <dt className="text-text-muted">{t("improvement.fixCommit")}</dt><dd className="font-mono text-text break-all">{item.fixCommit ?? "-"}</dd>
                    <dt className="text-text-muted">{t("improvement.fixTest")}</dt><dd className="text-text break-all">{item.fixTest ?? "-"}</dd>
                    <dt className="text-text-muted">{t("improvement.deploySha")}</dt><dd className="font-mono text-text break-all">{item.deploySha ?? "-"}</dd>
                    <dt className="text-text-muted">{t("improvement.doneAt")}</dt><dd className="text-text">{item.doneAt ? new Date(item.doneAt).toLocaleString() : "-"}</dd>
                  </dl>
                </div>
              )}

              {item.screenshot && !screenshotError ? (
                <div>
                  <p className="text-xs font-medium text-text-muted mb-1">{t("improvement.screenshot")}</p>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={item.screenshot} alt="screenshot" onError={() => setScreenshotError(true)} className="w-full rounded border border-border" />
                </div>
              ) : (
                <p className="text-xs text-text-muted">{t("improvement.noScreenshot")}</p>
              )}
            </>
          )}
        </div>

        {/* 푸터 — 상태 변경 */}
        {item && nextStatus && (
          <div className="px-5 py-3 border-t border-border bg-surface/50 flex-shrink-0 space-y-2">
            {nextStatus === "DONE" && (
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-text">{t("improvement.doneEvidenceTitle")}</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <input
                    value={evidence.fixCommit ?? ""}
                    onChange={(e) => setEvidence((v) => ({ ...v, fixCommit: e.target.value }))}
                    placeholder={t("improvement.fixCommit")}
                    className="h-9 px-2 text-xs font-mono rounded border border-border bg-white dark:bg-slate-900 text-text"
                  />
                  <input
                    value={evidence.fixTest ?? ""}
                    onChange={(e) => setEvidence((v) => ({ ...v, fixTest: e.target.value }))}
                    placeholder={t("improvement.fixTestPlaceholder")}
                    className="h-9 px-2 text-xs rounded border border-border bg-white dark:bg-slate-900 text-text"
                  />
                  <input
                    value={evidence.deploySha ?? ""}
                    onChange={(e) => setEvidence((v) => ({ ...v, deploySha: e.target.value }))}
                    placeholder={t("improvement.deploySha")}
                    className="h-9 px-2 text-xs font-mono rounded border border-border bg-white dark:bg-slate-900 text-text"
                  />
                </div>
                <p className={`text-xs ${missingEvidence.length > 0 ? "text-red-600 dark:text-red-400" : "text-text-muted"}`}>
                  {missingEvidence.length > 0
                    ? t("improvement.doneEvidenceMissing", { fields: missingEvidence.map((f) => t(`improvement.${f}`)).join(", ") })
                    : t("improvement.doneEvidenceHint")}
                </p>
              </div>
            )}
            <div className="flex justify-end">
            <button
              onClick={() => handleStatusChange(nextStatus)}
              disabled={isUpdating || missingEvidence.length > 0}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors disabled:opacity-50"
            >
              {item.status === "PENDING" ? t("improvement.startProcessing", "처리 시작") : t("improvement.completeProcessing", "완료 처리")}
            </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
