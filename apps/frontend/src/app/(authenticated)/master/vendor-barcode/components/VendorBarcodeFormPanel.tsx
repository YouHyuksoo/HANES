/**
 * @file src/app/(authenticated)/master/vendor-barcode/components/VendorBarcodeFormPanel.tsx
 * @description 제조사 바코드 매핑 추가/수정 오른쪽 슬라이드 패널
 *
 * 초보자 가이드:
 * 1. **슬라이드 패널**: 오른쪽에서 슬라이드 인/아웃되는 폼 패널
 * 2. **API**: POST/PUT /master/vendor-barcode-mappings
 */

"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
// X 아이콘 제거됨 — 헤더에 취소/저장 버튼 사용
import { Button } from "@/components/ui";
import { FieldInput, FieldSelect } from "./VendorBarcodeFieldHelp";
import { MATCH_TYPE_OPTIONS } from "../vendorBarcodeColumns";
import { useUseYnOptions } from "@/components/shared";
import api from "@/services/api";

interface VendorBarcodeMapping {
  vendorBarcode: string;
  itemCode: string | null;
  itemName: string | null;
  vendorCode: string | null;
  vendorName: string | null;
  mappingRule: string | null;
  matchType: string;
  remark: string | null;
  useYn: string;
}

interface Props {
  editingItem: VendorBarcodeMapping | null;
  onClose: () => void;
  onSave: () => void;
  animate?: boolean;
  /** 작성 중(저장 안 됨) 여부를 부모에 보고 — 행 전환 시 유실 방어용 */
  onDirtyChange?: (dirty: boolean) => void;
}


export type { VendorBarcodeMapping };

/** editingItem으로부터 폼 초기값 생성 — useState 초기화와 prop 변경 리셋에서 공용 */
const buildForm = (editingItem: VendorBarcodeMapping | null) => ({
  vendorBarcode: editingItem?.vendorBarcode || "",
  itemCode: editingItem?.itemCode || "",
  itemName: editingItem?.itemName || "",
  vendorCode: editingItem?.vendorCode || "",
  vendorName: editingItem?.vendorName || "",
  matchType: editingItem?.matchType || "EXACT",
  mappingRule: editingItem?.mappingRule || "",
  remark: editingItem?.remark || "",
  useYn: editingItem?.useYn || "Y",
});

export default function VendorBarcodeFormPanel({ editingItem, onClose, onSave, animate = true, onDirtyChange }: Props) {
  const { t } = useTranslation();
  const isEdit = !!editingItem;
  const useYnOptions = useUseYnOptions(false);

  const [form, setForm] = useState(() => buildForm(editingItem));
  const initialFormRef = useRef(form);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const init = buildForm(editingItem);
    setForm(init);
    initialFormRef.current = init;
  }, [editingItem]);

  // 작성 중(저장 안 됨) 여부 계산 후 부모에 보고 — 행 전환 시 유실 방어
  const dirty = useMemo(
    () => JSON.stringify(form) !== JSON.stringify(initialFormRef.current),
    [form],
  );
  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);
  useEffect(() => () => onDirtyChange?.(false), [onDirtyChange]);

  const setField = (key: string, value: string) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async () => {
    if (!form.vendorBarcode.trim() || !form.itemCode.trim() || !form.vendorCode.trim()) return;
    setSaving(true);
    try {
      if (isEdit && editingItem?.vendorBarcode) {
        await api.put(`/master/vendor-barcode-mappings/${encodeURIComponent(editingItem.vendorBarcode)}`, form);
      } else {
        await api.post("/master/vendor-barcode-mappings", form);
      }
      onDirtyChange?.(false);
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
          {isEdit ? t("master.vendorBarcode.editMapping", "매핑 수정") : t("master.vendorBarcode.addMapping", "매핑 추가")}
        </h2>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="secondary" onClick={onClose}>{t("common.cancel")}</Button>
          <Button size="sm" onClick={handleSubmit} disabled={saving || !form.vendorBarcode.trim() || !form.itemCode.trim() || !form.vendorCode.trim()}>
            {saving ? t("common.saving") : t("common.save", "저장")}
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-3 space-y-4">
        <div>
          <h3 className="text-xs font-semibold text-text-muted mb-2">{t("master.vendorBarcode.sectionBarcode", "바코드 정보")}</h3>
          <div className="grid grid-cols-2 gap-3">
            <FieldInput field="vendorBarcode" label={t("master.vendorBarcode.vendorBarcode", "제조사 바코드")}
              wrapperClassName="col-span-2"
              value={form.vendorBarcode} onChange={e => setField("vendorBarcode", e.target.value)} required />
            <FieldSelect field="matchType" label={t("master.vendorBarcode.matchType", "매칭 유형")}
              options={MATCH_TYPE_OPTIONS.map(o => ({ value: o.value, label: t(o.labelKey, o.labelFallback) }))}
              value={form.matchType} onChange={v => setField("matchType", v)} />
            <FieldSelect field="useYn" label={t("master.vendorBarcode.useYn", "사용여부")}
              options={useYnOptions}
              value={form.useYn} onChange={v => setField("useYn", v)} />
          </div>
        </div>

        <div>
          <h3 className="text-xs font-semibold text-text-muted mb-2">{t("master.vendorBarcode.sectionPart", "품목 매핑")}</h3>
          <div className="grid grid-cols-2 gap-3">
            <FieldInput field="partCode" label={t("master.vendorBarcode.partCode", "품번")} required
              value={form.itemCode} onChange={e => setField("itemCode", e.target.value)} />
            <FieldInput field="partName" label={t("master.vendorBarcode.partName", "품명")}
              value={form.itemName} onChange={e => setField("itemName", e.target.value)} />
            <FieldInput field="vendorCode" label={t("master.vendorBarcode.vendorCode", "제조사 코드")} required
              value={form.vendorCode} onChange={e => setField("vendorCode", e.target.value)} />
            <FieldInput field="vendorName" label={t("master.vendorBarcode.vendorName", "제조사명")}
              value={form.vendorName} onChange={e => setField("vendorName", e.target.value)} />
          </div>
        </div>

        <FieldInput field="mappingRule" label={t("master.vendorBarcode.mappingRule", "매핑 규칙")}
          value={form.mappingRule} onChange={e => setField("mappingRule", e.target.value)} />

        <FieldInput field="remark" label={t("common.remark")}
          value={form.remark} onChange={e => setField("remark", e.target.value)} />
      </div>

    </div>
  );
}
