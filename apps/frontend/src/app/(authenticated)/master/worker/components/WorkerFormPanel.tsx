/**
 * @file src/app/(authenticated)/master/worker/components/WorkerFormPanel.tsx
 * @description 작업자 추가/수정 오른쪽 슬라이드 패널
 *
 * 초보자 가이드:
 * 1. **슬라이드 패널**: 오른쪽에서 슬라이드 인/아웃되는 폼 패널
 * 2. **사진 업로드**: 상단에 사진 크롭/업로드 영역
 * 3. **API**: POST /master/workers (생성), PUT /master/workers/:id (수정)
 */

"use client";

import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";
import { Button, Input, Select } from "@/components/ui";
import WorkerPhotoUpload from "@/components/worker/WorkerPhotoUpload";
import api from "@/services/api";
import { Worker } from "../types";

interface Props {
  editingWorker: Worker | null;
  onClose: () => void;
  onSave: () => void;
  animate?: boolean;
}

export default function WorkerFormPanel({ editingWorker, onClose, onSave, animate = true }: Props) {
  const { t } = useTranslation();
  const isEdit = !!editingWorker;

  const [form, setForm] = useState({
    workerCode: editingWorker?.workerCode ?? "",
    workerName: editingWorker?.workerName ?? "",
    engName: editingWorker?.engName ?? "",
    dept: editingWorker?.dept ?? "",
    position: editingWorker?.position ?? "",
    phone: editingWorker?.phone ?? "",
    email: editingWorker?.email ?? "",
    hireDate: editingWorker?.hireDate ?? "",
    quitDate: editingWorker?.quitDate ?? "",
    qrCode: editingWorker?.qrCode ?? "",
    remark: editingWorker?.remark ?? "",
    useYn: editingWorker?.useYn ?? "Y",
  });
  const [photoUrl, setPhotoUrl] = useState<string | null>(editingWorker?.photoUrl ?? null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  useEffect(() => {
    setForm({
      workerCode: editingWorker?.workerCode ?? "",
      workerName: editingWorker?.workerName ?? "",
      engName: editingWorker?.engName ?? "",
      dept: editingWorker?.dept ?? "",
      position: editingWorker?.position ?? "",
      phone: editingWorker?.phone ?? "",
      email: editingWorker?.email ?? "",
      hireDate: editingWorker?.hireDate ?? "",
      quitDate: editingWorker?.quitDate ?? "",
      qrCode: editingWorker?.qrCode ?? "",
      remark: editingWorker?.remark ?? "",
      useYn: editingWorker?.useYn ?? "Y",
    });
    setPhotoUrl(editingWorker?.photoUrl ?? null);
    setFormError("");
  }, [editingWorker]);

  const setField = (key: string, value: string) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async () => {
    setFormError("");
    if (!form.workerCode.trim() || !form.workerName.trim()) {
      setFormError(t("common.requiredField", "필수 항목을 입력하세요."));
      return;
    }
    setSaving(true);
    try {
      const payload = {
        workerCode: form.workerCode.trim(),
        workerName: form.workerName.trim(),
        engName: form.engName.trim() || undefined,
        dept: form.dept.trim() || undefined,
        position: form.position.trim() || undefined,
        phone: form.phone.trim() || undefined,
        email: form.email.trim() || undefined,
        hireDate: form.hireDate.trim() || undefined,
        quitDate: form.quitDate.trim() || undefined,
        qrCode: form.qrCode.trim() || undefined,
        photoUrl: photoUrl || undefined,
        remark: form.remark.trim() || undefined,
        useYn: form.useYn,
      };
      if (isEdit && editingWorker?.id) {
        await api.put(`/master/workers/${editingWorker.id}`, payload);
      } else {
        await api.post("/master/workers", payload);
      }
      onSave();
      onClose();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      setFormError(error.response?.data?.message || t("common.saveFailed"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={`w-[480px] border-l border-border bg-background flex flex-col h-full overflow-hidden shadow-2xl text-xs ${animate ? 'animate-slide-in-right' : ''}`}>
      <div className="px-5 py-3 border-b border-border flex items-center justify-between flex-shrink-0">
        <h2 className="text-sm font-bold text-text">
          {isEdit ? t("master.worker.editWorker", "작업자 수정") : t("master.worker.addWorker", "작업자 추가")}
        </h2>
        <button onClick={onClose} className="p-1 rounded hover:bg-surface transition-colors">
          <X className="w-4 h-4 text-text-muted hover:text-text" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-3 space-y-4">
        {formError && (
          <div className="p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-xs text-red-600 dark:text-red-400">
            {formError}
          </div>
        )}

        {/* 사진 영역 */}
        <div className="flex justify-center">
          <WorkerPhotoUpload value={photoUrl} onChange={setPhotoUrl} />
        </div>

        {/* 기본정보 */}
        <div>
          <h3 className="text-xs font-semibold text-text-muted mb-2">{t("master.worker.sectionBasic", "기본정보")}</h3>
          <div className="grid grid-cols-2 gap-3">
            <Input label={t("master.worker.workerCode", "작업자코드")}
              value={form.workerCode} onChange={e => setField("workerCode", e.target.value)}
              disabled={isEdit} fullWidth />
            <Input label={t("master.worker.workerName", "작업자명")}
              value={form.workerName} onChange={e => setField("workerName", e.target.value)} fullWidth />
            <Input label={t("master.worker.engName", "영문명")}
              value={form.engName} onChange={e => setField("engName", e.target.value)} fullWidth />
            <Input label={t("master.worker.dept", "부서")}
              value={form.dept} onChange={e => setField("dept", e.target.value)} fullWidth />
            <Input label={t("master.worker.position", "직급")}
              value={form.position} onChange={e => setField("position", e.target.value)} fullWidth />
            <Input label={t("master.worker.phone", "전화번호")}
              value={form.phone} onChange={e => setField("phone", e.target.value)} fullWidth />
            <Input label={t("master.worker.email", "이메일")}
              value={form.email} onChange={e => setField("email", e.target.value)} fullWidth />
            <Input label={t("master.worker.qrCode", "QR코드")}
              value={form.qrCode} onChange={e => setField("qrCode", e.target.value)} fullWidth />
          </div>
        </div>

        {/* 근무정보 */}
        <div>
          <h3 className="text-xs font-semibold text-text-muted mb-2">{t("master.worker.sectionWork", "근무정보")}</h3>
          <div className="grid grid-cols-2 gap-3">
            <Input label={t("master.worker.hireDate", "입사일")} placeholder="YYYYMMDD"
              value={form.hireDate} onChange={e => setField("hireDate", e.target.value)} fullWidth />
            <Input label={t("master.worker.quitDate", "퇴사일")} placeholder="YYYYMMDD"
              value={form.quitDate} onChange={e => setField("quitDate", e.target.value)} fullWidth />
            <Select label={t("master.worker.use", "사용")}
              options={[{ value: "Y", label: t("common.yes", "사용") }, { value: "N", label: t("common.no", "미사용") }]}
              value={form.useYn} onChange={v => setField("useYn", v)} fullWidth />
          </div>
        </div>

        {/* 비고 */}
        <div>
          <Input label={t("master.worker.remark", "비고")}
            value={form.remark} onChange={e => setField("remark", e.target.value)} fullWidth />
        </div>
      </div>

      <div className="px-5 py-3 border-t border-border flex gap-2 justify-end flex-shrink-0">
        <Button variant="secondary" onClick={onClose}>{t("common.cancel")}</Button>
        <Button onClick={handleSubmit} disabled={saving || !form.workerCode.trim() || !form.workerName.trim()}>
          {saving ? t("common.saving") : (isEdit ? t("common.edit") : t("common.add"))}
        </Button>
      </div>
    </div>
  );
}
