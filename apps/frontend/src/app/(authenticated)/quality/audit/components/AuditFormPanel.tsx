"use client";

/**
 * @file quality/audit/components/AuditFormPanel.tsx
 * @description 내부심사 등록/수정 모달
 *
 * 초보자 가이드:
 * 1. editData=null -> 신규 등록, editData 있으면 수정 모드
 * 2. 심사유형(auditType)은 ComCodeSelect(AUDIT_TYPE) 사용
 * 3. auditNo, status, overallResult는 readonly 표시
 */
import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Button, Input, ComCodeBadge, Modal } from "@/components/ui";
import { ComCodeSelect, WorkerSelect } from "@/components/shared";
import api from "@/services/api";

/** 심사 폼 데이터 */
interface AuditFormData {
  auditType: string;
  auditScope: string;
  targetDept: string;
  auditor: string;
  coAuditor: string;
  scheduledDate: string;
  summary: string;
}

const INIT: AuditFormData = {
  auditType: "", auditScope: "", targetDept: "",
  auditor: "", coAuditor: "", scheduledDate: "", summary: "",
};

/** 수정 시 전달되는 심사 데이터 */
interface AuditEditData {
  auditNo: string;
  auditType: string;
  auditScope: string;
  targetDept: string;
  auditor: string;
  coAuditor: string;
  scheduledDate: string;
  actualDate: string;
  status: string;
  overallResult: string;
  summary: string;
}

interface Props {
  isOpen: boolean;
  editData: AuditEditData | null;
  onClose: () => void;
  onSave: () => void;
}

export default function AuditFormPanel({ isOpen, editData, onClose, onSave }: Props) {
  const { t } = useTranslation();
  const isEdit = !!editData;
  const [form, setForm] = useState<AuditFormData>(INIT);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editData) {
      setForm({
        auditType: editData.auditType ?? "",
        auditScope: editData.auditScope ?? "",
        targetDept: editData.targetDept ?? "",
        auditor: editData.auditor ?? "",
        coAuditor: editData.coAuditor ?? "",
        scheduledDate: editData.scheduledDate?.slice(0, 10) ?? "",
        summary: editData.summary ?? "",
      });
    } else {
      setForm(INIT);
    }
  }, [editData]);

  const setField = (key: keyof AuditFormData, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = useCallback(async () => {
    if (!form.auditType || !form.targetDept || !form.auditor) return;
    setSaving(true);
    try {
      const payload = {
        auditType: form.auditType,
        auditScope: form.auditScope || undefined,
        targetDept: form.targetDept,
        auditor: form.auditor,
        coAuditor: form.coAuditor || undefined,
        scheduledDate: form.scheduledDate || undefined,
        summary: form.summary || undefined,
      };
      if (isEdit && editData) {
        await api.patch(`/quality/audits/${editData.auditNo}`, payload);
      } else {
        await api.post("/quality/audits", payload);
      }
      onSave();
      onClose();
    } catch {
      // api 인터셉터에서 처리
    } finally {
      setSaving(false);
    }
  }, [form, isEdit, editData, onSave, onClose]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg"
      title={isEdit ? `${t("common.edit")} - ${t("quality.audit.title")}` : `${t("common.add")} - ${t("quality.audit.title")}`}
      footer={
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="secondary" onClick={onClose}>{t("common.cancel")}</Button>
          <Button size="sm" onClick={handleSave}
            disabled={saving || !form.auditType || !form.targetDept || !form.auditor}>
            {saving ? t("common.saving") : t("common.save")}
          </Button>
        </div>
      }>
      <div className="space-y-4 text-xs">
        {/* readonly 정보 (수정 모드) */}
        {isEdit && editData && (
          <div className="grid grid-cols-3 gap-3 p-3 rounded-lg border border-border bg-surface dark:bg-slate-800">
            <div>
              <span className="text-[10px] text-text-muted">{t("quality.audit.auditNo")}</span>
              <p className="font-medium text-text">{editData.auditNo}</p>
            </div>
            <div>
              <span className="text-[10px] text-text-muted">{t("quality.audit.status")}</span>
              <div className="mt-0.5">
                <ComCodeBadge groupCode="AUDIT_STATUS" code={editData.status} />
              </div>
            </div>
            <div>
              <span className="text-[10px] text-text-muted">{t("quality.audit.overallResult")}</span>
              <div className="mt-0.5">
                {editData.overallResult
                  ? <ComCodeBadge groupCode="AUDIT_RESULT" code={editData.overallResult} />
                  : <span className="text-text-muted">-</span>}
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <ComCodeSelect groupCode="AUDIT_TYPE" includeAll={false}
            label={t("quality.audit.auditType")} value={form.auditType}
            onChange={(v) => setField("auditType", v)} fullWidth />
          <Input label={t("quality.audit.targetDept")} value={form.targetDept}
            onChange={(e) => setField("targetDept", e.target.value)} fullWidth />
        </div>

        <Input label={t("quality.audit.auditScope")} value={form.auditScope}
          onChange={(e) => setField("auditScope", e.target.value)} fullWidth />

        <div className="grid grid-cols-2 gap-3">
          <WorkerSelect label={t("quality.audit.auditor")} value={form.auditor}
            onChange={(v) => setField("auditor", v)} fullWidth />
          <WorkerSelect label={t("quality.audit.coAuditor")} value={form.coAuditor}
            onChange={(v) => setField("coAuditor", v)} fullWidth />
        </div>

        <Input label={t("quality.audit.scheduledDate")} type="date"
          value={form.scheduledDate}
          onChange={(e) => setField("scheduledDate", e.target.value)} fullWidth />

        <div>
          <label className="block text-xs font-medium text-text mb-1">
            {t("quality.audit.summary")}
          </label>
          <textarea
            className="w-full rounded-md border border-border bg-white dark:bg-slate-900
              text-text px-3 py-2 text-xs min-h-[100px] focus:outline-none focus:ring-2
              focus:ring-primary/30 focus:border-primary"
            value={form.summary}
            onChange={(e) => setField("summary", e.target.value)}
          />
        </div>
      </div>
    </Modal>
  );
}
