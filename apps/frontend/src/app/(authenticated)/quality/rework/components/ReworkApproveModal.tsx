"use client";

/**
 * @file src/app/(authenticated)/quality/rework/components/ReworkApproveModal.tsx
 * @description 재작업 승인/반려 모달 — 품질승인(QC) 또는 생산승인(PROD) 처리
 *
 * 초보자 가이드:
 * 1. type="qc" → 품질담당 승인/반려, type="prod" → 생산담당 승인/반려
 * 2. 승인/반려 라디오 선택 후, 반려 시 사유 textarea 표시
 * 3. onSubmit(action, reason)으로 부모에 결과 전달
 * 4. API: PATCH /quality/reworks/:id/qc-approve 또는 prod-approve
 */
import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Button, Modal } from "@/components/ui";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  type: "qc" | "prod";
  onSubmit: (action: "APPROVE" | "REJECT", reason?: string) => Promise<void>;
}

export default function ReworkApproveModal({ isOpen, onClose, type, onSubmit }: Props) {
  const { t } = useTranslation();
  const [action, setAction] = useState<"APPROVE" | "REJECT">("APPROVE");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setAction("APPROVE");
      setReason("");
    }
  }, [isOpen]);

  const title = type === "qc" ? t("quality.rework.qcApprove") : t("quality.rework.prodApprove");

  const handleSubmit = async () => {
    if (action === "REJECT" && !reason.trim()) return;
    setSubmitting(true);
    try {
      await onSubmit(action, action === "REJECT" ? reason : undefined);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="md">
      <div className="space-y-4">
        {/* 승인/반려 라디오 선택 */}
        <div className="flex gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio" name="approveAction" value="APPROVE"
              checked={action === "APPROVE"}
              onChange={() => setAction("APPROVE")}
              className="w-4 h-4 text-primary"
            />
            <span className="text-sm font-medium text-green-600 dark:text-green-400">
              {t("quality.rework.approve")}
            </span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio" name="approveAction" value="REJECT"
              checked={action === "REJECT"}
              onChange={() => setAction("REJECT")}
              className="w-4 h-4 text-primary"
            />
            <span className="text-sm font-medium text-red-600 dark:text-red-400">
              {t("quality.rework.reject")}
            </span>
          </label>
        </div>

        {/* 반려 사유 (반려 선택 시만 표시) */}
        {action === "REJECT" && (
          <div>
            <label className="block text-sm font-medium text-text mb-1">
              {t("quality.rework.rejectReason")}
              <span className="text-red-500 ml-1">*</span>
            </label>
            <textarea
              className="w-full rounded-md border border-border bg-white dark:bg-slate-900
                text-text px-3 py-2 text-sm min-h-[100px] focus:outline-none focus:ring-2
                focus:ring-primary/30 focus:border-primary"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={t("quality.rework.rejectReason")}
            />
          </div>
        )}

        {/* 버튼 */}
        <div className="flex justify-end gap-2 pt-4 mt-4 border-t border-border">
          <Button variant="secondary" onClick={onClose}>{t("common.cancel")}</Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting || (action === "REJECT" && !reason.trim())}
            variant={action === "REJECT" ? "danger" : "primary"}
          >
            {submitting
              ? t("common.saving")
              : action === "APPROVE"
                ? t("quality.rework.approve")
                : t("quality.rework.reject")}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
