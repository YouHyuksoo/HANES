"use client";

/**
 * @file inspection/result/components/FailModal.tsx
 * @description 통전검사 불합격 등록 모달 - 불량코드 + 상세 입력
 *
 * 초보자 가이드:
 * 1. FAIL 버튼 클릭 시 열리는 모달
 * 2. ComCodeSelect로 DEFECT_TYPE 그룹코드에서 불량 유형 선택
 * 3. 상세 내용 텍스트 입력 후 저장
 */
import { useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Button, Modal } from "@/components/ui";
import { ComCodeSelect } from "@/components/shared";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (errorCode: string, errorDetail: string) => Promise<void>;
  submitting: boolean;
}

export default function FailModal({ isOpen, onClose, onSubmit, submitting }: Props) {
  const { t } = useTranslation();
  const [errorCode, setErrorCode] = useState("");
  const [errorDetail, setErrorDetail] = useState("");

  const handleSubmit = useCallback(async () => {
    await onSubmit(errorCode, errorDetail);
    setErrorCode("");
    setErrorDetail("");
  }, [errorCode, errorDetail, onSubmit]);

  const handleClose = useCallback(() => {
    setErrorCode("");
    setErrorDetail("");
    onClose();
  }, [onClose]);

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={t("inspection.result.failBtn")} size="md">
      <div className="flex flex-col gap-4 p-4">
        <div>
          <label className="block text-sm font-medium text-text mb-1">
            {t("inspection.result.errorCode")}
          </label>
          <ComCodeSelect
            groupCode="CONTINUITY_DEFECT"
            includeAll={false}
            value={errorCode}
            onChange={setErrorCode}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-text mb-1">
            {t("inspection.result.errorDesc")}
          </label>
          <textarea
            className="w-full rounded-lg border border-border bg-surface dark:bg-slate-800
              text-text p-2 text-sm focus:ring-2 focus:ring-primary focus:outline-none"
            rows={3}
            value={errorDetail}
            onChange={(e) => setErrorDetail(e.target.value)}
          />
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={handleClose}>
            {t("common.cancel")}
          </Button>
          <Button variant="primary" onClick={handleSubmit} disabled={submitting}>
            {t("common.save")}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
