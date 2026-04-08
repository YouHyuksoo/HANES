"use client";

/**
 * @file quality/fai/components/FaiFormPanel.tsx
 * @description 초물검사 등록/수정 우측 슬라이드 패널
 *
 * 초보자 가이드:
 * 1. triggerType: ComCodeSelect FAI_TRIGGER_TYPE (신규품목/ECN/공정변경/장기정지)
 * 2. itemCode: 품목코드 입력
 * 3. lineCode: LineSelect 사용
 * 4. editData=null → 신규, editData 있으면 수정
 */
import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { X, Search } from "lucide-react";
import { Button, Input } from "@/components/ui";
import { LineSelect, ComCodeSelect, WorkerSelect } from "@/components/shared";
import PartSearchModal from "@/components/shared/PartSearchModal";
import type { PartItem } from "@/components/shared/PartSearchModal";
import OrderSearchModal from "@/components/shared/OrderSearchModal";
import type { OrderItem } from "@/components/shared/OrderSearchModal";
import api from "@/services/api";

interface FaiFormData {
  triggerType: string;
  triggerRef: string;
  itemCode: string;
  orderNo: string;
  lineCode: string;
  sampleQty: string;
  inspectorCode: string;
  remark: string;
}

const INIT: FaiFormData = {
  triggerType: "NEW_PART",
  triggerRef: "",
  itemCode: "",
  orderNo: "",
  lineCode: "",
  sampleQty: "1",
  inspectorCode: "",
  remark: "",
};

interface Props {
  editData: {
    faiNo: string;
    triggerType: string;
    triggerRef: string;
    itemCode: string;
    orderNo: string;
    lineCode: string;
    sampleQty: number;
    inspectorCode: string;
    remark: string;
  } | null;
  onClose: () => void;
  onSave: () => void;
}

export default function FaiFormPanel({ editData, onClose, onSave }: Props) {
  const { t } = useTranslation();
  const isEdit = !!editData;
  const [form, setForm] = useState<FaiFormData>(INIT);
  const [saving, setSaving] = useState(false);
  const [partModalOpen, setPartModalOpen] = useState(false);
  const [orderModalOpen, setOrderModalOpen] = useState(false);

  useEffect(() => {
    if (editData) {
      setForm({
        triggerType: editData.triggerType ?? "NEW_PART",
        triggerRef: editData.triggerRef ?? "",
        itemCode: editData.itemCode ?? "",
        orderNo: editData.orderNo ?? "",
        lineCode: editData.lineCode ?? "",
        sampleQty: String(editData.sampleQty ?? 1),
        inspectorCode: editData.inspectorCode ?? "",
        remark: editData.remark ?? "",
      });
    } else {
      setForm(INIT);
    }
  }, [editData]);

  const setField = (key: keyof FaiFormData, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = useCallback(async () => {
    if (!form.itemCode || !form.sampleQty) return;
    setSaving(true);
    try {
      const payload = {
        triggerType: form.triggerType,
        triggerRef: form.triggerRef || undefined,
        itemCode: form.itemCode,
        orderNo: form.orderNo || undefined,
        lineCode: form.lineCode || undefined,
        sampleQty: Number(form.sampleQty) || 1,
        inspectorCode: form.inspectorCode || undefined,
        remark: form.remark || undefined,
      };
      if (isEdit && editData) {
        await api.put(`/quality/fai/${editData.faiNo}`, payload);
      } else {
        await api.post("/quality/fai", payload);
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
    <div className="w-[420px] border-l border-border bg-background flex flex-col h-full overflow-hidden shadow-2xl text-xs animate-slide-in-right">
      {/* 헤더 */}
      <div className="px-5 py-3 border-b border-border flex items-center justify-between flex-shrink-0">
        <h2 className="text-sm font-bold text-text">
          {isEdit ? t("common.edit") : t("quality.fai.create")}
        </h2>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="secondary" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button size="sm" onClick={handleSave}
            disabled={saving || !form.itemCode || !form.sampleQty}>
            {saving ? t("common.saving") : isEdit ? t("common.edit") : t("common.add")}
          </Button>
        </div>
      </div>

      {/* 본문 */}
      <div className="flex-1 overflow-y-auto px-5 py-3 space-y-4">
        <ComCodeSelect groupCode="FAI_TRIGGER_TYPE" includeAll={false}
          label={t("quality.fai.triggerType")} value={form.triggerType}
          onChange={(v) => setField("triggerType", v)} fullWidth />

        <Input label={t("quality.fai.triggerRef")} value={form.triggerRef}
          onChange={(e) => setField("triggerRef", e.target.value)} fullWidth />

        <div>
          <label className="block text-xs font-medium text-text mb-1">
            {t("common.code") + " *"}
          </label>
          <div className="flex gap-1">
            <Input value={form.itemCode} readOnly fullWidth
              placeholder={t("common.partSearchPlaceholder", "품목 검색...")}
              onClick={() => setPartModalOpen(true)}
              className="cursor-pointer" />
            <Button size="sm" variant="secondary" onClick={() => setPartModalOpen(true)}>
              <Search className="w-3 h-3" />
            </Button>
          </div>
        </div>

        <Input label={t("quality.fai.sampleQty")} type="number" value={form.sampleQty}
          onChange={(e) => setField("sampleQty", e.target.value)} fullWidth />

        <WorkerSelect label={t("quality.fai.inspectorCode")} value={form.inspectorCode}
          onChange={(v) => setField("inspectorCode", v)} fullWidth />

        <div>
          <label className="block text-xs font-medium text-text mb-1">
            {t("quality.fai.orderNo", "작업지시")}
          </label>
          <div className="flex gap-1">
            <Input value={form.orderNo} readOnly fullWidth
              placeholder={t("quality.fai.orderSearchPlaceholder", "작업지시 검색...")}
              onClick={() => setOrderModalOpen(true)}
              className="cursor-pointer" />
            <Button size="sm" variant="secondary" onClick={() => setOrderModalOpen(true)}>
              <Search className="w-3 h-3" />
            </Button>
          </div>
        </div>

        <LineSelect label={t("production.line", "라인")} value={form.lineCode}
          onChange={(v) => setField("lineCode", v)} fullWidth />

        <Input label={t("common.remark")} value={form.remark}
          onChange={(e) => setField("remark", e.target.value)} fullWidth />
      </div>
      <PartSearchModal
        isOpen={partModalOpen}
        onClose={() => setPartModalOpen(false)}
        onSelect={(part: PartItem) => setField("itemCode", part.itemCode)}
      />
      <OrderSearchModal
        isOpen={orderModalOpen}
        onClose={() => setOrderModalOpen(false)}
        onSelect={(order: OrderItem) => setField("orderNo", order.orderNo)}
      />
    </div>
  );
}
