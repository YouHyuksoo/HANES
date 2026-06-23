"use client";

/**
 * @file material/po/components/PoFormPanel.tsx
 * @description PO 등록/수정 사이드패널 — 헤더 + 품목 목록 관리
 *
 * 초보자 가이드:
 * 1. editData=null → 신규 등록, editData 있으면 수정
 * 2. 품목은 PartSearchModal로 선택 후 수량/단가 입력
 * 3. 저장 시 PO 헤더 + items 배열을 한번에 전송
 */
import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { formatQty, parseQty } from "@/utils/qty";
import toast from "react-hot-toast";
import { Plus, Trash2, Search } from "lucide-react";
import { Button, Input } from "@/components/ui";
import { PartnerSelect } from "@/components/shared";
import PartSearchModal from "@/components/shared/PartSearchModal";
import type { PartItem } from "@/components/shared/PartSearchModal";
import api from "@/services/api";
import { getTodayLocal } from "@/utils/date";

interface ItemRow {
  lineNo: number;
  revNo: number;
  itemCode: string;
  itemName: string;
  orderQty: number;
  remark: string;
}

interface PoFormData {
  poNo: string;
  partnerCode: string;
  orderDate: string;
  dueDate: string;
  remark: string;
}

export interface PurchaseOrder {
  poNo: string;
  partnerCode: string;
  partnerName: string;
  orderDate: string;
  dueDate: string;
  status: string;
  totalAmount: number | null;
  remark: string | null;
  items: {
    lineNo: number;
    revNo: number;
    itemCode: string;
    itemName: string;
    orderQty: number;
    remark: string | null;
  }[];
}

const INIT_FORM: PoFormData = {
  poNo: "", partnerCode: "", orderDate: "", dueDate: "", remark: "",
};

interface CompactItemInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  min?: number;
  step?: number;
  error?: string;
}

function CompactItemInput({
  label,
  value,
  onChange,
  type = "text",
  inputMode,
  min,
  step,
  error,
}: CompactItemInputProps) {
  return (
    <label className="flex min-w-0 flex-col gap-1">
      <span className="block text-[10px] font-medium leading-none text-text-muted">
        {label}
      </span>
      <input
        type={type}
        inputMode={inputMode}
        min={min}
        step={step}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={!!error}
        title={error}
        className={`h-7 w-full rounded border border-border bg-surface px-2 text-xs text-text outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary ${
          error ? "border-error focus:border-error focus:ring-error" : ""
        }`}
      />
      {error && (
        <span className="text-[10px] leading-none text-error">{error}</span>
      )}
    </label>
  );
}

interface Props {
  editData: PurchaseOrder | null;
  onClose: () => void;
  onSave: () => void;
}

export default function PoFormPanel({ editData, onClose, onSave }: Props) {
  const { t } = useTranslation();
  const isEdit = !!editData;
  const [form, setForm] = useState<PoFormData>(INIT_FORM);
  const [items, setItems] = useState<ItemRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [partModalOpen, setPartModalOpen] = useState(false);

  useEffect(() => {
    if (editData) {
      setForm({
        poNo: editData.poNo,
        partnerCode: editData.partnerCode || "",
        orderDate: editData.orderDate?.slice(0, 10) || "",
        dueDate: editData.dueDate?.slice(0, 10) || "",
        remark: editData.remark || "",
      });
      setItems(
        editData.items.map((it, idx) => ({
          lineNo: it.lineNo ?? idx + 1,
          revNo: it.revNo ?? 1,
          itemCode: it.itemCode || "",
          itemName: it.itemName || "",
          orderQty: it.orderQty ?? 0,
          remark: it.remark || "",
        })),
      );
    } else {
      const today = getTodayLocal();
      setForm({ ...INIT_FORM, orderDate: today });
      setItems([]);
      api.get("/material/purchase-orders/next-no").then(res => {
        if (res.data?.data) setField("poNo", res.data.data);
      }).catch(() => {});
    }
  }, [editData]);

  const setField = (key: keyof PoFormData, value: string) =>
    setForm(prev => ({ ...prev, [key]: value }));

  const appendParts = useCallback((parts: PartItem[]) => {
    setItems(prev => {
      const nextLineNo = prev.length > 0 ? Math.max(...prev.map(i => i.lineNo)) + 1 : 1;
      const existingCodes = new Set(prev.map((item) => item.itemCode));
      const newParts = parts.filter((part) => !existingCodes.has(part.itemCode));
      return [
        ...prev,
        ...newParts.map((part, index) => ({
          lineNo: nextLineNo + index,
          revNo: 1,
          itemCode: part.itemCode,
          itemName: part.itemName,
          orderQty: 1,
          remark: "",
        })),
      ];
    });
  }, []);

  const handlePartSelect = useCallback((part: PartItem) => {
    appendParts([part]);
  }, [appendParts]);

  const handlePartSelectMany = useCallback((parts: PartItem[]) => {
    appendParts(parts);
  }, [appendParts]);

  const updateItem = (idx: number, key: keyof ItemRow, value: string | number) => {
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, [key]: value } : it));
  };

  const removeItem = (idx: number) => {
    setItems(prev => prev.filter((_, i) => i !== idx));
  };

  // 수량 검증: 모든 품목은 1 이상의 정수여야 한다 (서버 400 방지)
  const invalidQtyItem = items.find(
    (it) => !Number.isInteger(it.orderQty) || it.orderQty < 1,
  );
  const hasInvalidQty = !!invalidQtyItem;

  const handleSave = useCallback(async () => {
    if (!form.poNo || !form.partnerCode || items.length === 0) return;
    const badItem = items.find(
      (it) => !Number.isInteger(it.orderQty) || it.orderQty < 1,
    );
    if (badItem) {
      toast.error(
        t(
          "material.po.invalidQty",
          "발주수량은 1 이상의 정수로 입력하세요. (품목: {{code}})",
          { code: badItem.itemCode },
        ),
      );
      return;
    }
    setSaving(true);
    try {
      const payload = { ...form, items };
      if (isEdit) {
        await api.put(`/material/purchase-orders/${editData!.poNo}`, payload);
      } else {
        await api.post("/material/purchase-orders", payload);
      }
      onSave();
      onClose();
    } catch {
      // api 인터셉터에서 처리
    } finally {
      setSaving(false);
    }
  }, [form, items, isEdit, editData, onSave, onClose, t]);

  return (
    <div className="w-[560px] border-l border-border bg-background flex flex-col h-full overflow-hidden shadow-2xl text-xs animate-slide-in-right">
      {/* 헤더 */}
      <div className="px-5 py-3 border-b border-border flex items-center justify-between flex-shrink-0">
        <h2 className="text-sm font-bold text-text">
          {isEdit ? t("common.edit") : t("material.po.create", "PO 등록")}
        </h2>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="secondary" onClick={onClose}>{t("common.cancel")}</Button>
          <Button size="sm" onClick={handleSave}
            disabled={saving || !form.poNo || !form.partnerCode || items.length === 0 || hasInvalidQty}>
            {saving ? t("common.saving") : t("common.save", "저장")}
          </Button>
        </div>
      </div>

      {/* 본문 */}
      <div className="flex-1 min-h-0 overflow-hidden px-5 py-3 flex flex-col gap-4">
        {/* PO 헤더 */}
        <div className="grid grid-cols-2 gap-3">
          <Input label={t("material.po.poNo")} placeholder="PO-YYYYMMDD-001"
            value={form.poNo} onChange={e => setField("poNo", e.target.value)}
            disabled={isEdit} fullWidth />
          <PartnerSelect label={t("material.po.partnerName")} partnerType="SUPPLIER"
            value={form.partnerCode} onChange={v => setField("partnerCode", v)} fullWidth />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input label={t("material.po.orderDate")} type="date"
            value={form.orderDate} onChange={e => setField("orderDate", e.target.value)} fullWidth />
          <Input label={t("material.po.dueDate")} type="date"
            value={form.dueDate} onChange={e => setField("dueDate", e.target.value)} fullWidth />
        </div>
        <Input label={t("common.remark")} value={form.remark}
          onChange={e => setField("remark", e.target.value)} fullWidth />

        {/* 품목 섹션 */}
        <div className="border-t border-border pt-3 flex-1 min-h-0 flex flex-col">
          <div className="flex items-center justify-between mb-2 flex-shrink-0">
            <span className="text-xs font-bold text-text">
              {t("material.po.itemList", "발주 품목")} ({items.length})
            </span>
            <Button size="sm" variant="secondary" onClick={() => setPartModalOpen(true)}>
              <Plus className="w-3 h-3 mr-1" />{t("material.po.addItem", "품목 추가")}
            </Button>
          </div>

          {items.length === 0 ? (
            <div className="flex-1 min-h-[160px] flex flex-col items-center justify-center text-center text-text-muted">
              <Search className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p>{t("material.po.noItems", "품목을 추가하세요")}</p>
            </div>
          ) : (
            <div className="flex-1 min-h-0 space-y-1.5 overflow-y-auto pr-1">
              {items.map((item, idx) => (
                <div key={idx} className="p-2 rounded-md border border-border bg-surface-secondary dark:bg-slate-800/50">
                  <div className="flex items-start justify-between mb-1.5">
                    <div className="min-w-0">
                      <span className="font-mono text-xs font-medium text-primary">{item.itemCode}</span>
                      <span className="ml-2 text-[11px] text-text-muted">{item.itemName}</span>
                    </div>
                    <button onClick={() => removeItem(idx)}
                      className="p-1 hover:bg-red-50 dark:hover:bg-red-900/20 rounded">
                      <Trash2 className="w-3.5 h-3.5 text-red-500" />
                    </button>
                  </div>
                  <div className="grid grid-cols-4 gap-1.5">
                    <CompactItemInput label={t("material.po.lineNo", "라인번호")} type="number" value={String(item.lineNo)}
                      onChange={(value) => updateItem(idx, "lineNo", Number(value) || 1)} />
                    <CompactItemInput label={t("material.po.revNo", "릴리즈번호")} type="number" value={String(item.revNo)}
                      onChange={(value) => updateItem(idx, "revNo", Number(value) || 1)} />
                    <CompactItemInput label={t("material.po.orderQty")} type="text" inputMode="numeric"
                      value={formatQty(item.orderQty)}
                      error={(!Number.isInteger(item.orderQty) || item.orderQty < 1)
                        ? t("material.po.qtyMin", "1 이상")
                        : undefined}
                      onChange={(value) => updateItem(idx, "orderQty", Math.trunc(parseQty(value)) || 0)} />
                    <CompactItemInput label={t("common.remark")} value={item.remark}
                      onChange={(value) => updateItem(idx, "remark", value)} />
                  </div>
                </div>
              ))}
            </div>
          )}

        </div>
      </div>

      <PartSearchModal isOpen={partModalOpen} onClose={() => setPartModalOpen(false)}
        onSelect={handlePartSelect} multiSelect onSelectMany={handlePartSelectMany}
        itemType="RAW_MATERIAL" pageSize={10} />
    </div>
  );
}
