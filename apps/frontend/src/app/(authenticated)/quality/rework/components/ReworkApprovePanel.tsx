"use client";

/**
 * @file quality/rework/components/ReworkApprovePanel.tsx
 * @description 재작업 승인/반려 우측 슬라이드 패널
 *
 * 초보자 가이드:
 * 1. type="qc" → 품질담당 승인/반려, type="prod" → 생산담당 승인/반려
 * 2. 승인/반려 라디오 선택, 반려 시 사유 입력
 * 3. onSubmit(action, reason)으로 부모에 결과 전달
 */
import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";
import { Button } from "@/components/ui";

interface Props {
  type: "qc" | "prod";
  onClose: () => void;
  onSubmit: (action: "APPROVE" | "REJECT", reason?: string) => Promise<void>;
  animate?: boolean;
}

export default function ReworkApprovePanel({ type, onClose, onSubmit, animate = true }: Props) {
  const { t } = useTranslation();
  const [action, setAction] = useState<"APPROVE" | "REJECT">("APPROVE");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setAction("APPROVE");
    setReason("");
  }, [type]);

  const title = type === "qc" ? t("quality.rework.qcApprove") : t("quality.rework.prodApprove");

  const handleSubmit = async () => {
    if (action === "REJECT" && !reason.trim()) return;
    setSubmitting(true);
    try {
      await onSubmit(action, action === "REJECT" ? reason : undefined);
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={`w-[400px] border-l border-border bg-background flex flex-col h-full overflow-hidden shadow-2xl text-xs ${animate ? "animate-slide-in-right" : ""}`}>
      {/* 헤더 */}
      <div className="px-5 py-3 border-b border-border flex items-center justify-between flex-shrink-0">
        <h2 className="text-sm font-bold text-text">{title}</h2>
        <button onClick={onClose} className="p-1 rounded hover:bg-surface transition-colors">
          <X className="w-4 h-4 text-text-muted hover:text-text" />
        </button>
      </div>

      {/* 본문 */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        <div className="flex gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="radio" name="approveAction" value="APPROVE"
              checked={action === "APPROVE"} onChange={() => setAction("APPROVE")}
              className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium text-green-600 dark:text-green-400">
              {t("quality.rework.approve")}
            </span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="radio" name="approveAction" value="REJECT"
              checked={action === "REJECT"} onChange={() => setAction("REJECT")}
              className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium text-red-600 dark:text-red-400">
              {t("quality.rework.reject")}
            </span>
          </label>
        </div>

        {action === "REJECT" && (
          <div>
            <label className="block text-xs font-medium text-text mb-1">
              {t("quality.rework.rejectReason")}<span className="text-red-500 ml-1">*</span>
            </label>
            <textarea
              className="w-full rounded-md border border-border bg-white dark:bg-slate-900
                text-text px-3 py-2 text-xs min-h-[100px] focus:outline-none focus:ring-2
                focus:ring-primary/30 focus:border-primary"
              value={reason} onChange={e => setReason(e.target.value)}
              placeholder={t("quality.rework.rejectReason")}
            />
          </div>
        )}
      </div>

      {/* 푸터 */}
      <div className="px-5 py-3 border-t border-border flex gap-2 justify-end flex-shrink-0">
        <Button variant="secondary" onClick={onClose}>{t("common.cancel")}</Button>
        <Button onClick={handleSubmit}
          disabled={submitting || (action === "REJECT" && !reason.trim())}
          variant={action === "REJECT" ? "danger" : "primary"}>
          {submitting ? t("common.saving") : action === "APPROVE" ? t("quality.rework.approve") : t("quality.rework.reject")}
        </Button>
      </div>
    </div>
  );
}
