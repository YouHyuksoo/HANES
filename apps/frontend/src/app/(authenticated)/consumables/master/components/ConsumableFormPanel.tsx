/**
 * @file src/app/(authenticated)/consumables/master/components/ConsumableFormPanel.tsx
 * @description 소모품 마스터 등록/수정 오른쪽 슬라이드 패널
 *
 * 초보자 가이드:
 * 1. **슬라이드 패널**: 오른쪽에서 슬라이드 인/아웃되는 폼 패널
 * 2. **등록 모드**: item이 null이면 새 소모품 등록
 * 3. **수정 모드**: item이 전달되면 기존 데이터 수정
 * 4. **API**: POST /consumables (등록), PUT /consumables/:id (수정)
 */

"use client";

import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { X, Upload, Trash2, ImageIcon, RefreshCw } from "lucide-react";
import { Button, Input, Select } from "@/components/ui";
import { useComCodeOptions } from "@/hooks/useComCode";
import api from "@/services/api";

export interface ConsumableItem {
  id: string;
  consumableCode: string;
  consumableName: string;
  category: string;
  expectedLife: number | null;
  currentCount: number;
  warningCount: number | null;
  stockQty: number;
  safetyStock: number;
  location: string | null;
  vendor: string | null;
  unitPrice: number | null;
  status: string;
  useYn: string;
  imageUrl: string | null;
}

export interface ConsumableFormValues {
  consumableCode: string;
  consumableName: string;
  category: string;
  expectedLife: number | null;
  warningCount: number | null;
  location: string;
  vendor: string;
  unitPrice: number | null;
  safetyStock: number;
}

interface Props {
  item: ConsumableItem | null;
  onClose: () => void;
  onSubmit: (data: ConsumableFormValues) => void;
  loading?: boolean;
  /** 슬라이드 인 애니메이션 적용 여부 (기본: true) */
  animate?: boolean;
}

const EMPTY: ConsumableFormValues = {
  consumableCode: "",
  consumableName: "",
  category: "MOLD",
  expectedLife: null,
  warningCount: null,
  location: "",
  vendor: "",
  unitPrice: null,
  safetyStock: 0,
};

export default function ConsumableFormPanel({ item, onClose, onSubmit, loading, animate = true }: Props) {
  const { t } = useTranslation();
  const isEdit = !!item;
  const categoryOptions = useComCodeOptions("CONSUMABLE_CATEGORY");
  const [form, setForm] = useState<ConsumableFormValues>(EMPTY);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setForm(
      item
        ? {
            consumableCode: item.consumableCode,
            consumableName: item.consumableName,
            category: item.category || "MOLD",
            expectedLife: item.expectedLife,
            warningCount: item.warningCount,
            location: item.location || "",
            vendor: item.vendor || "",
            unitPrice: item.unitPrice,
            safetyStock: item.safetyStock || 0,
          }
        : EMPTY,
    );
    setImageUrl(item?.imageUrl ?? null);
  }, [item]);

  /** 이미지 업로드 */
  const handleImageUpload = async (file: File) => {
    if (!item) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("image", file);
      const res = await api.post(`/consumables/${item.consumableCode}/image`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setImageUrl(res.data?.data?.imageUrl ?? null);
    } catch { /* api interceptor */ }
    finally { setUploading(false); }
  };

  /** 이미지 삭제 */
  const handleImageRemove = async () => {
    if (!item) return;
    setUploading(true);
    try {
      await api.delete(`/consumables/${item.consumableCode}/image`);
      setImageUrl(null);
    } catch { /* api interceptor */ }
    finally { setUploading(false); }
  };

  const set = (k: keyof ConsumableFormValues, v: string | number | null) =>
    setForm((p) => ({ ...p, [k]: v }));

  const handleSubmit = () => {
    if (!form.consumableCode || !form.consumableName) return;
    onSubmit(form);
  };

  return (
    <div
      className={`w-[420px] border-l border-border bg-background flex flex-col h-full overflow-hidden shadow-2xl text-xs ${animate ? "animate-slide-in-right" : ""}`}
    >
      {/* 헤더 */}
      <div className="px-5 py-3 border-b border-border flex items-center justify-between flex-shrink-0">
        <h2 className="text-sm font-bold text-text">
          {isEdit ? t("consumables.master.editConsumable") : t("consumables.master.register")}
        </h2>
        <button onClick={onClose} className="p-1 rounded hover:bg-surface transition-colors">
          <X className="w-4 h-4 text-text-muted hover:text-text" />
        </button>
      </div>

      {/* 본문 (스크롤 가능) */}
      <div className="flex-1 overflow-y-auto px-5 py-3 space-y-4">
        {/* 기본정보 섹션 */}
        <div>
          <h3 className="text-xs font-semibold text-text-muted mb-2">
            {t("consumables.master.sectionBasic", "기본정보")}
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <Input
              label={t("consumables.master.code")}
              placeholder="CM-AP-110"
              value={form.consumableCode}
              onChange={(e) => set("consumableCode", e.target.value)}
              disabled={isEdit}
              fullWidth
            />
            <Select
              label={t("consumables.master.category")}
              options={categoryOptions}
              value={form.category}
              onChange={(v) => set("category", v)}
              fullWidth
            />
            <div className="col-span-2">
              <Input
                label={t("consumables.master.name")}
                placeholder="110단자 압착금형"
                value={form.consumableName}
                onChange={(e) => set("consumableName", e.target.value)}
                fullWidth
              />
            </div>
          </div>
        </div>

        {/* 수명/관리 섹션 */}
        <div>
          <h3 className="text-xs font-semibold text-text-muted mb-2">
            {t("consumables.master.sectionLifecycle", "수명 / 관리")}
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <Input
              label={t("consumables.master.expectedLifeCount")}
              type="number"
              placeholder="100000"
              value={form.expectedLife?.toString() ?? ""}
              onChange={(e) => set("expectedLife", e.target.value ? Number(e.target.value) : null)}
              fullWidth
            />
            <Input
              label={t("consumables.master.warningThreshold")}
              type="number"
              placeholder="80000"
              value={form.warningCount?.toString() ?? ""}
              onChange={(e) => set("warningCount", e.target.value ? Number(e.target.value) : null)}
              fullWidth
            />
            <Input
              label={t("consumables.master.safetyStock", "안전재고")}
              type="number"
              placeholder="1"
              value={form.safetyStock.toString()}
              onChange={(e) => set("safetyStock", Number(e.target.value) || 0)}
              fullWidth
            />
          </div>
        </div>

        {/* 거래처/위치 섹션 */}
        <div>
          <h3 className="text-xs font-semibold text-text-muted mb-2">
            {t("consumables.master.sectionVendor", "거래처 / 위치")}
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <Input
              label={t("consumables.master.location")}
              placeholder="금형실-A1"
              value={form.location}
              onChange={(e) => set("location", e.target.value)}
              fullWidth
            />
            <Input
              label={t("consumables.master.vendor")}
              placeholder="JST"
              value={form.vendor}
              onChange={(e) => set("vendor", e.target.value)}
              fullWidth
            />
            <div className="col-span-2">
              <Input
                label={t("consumables.master.unitPrice", "단가")}
                type="number"
                placeholder="750000"
                value={form.unitPrice?.toString() ?? ""}
                onChange={(e) => set("unitPrice", e.target.value ? Number(e.target.value) : null)}
                fullWidth
              />
            </div>
          </div>
        </div>

        {/* 이미지 섹션 */}
        <div>
          <h3 className="text-xs font-semibold text-text-muted mb-2">
            {t("consumables.master.sectionImage", "이미지")}
          </h3>
          {!isEdit ? (
            <div className="w-full h-24 border-2 border-dashed border-border rounded-lg flex flex-col items-center justify-center gap-1 opacity-50">
              <ImageIcon className="w-6 h-6 text-text-muted" />
              <span className="text-xs text-text-muted">{t("consumables.master.imageSaveFirst", "저장 후 이미지를 등록할 수 있습니다")}</span>
            </div>
          ) : (
            <>
              {imageUrl ? (
                <div className="relative group">
                  <img
                    src={imageUrl}
                    alt={item?.consumableName || ""}
                    className="w-full h-48 object-contain rounded-lg border border-border bg-surface"
                  />
                  <button
                    onClick={handleImageRemove}
                    disabled={uploading}
                    className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600 disabled:opacity-50"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="w-full h-32 border-2 border-dashed border-border rounded-lg flex flex-col items-center justify-center gap-2 hover:border-primary hover:bg-primary/5 transition-colors disabled:opacity-50"
                >
                  {uploading ? (
                    <RefreshCw className="w-6 h-6 text-text-muted animate-spin" />
                  ) : (
                    <ImageIcon className="w-8 h-8 text-text-muted" />
                  )}
                  <span className="text-xs text-text-muted">
                    {uploading ? t("common.uploading", "업로드 중...") : t("consumables.master.imageUploadHint", "클릭하여 이미지 업로드")}
                  </span>
                </button>
              )}
              {imageUrl && (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="mt-2 w-full text-xs text-primary hover:text-primary/80 flex items-center justify-center gap-1"
                >
                  <Upload className="w-3.5 h-3.5" />
                  {t("consumables.master.imageChange", "이미지 변경")}
                </button>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleImageUpload(file);
                  e.target.value = "";
                }}
              />
            </>
          )}
        </div>
      </div>

      {/* 푸터 (저장/취소) */}
      <div className="px-5 py-3 border-t border-border flex gap-2 justify-end flex-shrink-0">
        <Button variant="secondary" onClick={onClose}>{t("common.cancel")}</Button>
        <Button onClick={handleSubmit} disabled={loading || !form.consumableCode || !form.consumableName}>
          {loading ? t("common.saving") : (isEdit ? t("common.edit") : t("common.register"))}
        </Button>
      </div>
    </div>
  );
}
