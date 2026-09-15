"use client";

/**
 * @file quality/ncr/components/NcrActionModal.tsx
 * @description 부적합 보고서 상태 전이 입력 모달 — 처리방안 확정 / 원인·재발방지 / 종결.
 *
 * 초보자 가이드:
 * 1. 세 가지 화면을 한 컴포넌트로 묶은 이유는 입력칸만 다르고 흐름(입력→PATCH→새로고침)이 같기 때문이다.
 * 2. 종결은 서버가 "처리방안 + 발생 원인"이 모두 있어야 허용한다. 화면에서도 미리 막아 안내한다.
 * 3. 처리방안 후보는 대상구분에 맞는 순서로 정렬해 보여준다(강제 아님 — 예외 처리를 막지 않는다).
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Modal, Button, Input, Select } from "@/components/ui";
import ComCodeSelect from "@/components/shared/ComCodeSelect";
import { useComCodeOptions } from "@/hooks/useComCode";
import api from "@/services/api";
import { DISPOSITION_PRIORITY, type NcrReport } from "../types";

export type NcrActionMode = "disposition" | "cause" | "close";

interface Props {
  mode: NcrActionMode | null;
  record: NcrReport | null;
  onClose: () => void;
  onDone: () => void;
}

export default function NcrActionModal({ mode, record, onClose, onDone }: Props) {
  const { t } = useTranslation();
  const [saving, setSaving] = useState(false);

  /* 처리방안 */
  const [disposition, setDisposition] = useState("");
  const [dispositionDetail, setDispositionDetail] = useState("");
  const [dueActionDate, setDueActionDate] = useState("");
  const [responsibleCode, setResponsibleCode] = useState("");

  /* 원인·대책 */
  const [causeCategory, setCauseCategory] = useState("");
  const [rootCause, setRootCause] = useState("");
  const [preventiveAction, setPreventiveAction] = useState("");

  /* 종결 */
  const [approverCode, setApproverCode] = useState("");
  const [remark, setRemark] = useState("");

  const dispositionOptionsRaw = useComCodeOptions("NCR_DISPOSITION");

  useEffect(() => {
    if (!record) return;
    setDisposition(record.disposition ?? "");
    setDispositionDetail(record.dispositionDetail ?? "");
    setDueActionDate(record.dueActionDate?.slice(0, 10) ?? "");
    setResponsibleCode(record.responsibleCode ?? "");
    setCauseCategory(record.causeCategory ?? "");
    setRootCause(record.rootCause ?? "");
    setPreventiveAction(record.preventiveAction ?? "");
    setApproverCode(record.approverCode ?? "");
    setRemark("");
  }, [record]);

  /**
   * 대상구분에 맞는 순서로 정렬한 처리방안 후보.
   * 우선순위에 없는 코드(나중에 공통코드가 늘어난 경우)는 뒤에 그대로 붙인다 — 빠뜨리지 않기 위해서다.
   */
  const dispositionOptions = useMemo(() => {
    const order = (record ? DISPOSITION_PRIORITY[record.targetType] : []) ?? [];
    const rank = (code: string) => {
      const i = order.indexOf(code as never);
      return i < 0 ? order.length : i;
    };
    return [...dispositionOptionsRaw].sort((a, b) => rank(a.value) - rank(b.value));
  }, [record, dispositionOptionsRaw]);

  /** 종결 선행조건 — 서버와 같은 규칙을 화면에서 먼저 안내한다 */
  const closeBlockReason = useMemo(() => {
    if (!record) return null;
    if (!record.disposition) return t("quality.ncr.closeNeedDisposition", "처리방안을 먼저 확정해야 종결할 수 있습니다.");
    if (!record.rootCause) return t("quality.ncr.closeNeedCause", "발생 원인을 먼저 기재해야 종결할 수 있습니다.");
    return null;
  }, [record, t]);

  const canSubmit = useMemo(() => {
    if (saving || !record) return false;
    if (mode === "disposition") return Boolean(disposition);
    if (mode === "cause") return Boolean(rootCause.trim());
    if (mode === "close") return Boolean(approverCode.trim()) && !closeBlockReason;
    return false;
  }, [saving, record, mode, disposition, rootCause, approverCode, closeBlockReason]);

  const handleSubmit = useCallback(async () => {
    if (!canSubmit || !record) return;
    setSaving(true);
    try {
      const no = encodeURIComponent(record.ncrNo);
      if (mode === "disposition") {
        await api.patch(`/quality/ncr/${no}/disposition`, {
          disposition,
          ...(dispositionDetail.trim() ? { dispositionDetail: dispositionDetail.trim() } : {}),
          ...(dueActionDate ? { dueActionDate } : {}),
          ...(responsibleCode.trim() ? { responsibleCode: responsibleCode.trim() } : {}),
        });
      } else if (mode === "cause") {
        await api.patch(`/quality/ncr/${no}/cause`, {
          ...(causeCategory ? { causeCategory } : {}),
          rootCause: rootCause.trim(),
          ...(preventiveAction.trim() ? { preventiveAction: preventiveAction.trim() } : {}),
        });
      } else {
        await api.patch(`/quality/ncr/${no}/close`, {
          approverCode: approverCode.trim(),
          ...(remark.trim() ? { remark: remark.trim() } : {}),
        });
      }
      onDone();
      onClose();
    } catch {
      // 오류 토스트는 api 인터셉터가 띄운다
    } finally {
      setSaving(false);
    }
  }, [
    canSubmit, record, mode, disposition, dispositionDetail, dueActionDate, responsibleCode,
    causeCategory, rootCause, preventiveAction, approverCode, remark, onDone, onClose,
  ]);

  const title =
    mode === "disposition" ? t("quality.ncr.setDisposition", "처리방안 확정")
      : mode === "cause" ? t("quality.ncr.setCause", "원인분석·재발방지")
        : t("quality.ncr.closeTitle", "부적합 종결");

  return (
    <Modal
      isOpen={!!mode && !!record}
      onClose={onClose}
      title={`${title}${record ? ` · ${record.ncrNo}` : ""}`}
      size="lg"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>{t("common.cancel", "취소")}</Button>
          <Button onClick={handleSubmit} disabled={!canSubmit}>{t("common.confirm", "확인")}</Button>
        </div>
      }
    >
      <div className="space-y-4 text-sm">
        {mode === "disposition" && (
          <>
            <Select
              label={t("quality.ncr.disposition", "처리방안")}
              options={dispositionOptions}
              value={disposition}
              onChange={setDisposition}
              fullWidth
              required
            />
            <div>
              <label className="block mb-1 font-medium text-text">
                {t("quality.ncr.dispositionDetail", "세부내용 및 사유")}
              </label>
              <textarea
                className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm"
                rows={4}
                value={dispositionDetail}
                onChange={(e) => setDispositionDetail(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input type="date" label={t("quality.ncr.dueActionDate", "처리기한")}
                value={dueActionDate} onChange={(e) => setDueActionDate(e.target.value)} fullWidth />
              <Input label={t("quality.ncr.responsibleCode", "처리 책임자")}
                value={responsibleCode} onChange={(e) => setResponsibleCode(e.target.value)} fullWidth />
            </div>
          </>
        )}

        {mode === "cause" && (
          <>
            <ComCodeSelect
              groupCode="NCR_CAUSE_CATEGORY"
              includeAll={false}
              label={t("quality.ncr.causeCategoryLabel", "원인분류(4M1E)")}
              value={causeCategory}
              onChange={setCauseCategory}
              fullWidth
            />
            <div>
              <label className="block mb-1 font-medium text-text">
                {t("quality.ncr.rootCause", "발생 원인")}<span className="text-red-500 ml-0.5">*</span>
              </label>
              <textarea
                className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm"
                rows={4}
                placeholder={t("quality.ncr.rootCausePlaceholder", "예: 압착 치공구 마모로 압착력 저하")}
                value={rootCause}
                onChange={(e) => setRootCause(e.target.value)}
              />
            </div>
            <div>
              <label className="block mb-1 font-medium text-text">
                {t("quality.ncr.preventiveAction", "재발방지 대책")}
              </label>
              <textarea
                className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm"
                rows={4}
                value={preventiveAction}
                onChange={(e) => setPreventiveAction(e.target.value)}
              />
            </div>
          </>
        )}

        {mode === "close" && (
          <>
            {closeBlockReason && (
              <p className="border border-border rounded-lg px-3 py-2 text-text-muted">
                {closeBlockReason}
              </p>
            )}
            <Input label={t("quality.ncr.approverCode", "승인자")} value={approverCode}
              onChange={(e) => setApproverCode(e.target.value)} fullWidth required />
            <div>
              <label className="block mb-1 font-medium text-text">{t("common.remark", "비고")}</label>
              <textarea
                className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm"
                rows={3}
                value={remark}
                onChange={(e) => setRemark(e.target.value)}
              />
            </div>
            <p className="text-xs text-text-muted">
              {t("quality.ncr.closeNotice", "종결하면 수정할 수 없습니다. 품질기록으로 보존됩니다.")}
            </p>
          </>
        )}
      </div>
    </Modal>
  );
}
