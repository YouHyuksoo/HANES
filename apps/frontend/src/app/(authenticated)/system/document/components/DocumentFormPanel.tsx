/**
 * @file system/document/components/DocumentFormPanel.tsx
 * @description 문서관리 등록/수정 우측 슬라이드 패널 — 승인/개정 기능 포함
 *
 * 초보자 가이드:
 * 1. editData=null → 신규, editData 있으면 수정
 * 2. 승인(DRAFT→APPROVED), 개정(APPROVED→새 개정) 버튼 제공
 */
"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { X, CheckCircle, RotateCw } from "lucide-react";
import { Button, Input, ComCodeBadge } from "@/components/ui";
import { ConfirmModal } from "@/components/ui/Modal";
import { ComCodeSelect } from "@/components/shared";
import api from "@/services/api";

interface DocumentData {
  id: number; docNo: string; docTitle: string; docType: string;
  category: string; revisionNo: number; status: string;
  approvedBy: string; approvedAt: string; filePath: string;
  retentionPeriod: number; description: string;
}

interface FormState {
  docTitle: string; docType: string; category: string;
  filePath: string; retentionPeriod: string; description: string;
}

const INIT: FormState = {
  docTitle: "", docType: "", category: "", filePath: "", retentionPeriod: "", description: "",
};

interface Props { editData: DocumentData | null; onClose: () => void; onSave: () => void; }

export default function DocumentFormPanel({ editData, onClose, onSave }: Props) {
  const { t } = useTranslation();
  const isEdit = !!editData;
  const [form, setForm] = useState<FormState>(INIT);
  const [saving, setSaving] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{
    label: string; action: () => Promise<void>;
  } | null>(null);

  useEffect(() => {
    if (editData) {
      setForm({
        docTitle: editData.docTitle ?? "", docType: editData.docType ?? "",
        category: editData.category ?? "", filePath: editData.filePath ?? "",
        retentionPeriod: String(editData.retentionPeriod ?? ""),
        description: editData.description ?? "",
      });
    } else { setForm(INIT); }
  }, [editData]);

  const setField = (key: keyof FormState, val: string) => setForm(p => ({ ...p, [key]: val }));

  const handleSave = useCallback(async () => {
    if (!form.docTitle || !form.docType) return;
    setSaving(true);
    try {
      const payload = {
        docTitle: form.docTitle, docType: form.docType,
        category: form.category || undefined, filePath: form.filePath || undefined,
        retentionPeriod: Number(form.retentionPeriod) || undefined,
        description: form.description || undefined,
      };
      if (isEdit && editData) await api.patch(`/system/documents/${editData.id}`, payload);
      else await api.post("/system/documents", payload);
      onSave();
    } catch { /* api interceptor */ } finally { setSaving(false); }
  }, [form, isEdit, editData, onSave]);

  const handleApprove = () => {
    if (!editData) return;
    setConfirmAction({ label: t("system.document.approve"),
      action: async () => { await api.patch(`/system/documents/approve/${editData.id}`); onSave(); },
    });
  };

  const handleRevise = () => {
    if (!editData) return;
    setConfirmAction({ label: t("system.document.revise"),
      action: async () => { await api.post(`/system/documents/revise/${editData.id}`); onSave(); },
    });
  };

  const canApprove = isEdit && editData?.status === "DRAFT";
  const canRevise = isEdit && editData?.status === "APPROVED";
  const canEdit = !isEdit || editData?.status === "DRAFT";

  return (
    <div className="w-[480px] border-l border-border bg-background flex flex-col h-full overflow-hidden shadow-2xl text-xs animate-slide-in-right">
      {/* 헤더 */}
      <div className="px-5 py-3 border-b border-border flex items-center justify-between flex-shrink-0">
        <h2 className="text-sm font-bold text-text">
          {isEdit ? t("system.document.editDoc") : t("system.document.createDoc")}
        </h2>
        <div className="flex items-center gap-2">
          {canApprove && (
            <Button size="sm" variant="secondary" onClick={handleApprove}>
              <CheckCircle className="w-3.5 h-3.5 mr-1" />{t("system.document.approve")}
            </Button>
          )}
          {canRevise && (
            <Button size="sm" variant="secondary" onClick={handleRevise}>
              <RotateCw className="w-3.5 h-3.5 mr-1" />{t("system.document.revise")}
            </Button>
          )}
          <Button size="sm" variant="secondary" onClick={onClose}><X className="w-3.5 h-3.5" /></Button>
          {canEdit && (
            <Button size="sm" onClick={handleSave} disabled={saving || !form.docTitle || !form.docType}>
              {saving ? t("common.saving") : t("common.save")}
            </Button>
          )}
        </div>
      </div>

      {/* 본문 */}
      <div className="flex-1 overflow-y-auto px-5 py-3 space-y-4">
        {/* 읽기전용 정보 */}
        {isEdit && editData && (
          <div className="grid grid-cols-2 gap-3 p-3 rounded-lg border border-border bg-surface dark:bg-slate-800">
            <div>
              <span className="text-[10px] text-text-muted block">{t("system.document.docNo")}</span>
              <span className="font-medium text-text">{editData.docNo}</span>
            </div>
            <div>
              <span className="text-[10px] text-text-muted block">{t("system.document.revisionNo")}</span>
              <span className="font-mono text-text">Rev.{editData.revisionNo}</span>
            </div>
            <div>
              <span className="text-[10px] text-text-muted block">{t("common.status")}</span>
              <ComCodeBadge groupCode="DOC_STATUS" code={editData.status} />
            </div>
            <div>
              <span className="text-[10px] text-text-muted block">{t("system.document.approvedBy")}</span>
              <span className="text-text">{editData.approvedBy || "-"}</span>
            </div>
            {editData.approvedAt && (
              <div className="col-span-2">
                <span className="text-[10px] text-text-muted block">{t("system.document.approvedAt")}</span>
                <span className="text-text">{editData.approvedAt?.slice(0, 16)}</span>
              </div>
            )}
          </div>
        )}

        {/* 편집 가능 필드 */}
        <Input label={t("system.document.docTitle")} value={form.docTitle}
          onChange={e => setField("docTitle", e.target.value)} readOnly={!canEdit} fullWidth />
        <ComCodeSelect groupCode="DOC_TYPE" includeAll={false}
          label={t("system.document.docType")} value={form.docType}
          onChange={v => setField("docType", v)} disabled={!canEdit} fullWidth />
        <Input label={t("system.document.category")} value={form.category}
          onChange={e => setField("category", e.target.value)} readOnly={!canEdit} fullWidth />
        <Input label={t("system.document.filePath")} value={form.filePath}
          onChange={e => setField("filePath", e.target.value)} readOnly={!canEdit} fullWidth />
        <Input label={t("system.document.retentionPeriod")} type="number" value={form.retentionPeriod}
          onChange={e => setField("retentionPeriod", e.target.value)} readOnly={!canEdit} fullWidth />
        <div>
          <label className="block text-xs font-medium text-text mb-1">{t("system.document.description")}</label>
          <textarea
            className="w-full rounded-md border border-border bg-white dark:bg-slate-900
              text-text px-3 py-2 text-xs min-h-[80px] focus:outline-none focus:ring-2
              focus:ring-primary/30 focus:border-primary"
            value={form.description} onChange={e => setField("description", e.target.value)}
            readOnly={!canEdit} />
        </div>
      </div>

      <ConfirmModal isOpen={!!confirmAction} onClose={() => setConfirmAction(null)}
        onConfirm={async () => { await confirmAction?.action(); setConfirmAction(null); }}
        title={confirmAction?.label ?? ""}
        message={`${confirmAction?.label ?? ""} ${t("common.confirm")}?`} />
    </div>
  );
}
