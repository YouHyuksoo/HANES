/**
 * @file src/app/(authenticated)/master/work-instruction/components/WorkInstructionFormPanel.tsx
 * @description 작업지도서 추가/수정 오른쪽 슬라이드 패널 (파일 업로드 지원)
 *
 * 초보자 가이드:
 * 1. **슬라이드 패널**: 오른쪽에서 슬라이드 인/아웃되는 폼 패널
 * 2. **파일 업로드**: 이미지/PDF 파일을 드래그&드롭 또는 클릭으로 업로드
 * 3. **API**: POST /master/work-instructions/upload (파일), POST/PUT (데이터)
 */

"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { X, Upload, FileImage, FileText, Trash2 } from "lucide-react";
import { Button, Input } from "@/components/ui";
import api from "@/services/api";

interface WorkInstruction {
  id: string;
  itemCode: string;
  itemName: string;
  processCode?: string;
  title: string;
  revision: string;
  imageUrl?: string;
  useYn: string;
  updatedAt: string;
}

interface Props {
  editingItem: WorkInstruction | null;
  onClose: () => void;
  onSave: () => void;
  animate?: boolean;
}

export type { WorkInstruction };

/** 이미지 확장자 판별 */
const isImageUrl = (url: string) => /\.(jpg|jpeg|png|gif|bmp|webp)$/i.test(url);

export default function WorkInstructionFormPanel({ editingItem, onClose, onSave, animate = true }: Props) {
  const { t } = useTranslation();
  const isEdit = !!editingItem;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    itemCode: editingItem?.itemCode || "",
    processCode: editingItem?.processCode || "",
    title: editingItem?.title || "",
    revision: editingItem?.revision || "",
    imageUrl: editingItem?.imageUrl || "",
    content: "",
  });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  useEffect(() => {
    setForm({
      itemCode: editingItem?.itemCode || "",
      processCode: editingItem?.processCode || "",
      title: editingItem?.title || "",
      revision: editingItem?.revision || "",
      imageUrl: editingItem?.imageUrl || "",
      content: "",
    });
  }, [editingItem]);

  const setField = (key: string, value: string) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  /** 파일 업로드 처리 */
  const handleFileUpload = useCallback(async (file: File) => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await api.post("/master/work-instructions/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      if (res.data?.success && res.data.data?.url) {
        setForm(prev => ({ ...prev, imageUrl: res.data.data.url }));
      }
    } catch {
      // 에러는 api 인터셉터에서 처리
    } finally {
      setUploading(false);
    }
  }, []);

  /** 파일 input change */
  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileUpload(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [handleFileUpload]);

  /** 드래그 앤 드롭 */
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFileUpload(file);
  }, [handleFileUpload]);

  const handleSubmit = async () => {
    if (!form.itemCode.trim() || !form.title.trim()) return;
    setSaving(true);
    try {
      if (isEdit && editingItem?.id) {
        await api.put(`/master/work-instructions/${editingItem.id}`, form);
      } else {
        await api.post("/master/work-instructions", form);
      }
      onSave();
      onClose();
    } catch {
      // 에러는 api 인터셉터에서 처리
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={`w-[480px] border-l border-border bg-background flex flex-col h-full overflow-hidden shadow-2xl text-xs ${animate ? 'animate-slide-in-right' : ''}`}>
      <div className="px-5 py-3 border-b border-border flex items-center justify-between flex-shrink-0">
        <h2 className="text-sm font-bold text-text">
          {isEdit ? t("master.workInstruction.editDoc") : t("master.workInstruction.addDoc")}
        </h2>
        <button onClick={onClose} className="p-1 rounded hover:bg-surface transition-colors">
          <X className="w-4 h-4 text-text-muted hover:text-text" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-3 space-y-4">
        {/* 기본정보 */}
        <div>
          <h3 className="text-xs font-semibold text-text-muted mb-2">{t("master.workInstruction.sectionBasic", "기본정보")}</h3>
          <div className="grid grid-cols-2 gap-3">
            <Input label={t("common.partCode")} placeholder="H-001"
              value={form.itemCode} onChange={e => setField("itemCode", e.target.value)} fullWidth />
            <Input label={t("master.workInstruction.processCode")} placeholder="CUT-01"
              value={form.processCode} onChange={e => setField("processCode", e.target.value)} fullWidth />
            <div className="col-span-2">
              <Input label={t("master.workInstruction.docTitle")}
                value={form.title} onChange={e => setField("title", e.target.value)} fullWidth />
            </div>
            <Input label={t("master.workInstruction.revision")} placeholder="A"
              value={form.revision} onChange={e => setField("revision", e.target.value)} fullWidth />
          </div>
        </div>

        {/* 파일 업로드 */}
        <div>
          <h3 className="text-xs font-semibold text-text-muted mb-2">{t("master.workInstruction.attachment", "첨부파일")}</h3>

          {form.imageUrl ? (
            <div className="border border-border rounded-lg overflow-hidden">
              {isImageUrl(form.imageUrl) ? (
                <div className="relative">
                  <img
                    src={form.imageUrl.startsWith("/") ? `${process.env.NEXT_PUBLIC_API_URL?.replace("/api/v1", "")}${form.imageUrl}` : form.imageUrl}
                    alt="preview"
                    className="w-full max-h-48 object-contain bg-gray-50 dark:bg-gray-900"
                  />
                </div>
              ) : (
                <div className="flex items-center gap-3 p-3 bg-surface">
                  <FileText className="w-8 h-8 text-primary shrink-0" />
                  <span className="text-xs text-text truncate flex-1">{form.imageUrl.split("/").pop()}</span>
                </div>
              )}
              <div className="flex items-center justify-between px-3 py-2 bg-surface border-t border-border">
                <span className="text-[10px] text-text-muted truncate flex-1 mr-2">{form.imageUrl}</span>
                <button onClick={() => setField("imageUrl", "")}
                  className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors shrink-0">
                  <Trash2 className="w-3.5 h-3.5 text-red-500" />
                </button>
              </div>
            </div>
          ) : (
            <div
              className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                dragOver
                  ? "border-primary bg-primary/5"
                  : "border-gray-300 dark:border-gray-600 hover:border-primary/50"
              }`}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
            >
              {uploading ? (
                <div className="flex flex-col items-center gap-2">
                  <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  <span className="text-xs text-text-muted">{t("common.uploading", "업로드 중...")}</span>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <Upload className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-text">
                      {t("master.workInstruction.dropFile", "파일을 드래그하거나 클릭하여 업로드")}
                    </p>
                    <p className="text-[10px] text-text-muted mt-0.5">
                      {t("master.workInstruction.fileTypes", "이미지(JPG, PNG), PDF, 문서 (최대 10MB)")}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          <input ref={fileInputRef} type="file" className="hidden"
            accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
            onChange={handleFileChange} />

          {/* URL 직접 입력 토글 */}
          {!form.imageUrl && (
            <div className="mt-2">
              <Input label={t("master.workInstruction.imageUrl", "또는 URL 직접 입력")} placeholder="https://..."
                value={form.imageUrl} onChange={e => setField("imageUrl", e.target.value)} fullWidth />
            </div>
          )}
        </div>

        {/* 내용 */}
        <div>
          <h3 className="text-xs font-semibold text-text-muted mb-2">{t("master.workInstruction.content")}</h3>
          <textarea
            className="w-full h-32 px-3 py-2 text-xs border border-gray-400 dark:border-gray-500 rounded-lg bg-background text-text resize-none focus:outline-none focus:ring-2 focus:ring-primary/40"
            placeholder={t("master.workInstruction.contentPlaceholder")}
            value={form.content}
            onChange={e => setField("content", e.target.value)}
          />
        </div>
      </div>

      <div className="px-5 py-3 border-t border-border flex gap-2 justify-end flex-shrink-0">
        <Button variant="secondary" onClick={onClose}>{t("common.cancel")}</Button>
        <Button onClick={handleSubmit} disabled={saving || !form.itemCode.trim() || !form.title.trim()}>
          {saving ? t("common.saving") : (isEdit ? t("common.edit") : t("common.add"))}
        </Button>
      </div>
    </div>
  );
}
