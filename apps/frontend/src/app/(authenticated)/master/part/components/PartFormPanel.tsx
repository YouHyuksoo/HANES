/**
 * @file src/app/(authenticated)/master/part/components/PartFormPanel.tsx
 * @description 품목 추가/수정 오른쪽 슬라이드 패널
 *
 * 초보자 가이드:
 * 1. **슬라이드 패널**: 오른쪽에서 슬라이드 인/아웃되는 폼 패널
 * 2. **외부 클릭**: 패널 외부 클릭 시 자동 닫기
 * 3. **API**: POST /master/parts (생성), PUT /master/parts/:id (수정)
 */

"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { ImageIcon, RefreshCw, Trash2, Upload } from "lucide-react";
// X 아이콘 제거됨 — 헤더에 취소/저장 버튼 사용
import { Button, Input, Select } from "@/components/ui";
import { ComCodeSelect } from "@/components/shared";
import { useLocationOptions } from "@/hooks/useMasterOptions";
import api from "@/services/api";
import { Part, PRODUCT_TYPE_VALUES } from "../types";

interface Props {
  editingPart: Part | null;
  onClose: () => void;
  onSave: () => void;
  /** 슬라이드 인 애니메이션 적용 여부 (기본: true) */
  animate?: boolean;
}

export default function PartFormPanel({ editingPart, onClose, onSave, animate = true }: Props) {
  const { t } = useTranslation();
  const isEdit = !!editingPart;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { options: rawLocationOptions, isLoading: locationLoading } = useLocationOptions();
  const locationOptions = useMemo(
    () => [{ value: "", label: t("common.select", "선택하세요") }, ...rawLocationOptions],
    [rawLocationOptions, t],
  );

  const partTypeOptions = useMemo(() => [
    { value: "RAW_MATERIAL", label: t("inventory.stock.raw", "원자재") },
    { value: "SEMI_PRODUCT", label: t("inventory.stock.wip", "반제품") },
    { value: "FINISHED", label: t("inventory.stock.fg", "완제품") },
    { value: "CONSUMABLE", label: t("inventory.stock.consumable", "소모품") },
  ], [t]);

  const productTypeOptions = useMemo(
    () => PRODUCT_TYPE_VALUES.map((v) => ({ value: v, label: t(`master.part.productTypeOptions.${v}`) })),
    [t],
  );

  /** Y/N 라디오 버튼 그룹 */
  const YnRadio = ({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) => (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-text-muted">{label}</label>
      <div className="flex gap-3 h-[34px] items-center">
        {[
          { v: "Y", l: "Y", cls: "text-green-600 dark:text-green-400" },
          { v: "N", l: "N", cls: "text-red-500 dark:text-red-400" },
        ].map(opt => (
          <label key={opt.v} className={`flex items-center gap-1.5 cursor-pointer text-xs ${value === opt.v ? opt.cls + " font-semibold" : "text-text-muted"}`}>
            <input type="radio" checked={value === opt.v} onChange={() => onChange(opt.v)}
              className="w-3.5 h-3.5 accent-primary" />
            {opt.l}
          </label>
        ))}
      </div>
    </div>
  );

  const [form, setForm] = useState(() => ({
    itemCode: editingPart?.itemCode || "",
    itemName: editingPart?.itemName || "",
    itemNo: editingPart?.itemNo || "",
    custPartNo: editingPart?.custPartNo || "",
    itemType: (editingPart?.itemType || "RAW_MATERIAL") as Part["itemType"],
    productType: editingPart?.productType || "",
    spec: editingPart?.spec || "",
    rev: editingPart?.rev || "",
    markingText: editingPart?.markingText || "",
    unit: editingPart?.unit || "EA",
    boxQty: editingPart?.boxQty ?? 0,
    lotUnitQty: editingPart?.lotUnitQty ?? 0,
    safetyStock: editingPart?.safetyStock ?? 0,
    tactTime: editingPart?.tactTime ?? 0,
    expiryDate: editingPart?.expiryDate ?? 0,
    expiryExtDays: editingPart?.expiryExtDays ?? 0,
    iqcYn: editingPart?.iqcYn || "Y",
    inspectMethod: editingPart?.inspectMethod || "",
    useYn: editingPart?.useYn || "Y",
    packUnit: editingPart?.packUnit || "",
    storageLocation: editingPart?.storageLocation || "",
    remark: editingPart?.remark || "",
  }));
  const [saving, setSaving] = useState(false);
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(editingPart?.imageUrl ?? null);

  // editingPart 변경 시 폼 리셋
  useEffect(() => {
    if (previewUrl?.startsWith("blob:")) {
      URL.revokeObjectURL(previewUrl);
    }
    setForm({
      itemCode: editingPart?.itemCode || "",
      itemName: editingPart?.itemName || "",
      itemNo: editingPart?.itemNo || "",
      custPartNo: editingPart?.custPartNo || "",
      itemType: (editingPart?.itemType || "RAW_MATERIAL") as Part["itemType"],
      productType: editingPart?.productType || "",
      spec: editingPart?.spec || "",
      rev: editingPart?.rev || "",
      markingText: editingPart?.markingText || "",
      unit: editingPart?.unit || "EA",
      boxQty: editingPart?.boxQty ?? 0,
      lotUnitQty: editingPart?.lotUnitQty ?? 0,
      safetyStock: editingPart?.safetyStock ?? 0,
      tactTime: editingPart?.tactTime ?? 0,
      expiryDate: editingPart?.expiryDate ?? 0,
      expiryExtDays: editingPart?.expiryExtDays ?? 0,
      iqcYn: editingPart?.iqcYn || "Y",
      inspectMethod: editingPart?.inspectMethod || "",
      useYn: editingPart?.useYn || "Y",
      packUnit: editingPart?.packUnit || "",
      storageLocation: editingPart?.storageLocation || "",
      remark: editingPart?.remark || "",
    });
    setSelectedImageFile(null);
    setPreviewUrl(editingPart?.imageUrl ?? null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingPart]);

  useEffect(() => {
    return () => {
      if (previewUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);



  const setField = (key: string, value: string | number) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const handleImageSelect = (file: File) => {
    if (previewUrl?.startsWith("blob:")) {
      URL.revokeObjectURL(previewUrl);
    }
    setSelectedImageFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const handleImageClear = () => {
    if (previewUrl?.startsWith("blob:")) {
      URL.revokeObjectURL(previewUrl);
    }
    setSelectedImageFile(null);
    setPreviewUrl(null);
  };

  const uploadImage = async (itemCode: string, file: File) => {
    const formData = new FormData();
    formData.append("image", file);
    await api.post(`/master/parts/${encodeURIComponent(itemCode)}/image`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  };

  const handleSubmit = async () => {
    if (!form.itemCode.trim() || !form.itemNo.trim() || !form.itemName.trim()) return;
    setSaving(true);
    try {
      const payload = {
        itemCode: form.itemCode,
        itemName: form.itemName,
        itemType: form.itemType,
        itemNo: form.itemNo,
        custPartNo: form.custPartNo || undefined,
        productType: form.productType || undefined,
        spec: form.spec || undefined,
        rev: form.rev || undefined,
        markingText: form.markingText || undefined,
        unit: form.unit,
        boxQty: form.boxQty,
        lotUnitQty: form.lotUnitQty || undefined,
        safetyStock: form.safetyStock,
        tactTime: form.tactTime,
        expiryDate: form.expiryDate,
        expiryExtDays: form.expiryExtDays,
        iqcYn: form.iqcYn,
        inspectMethod: form.inspectMethod || undefined,
        useYn: form.useYn,
        packUnit: form.packUnit || undefined,
        storageLocation: form.storageLocation || undefined,
        remark: form.remark || undefined,
      };
      if (isEdit && editingPart?.itemCode) {
        await api.put(`/master/parts/${editingPart.itemCode}`, payload);
        if (selectedImageFile) {
          await uploadImage(editingPart.itemCode, selectedImageFile);
        } else if (!previewUrl && editingPart.imageUrl) {
          await api.delete(`/master/parts/${encodeURIComponent(editingPart.itemCode)}/image`);
        }
      } else {
        await api.post("/master/parts", payload);
        if (selectedImageFile) {
          await uploadImage(form.itemCode, selectedImageFile);
        }
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
    <div
      className={`w-[480px] border-l border-border bg-background flex flex-col h-full overflow-hidden shadow-2xl text-xs ${animate ? 'animate-slide-in-right' : ''}`}
    >
      {/* 헤더 */}
      <div className="px-5 py-3 border-b border-border flex items-center justify-between flex-shrink-0">
        <h2 className="text-sm font-bold text-text">
          {isEdit ? t("master.part.editPart") : t("master.part.addPart")}
        </h2>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="secondary" onClick={onClose}>{t("common.cancel")}</Button>
          <Button size="sm" onClick={handleSubmit} disabled={saving || !form.itemCode.trim() || !form.itemNo.trim() || !form.itemName.trim()}>
            {saving ? t("common.saving") : (isEdit ? t("common.edit") : t("common.add"))}
          </Button>
        </div>
      </div>

      {/* 본문 (스크롤 가능) */}
      <div className="flex-1 overflow-y-auto px-5 py-3 space-y-4">
        {/* 기본정보 섹션 */}
        <div>
          <h3 className="text-xs font-semibold text-text-muted mb-2">
            {t("master.part.sectionBasic", "기본정보")}
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <Input label={t("master.part.partCode")} required
              value={form.itemCode} onChange={e => setField("itemCode", e.target.value)}
              disabled={isEdit} fullWidth />
            <Input label={t("master.part.partNo", "품번")} required
              value={form.itemNo} onChange={e => setField("itemNo", e.target.value)} fullWidth />
            <div className="col-span-2">
              <Input label={t("master.part.partName")} required
                value={form.itemName} onChange={e => setField("itemName", e.target.value)} fullWidth />
            </div>
            <Input label={t("master.part.custPartNo", "고객품번")}
              value={form.custPartNo} onChange={e => setField("custPartNo", e.target.value)} fullWidth />
            <Input label={t("master.part.rev", "리비전")}
              value={form.rev} onChange={e => setField("rev", e.target.value)} fullWidth />
            <div className="col-span-2">
              <Input label={t("master.part.markingText", "마킹문구")}
                value={form.markingText} maxLength={100}
                onChange={e => setField("markingText", e.target.value)} fullWidth />
            </div>
            <Select label={t("master.part.type")} options={partTypeOptions}
              value={form.itemType} 
              onChange={v => setField("itemType", v)}
              fullWidth />
            <Select label={t("master.part.productType", "품목그룹")}
              options={productTypeOptions}
              value={form.productType} onChange={v => setField("productType", v)} fullWidth />
            <div className="col-span-2">
              <Input label={t("master.part.spec")}
                value={form.spec} onChange={e => setField("spec", e.target.value)} fullWidth />
            </div>
            <ComCodeSelect groupCode="UNIT_TYPE" label={t("master.part.unit")} includeAll={false}
              value={form.unit} onChange={v => setField("unit", v)} fullWidth />
            <Select label={t("master.part.inspectMethod", "IQC검사방법")}
              options={[
                { value: "", label: "-" },
                { value: "FULL", label: t("master.part.inspect", "검사") },
                { value: "SKIP", label: t("master.part.inspectSkip", "무검사") },
              ]}
              value={form.inspectMethod} onChange={v => setField("inspectMethod", v)} fullWidth />
            <YnRadio label={t("common.useYn", "사용여부")} value={form.useYn} onChange={v => setField("useYn", v)} />
          </div>
        </div>

        {/* 거래처/수량 섹션 */}
        <div>
          <h3 className="text-xs font-semibold text-text-muted mb-2">
            {t("master.part.sectionQty", "거래처 / 수량관리")}
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <Input label={t("master.part.boxQty", "박스입수량")} type="number"
              value={String(form.boxQty)} onChange={e => setField("boxQty", Number(e.target.value))} fullWidth />
            <Input label={t("master.part.lotUnitQty", "LOT단위수량")} type="number"
              value={String(form.lotUnitQty)} onChange={e => setField("lotUnitQty", Number(e.target.value))} fullWidth />
            <Input label={t("master.part.safetyStock")} type="number"
              value={String(form.safetyStock)} onChange={e => setField("safetyStock", Number(e.target.value))} fullWidth />
            <Input label={t("master.part.tactTime", "택타임(초)")} type="number"
              value={String(form.tactTime)} onChange={e => setField("tactTime", Number(e.target.value))} fullWidth />
            <Input label={t("master.part.expiryDate", "유효기간(일)")} type="number"
              value={String(form.expiryDate)} onChange={e => setField("expiryDate", Number(e.target.value))} fullWidth />
            <Input label={t("master.part.expiryExtDays", "유효기간 연장(일)")} type="number"
              value={String(form.expiryExtDays)} onChange={e => setField("expiryExtDays", Number(e.target.value))} fullWidth />
            <Input label={t("master.part.packUnit", "포장단위")}
              value={form.packUnit} onChange={e => setField("packUnit", e.target.value)} fullWidth />
            <div className="col-span-2">
              <Select label={t("master.part.storageLocation", "적재로케이션")}
                options={locationOptions}
                value={form.storageLocation} onChange={v => setField("storageLocation", v)}
                disabled={locationLoading} fullWidth />
            </div>
          </div>
        </div>

        {/* 비고 */}
        <div>
          <h3 className="text-xs font-semibold text-text-muted mb-2">
            {t("master.part.sectionImage", "사진")}
          </h3>
          {previewUrl ? (
            <div className="relative group">
              <img
                src={previewUrl}
                alt={form.itemName || form.itemCode}
                className="w-full h-44 object-contain rounded-lg border border-border bg-surface"
              />
              <button
                type="button"
                onClick={handleImageClear}
                className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={saving}
              className="w-full h-28 border-2 border-dashed border-border rounded-lg flex flex-col items-center justify-center gap-2 hover:border-primary hover:bg-primary/5 transition-colors disabled:opacity-50"
            >
              {saving ? (
                <RefreshCw className="w-6 h-6 text-text-muted animate-spin" />
              ) : (
                <ImageIcon className="w-8 h-8 text-text-muted" />
              )}
              <span className="text-xs text-text-muted">
                {t("master.part.imageUploadHint", "클릭하여 품목 사진 선택")}
              </span>
            </button>
          )}
          {previewUrl && (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={saving}
              className="mt-2 w-full text-xs text-primary hover:text-primary/80 flex items-center justify-center gap-1"
            >
              <Upload className="w-3.5 h-3.5" />
              {t("master.part.imageChange", "사진 변경")}
            </button>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleImageSelect(file);
              e.target.value = "";
            }}
          />
        </div>

        <div>
          <Input label={t("common.remark")}
            value={form.remark} onChange={e => setField("remark", e.target.value)} fullWidth />
        </div>
      </div>

    </div>
  );
}
