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
import { Button, ConfirmModal } from "@/components/ui";
import { useLocationOptions } from "@/hooks/useMasterOptions";
import { useComCodeOptions } from "@/hooks/useComCode";
import api from "@/services/api";
import { Part } from "../types";
import { FieldComCodeSelect, FieldInput, FieldLabel, FieldSelect, FieldYnRadio, Field } from "./PartFieldHelp";
import { QtyInput } from "@/components/shared";

interface Props {
  editingPart: Part | null;
  onClose: () => void;
  onSave: () => void;
  /** 슬라이드 인 애니메이션 적용 여부 (기본: true) */
  animate?: boolean;
}

const PACKAGING_QTY_OPTIONS = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];

type IqcAqlPolicyOption = {
  policyCode: string;
  policyName?: string | null;
  majorAqlCode?: string | null;
  minorAqlCode?: string | null;
};

export default function PartFormPanel({ editingPart, onClose, onSave, animate = true }: Props) {
  const { t } = useTranslation();
  const isEdit = !!editingPart;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { options: rawLocationOptions, isLoading: locationLoading } = useLocationOptions();
  const locationOptions = useMemo(
    () => [{ value: "", label: t("common.select", "선택하세요") }, ...rawLocationOptions],
    [rawLocationOptions, t],
  );

  const iqcOptions = useMemo(() => [
    { value: "Y", label: t("master.part.iqcTarget", "Y (대상)") },
    { value: "N", label: t("master.part.iqcNotTarget", "N (비대상)") },
  ], [t]);

  // 제품유형: 코드마스터(PRODUCT_TYPE) 기반 — 화면 하드코딩 금지
  const rawIqcInspectMethodOptions = useComCodeOptions("IQC_INSPECT_METHOD", false);
  const iqcInspectMethodOptions = useMemo(
    () => [{ value: "", label: "-" }, ...rawIqcInspectMethodOptions],
    [rawIqcInspectMethodOptions],
  );
  const [iqcAqlPolicyOptions, setIqcAqlPolicyOptions] = useState([{ value: "", label: "-" }]);

  useEffect(() => {
    let cancelled = false;
    api.get("/quality/aql/policies", { params: { useYn: "Y" } })
      .then((res) => {
        if (cancelled) return;
        const policies: IqcAqlPolicyOption[] = res.data?.data ?? [];
        setIqcAqlPolicyOptions([
          { value: "", label: "-" },
          ...policies.map((policy) => ({
            value: policy.policyCode,
            label: `${policy.policyCode} - ${policy.policyName || policy.policyCode}`,
          })),
        ]);
      })
      .catch(() => {
        if (!cancelled) setIqcAqlPolicyOptions([{ value: "", label: "-" }]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const [form, setForm] = useState(() => ({
    itemCode: editingPart?.itemCode || "",
    itemName: editingPart?.itemName || "",
    itemNo: editingPart?.itemNo || "",
    custPartNo: editingPart?.custPartNo || "",
    itemType: (editingPart?.itemType || "RAW_MATERIAL") as Part["itemType"],
    productType: editingPart?.productType || "",
    modelName: editingPart?.modelName || "",
    defectModelGroup: editingPart?.defectModelGroup || "",
    spec: editingPart?.spec || "",
    rev: editingPart?.rev || "",
    markingText: editingPart?.markingText || "",
    unit: editingPart?.unit || "EA",
    color: editingPart?.color || "",
    boxQty: editingPart?.boxQty ?? 0,
    minPackQty: editingPart?.minPackQty ?? 0,
    lotUnitQty: editingPart?.lotUnitQty ?? 0,
    safetyStock: editingPart?.safetyStock ?? 0,
    expiryDate: editingPart?.expiryDate ?? 0,
    expiryExtDays: editingPart?.expiryExtDays ?? 0,
    iqcYn: editingPart?.iqcYn || "Y",
    inspectMethod: editingPart?.inspectMethod || "",
    sampleQty: editingPart?.sampleQty ?? 0,
    iqcAqlPolicyCode: editingPart?.iqcAqlPolicyCode || "",
    useYn: editingPart?.useYn || "Y",
    packUnit: editingPart?.packUnit ?? 0,
    storageLocation: editingPart?.storageLocation || "",
    remark: editingPart?.remark || "",
  }));
  const [saving, setSaving] = useState(false);
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(editingPart?.imageUrl ?? null);
  const [imageError, setImageError] = useState(false);
  const [imageDeleteConfirmOpen, setImageDeleteConfirmOpen] = useState(false);

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
      modelName: editingPart?.modelName || "",
      defectModelGroup: editingPart?.defectModelGroup || "",
      spec: editingPart?.spec || "",
      rev: editingPart?.rev || "",
      markingText: editingPart?.markingText || "",
      unit: editingPart?.unit || "EA",
      color: editingPart?.color || "",
      boxQty: editingPart?.boxQty ?? 0,
      minPackQty: editingPart?.minPackQty ?? 0,
      lotUnitQty: editingPart?.lotUnitQty ?? 0,
      safetyStock: editingPart?.safetyStock ?? 0,
      expiryDate: editingPart?.expiryDate ?? 0,
      expiryExtDays: editingPart?.expiryExtDays ?? 0,
      iqcYn: editingPart?.iqcYn || "Y",
      inspectMethod: editingPart?.inspectMethod || "",
      sampleQty: editingPart?.sampleQty ?? 0,
      iqcAqlPolicyCode: editingPart?.iqcAqlPolicyCode || "",
      useYn: editingPart?.useYn || "Y",
      packUnit: editingPart?.packUnit ?? 0,
      storageLocation: editingPart?.storageLocation || "",
      remark: editingPart?.remark || "",
    });
    setSelectedImageFile(null);
    setPreviewUrl(editingPart?.imageUrl ?? null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingPart]);

  useEffect(() => {
    setImageError(false);
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
    setImageDeleteConfirmOpen(false);
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
        modelName: form.modelName || undefined,
        defectModelGroup: form.defectModelGroup || undefined,
        spec: form.spec || undefined,
        rev: form.rev || undefined,
        markingText: form.markingText || undefined,
        unit: form.unit,
        color: form.color || undefined,
        boxQty: form.boxQty,
        minPackQty: form.minPackQty,
        lotUnitQty: form.lotUnitQty || undefined,
        safetyStock: form.safetyStock,
        expiryDate: form.expiryDate,
        expiryExtDays: form.expiryExtDays,
        iqcYn: form.iqcYn,
        inspectMethod: form.inspectMethod || undefined,
        sampleQty: form.sampleQty || undefined,
        iqcAqlPolicyCode: form.iqcAqlPolicyCode || undefined,
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
    <>
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
          {saving ? t("common.saving") : t("common.save", "저장")}
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
            <FieldInput field="itemCode" label={t("master.part.partCode")} required
              value={form.itemCode} onChange={e => setField("itemCode", e.target.value)}
              disabled={isEdit} fullWidth />
            <FieldInput field="itemNo" label={t("master.part.partNo", "품번")} required
              value={form.itemNo} onChange={e => setField("itemNo", e.target.value)} fullWidth />
            <FieldInput field="itemName" label={t("master.part.partName")} required wrapperClassName="col-span-2"
              value={form.itemName} onChange={e => setField("itemName", e.target.value)} fullWidth />
            <FieldInput field="custPartNo" label={t("master.part.custPartNo", "고객품번")}
              value={form.custPartNo} onChange={e => setField("custPartNo", e.target.value)} fullWidth />
            <FieldInput field="rev" label={t("master.part.rev", "리비전")}
              value={form.rev} onChange={e => setField("rev", e.target.value)} fullWidth />
            <FieldInput field="markingText" label={t("master.part.markingText", "마킹문구")} wrapperClassName="col-span-2"
              value={form.markingText} maxLength={100}
              onChange={e => setField("markingText", e.target.value)} fullWidth />
            <FieldComCodeSelect field="itemType" groupCode="ITEM_TYPE" includeAll={false} label={t("master.part.type")}
              value={form.itemType}
              onChange={v => setField("itemType", v)}
              fullWidth required />
            <FieldComCodeSelect field="productType" groupCode="PRODUCT_TYPE" includeAll={false}
              label={t("master.part.productType", "품목그룹")}
              value={form.productType} onChange={v => setField("productType", v)} fullWidth />
            <FieldInput field="modelName" label={t("master.part.modelName", "차종")}
              value={form.modelName} onChange={e => setField("modelName", e.target.value)} fullWidth />
            <FieldComCodeSelect field="defectModelGroup" groupCode="DEFECT_MODEL_GROUP" includeAll={false}
              label={t("master.part.defectModelGroup", "모델구분")}
              value={form.defectModelGroup} onChange={v => setField("defectModelGroup", v)} fullWidth />
            <FieldInput field="spec" label={t("master.part.spec")} wrapperClassName="col-span-2"
              value={form.spec} onChange={e => setField("spec", e.target.value)} fullWidth />
            <FieldInput field="color" label={t("master.part.color", "색상")}
              value={form.color} onChange={e => setField("color", e.target.value)} fullWidth />
            <FieldComCodeSelect field="unit" groupCode="UNIT_TYPE" label={t("master.part.unit")} includeAll={false} showCode
              value={form.unit} onChange={v => setField("unit", v)} fullWidth />
            <FieldSelect field="iqcYn" label={t("master.part.iqcFlag", "IQC대상")} options={iqcOptions}
              value={form.iqcYn} onChange={v => setField("iqcYn", v)} fullWidth />
            <FieldSelect field="inspectMethod" label={t("master.part.inspectMethod", "검사구분")}
              options={iqcInspectMethodOptions}
              value={form.inspectMethod} onChange={v => setField("inspectMethod", v)} fullWidth />
            <FieldInput field="sampleQty" label={t("master.part.basicSampleQty", "기본시료수")} type="number" step="0.001"
              value={String(form.sampleQty)} onChange={e => setField("sampleQty", Number(e.target.value))} fullWidth />
            <FieldSelect field="iqcAqlPolicyCode" label={t("master.part.iqcAqlPolicyCode", "AQL 정책")}
              options={iqcAqlPolicyOptions}
              value={form.iqcAqlPolicyCode} onChange={v => setField("iqcAqlPolicyCode", v)} fullWidth />
            <FieldYnRadio field="useYn" label={t("common.useYn", "사용여부")} value={form.useYn} onChange={v => setField("useYn", v)} />
          </div>
        </div>

        {/* 수량 섹션 */}
        <div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Field field="boxQty" label={t("master.part.boxQty", "박스장입수량")}>
                <QtyInput value={Number(form.boxQty) || 0} onChange={(n) => setField("boxQty", n)} fullWidth />
              </Field>
              <datalist id="part-panel-box-qty-options">
                {PACKAGING_QTY_OPTIONS.map(qty => <option key={qty} value={qty} />)}
              </datalist>
            </div>
            <Field field="minPackQty" label={t("master.part.minPackQty", "최소불출단위수량(자재)")}>
              <QtyInput value={Number(form.minPackQty) || 0} onChange={(n) => setField("minPackQty", n)} fullWidth />
            </Field>
            <Field field="lotUnitQty" label={t("master.part.lotUnitQty", "묶음단위수량(생산공정품)")}>
              <QtyInput value={Number(form.lotUnitQty) || 0} onChange={(n) => setField("lotUnitQty", n)} fullWidth />
            </Field>
            <Field field="safetyStock" label={t("master.part.safetyStock")}>
              <QtyInput value={Number(form.safetyStock) || 0} onChange={(n) => setField("safetyStock", n)} fullWidth />
            </Field>
            <Field field="expiryDate" label={t("master.part.expiryDate", "유효기간(일)")}>
              <QtyInput value={Number(form.expiryDate) || 0} onChange={(n) => setField("expiryDate", n)} fullWidth />
            </Field>
            <Field field="expiryExtDays" label={t("master.part.expiryExtDays", "유효기간 연장(일)")}>
              <QtyInput value={Number(form.expiryExtDays) || 0} onChange={(n) => setField("expiryExtDays", n)} fullWidth />
            </Field>
            <Field field="packUnit" label={t("master.part.palletUnit", "팔레트구성단위")}>
              <QtyInput value={Number(form.packUnit) || 0} onChange={(n) => setField("packUnit", n)} fullWidth />
            </Field>
            <FieldSelect field="storageLocation" label={t("master.part.storageLocation", "품목고정 적재로케이션")}
              options={locationOptions}
              value={form.storageLocation} onChange={v => setField("storageLocation", v)}
              disabled={locationLoading} fullWidth wrapperClassName="col-span-2" />
          </div>
        </div>

        {/* 비고 */}
        <div>
          <FieldLabel field="imageUrl" label={t("master.part.sectionImage", "사진")} />
          {previewUrl ? (
            <div className="relative group">
              {imageError ? (
                <div className="w-full h-44 rounded-lg border border-border bg-surface flex flex-col items-center justify-center gap-2">
                  <ImageIcon className="w-8 h-8 text-text-muted" />
                  <span className="text-xs text-text-muted">
                    {t("master.part.imageLoadFailed", "이미지를 불러올 수 없습니다")}
                  </span>
                </div>
              ) : (
                <img
                  src={previewUrl}
                  alt={form.itemName || form.itemCode}
                  onError={() => setImageError(true)}
                  className="w-full h-44 object-contain rounded-lg border border-border bg-surface"
                />
              )}
              <button
                type="button"
                onClick={() => setImageDeleteConfirmOpen(true)}
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
          <FieldInput field="remark" label={t("common.remark")}
            value={form.remark} onChange={e => setField("remark", e.target.value)} fullWidth />
        </div>
      </div>

      </div>
      <ConfirmModal
        isOpen={imageDeleteConfirmOpen}
        onClose={() => setImageDeleteConfirmOpen(false)}
        onConfirm={handleImageClear}
        title={t("common.deleteConfirm", "삭제 확인")}
        message={t("master.part.imageDeleteConfirm", "품목 사진을 삭제하시겠습니까?")}
        variant="danger"
      />
    </>
  );
}
