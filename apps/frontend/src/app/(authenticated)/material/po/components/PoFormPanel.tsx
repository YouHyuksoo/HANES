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
import { Plus, Trash2, Search } from "lucide-react";
import { Button, Input } from "@/components/ui";
import { PartnerSelect } from "@/components/shared";
import PartSearchModal from "@/components/shared/PartSearchModal";
import type { PartItem } from "@/components/shared/PartSearchModal";
import api from "@/services/api";

interface ItemRow {
  itemCode: string;
  itemName: string;
  orderQty: number;
  unitPrice: number;
  remark: string;
}

interface PoFormData {
  poNo: string;
  partnerId: string;
  orderDate: string;
  dueDate: string;
  remark: string;
}

export interface PurchaseOrder {
  poNo: string;
  partnerId: string;
  partnerName: string;
  orderDate: string;
  dueDate: string;
  status: string;
  totalAmount: number | null;
  remark: string | null;
  items: {
    itemCode: string;
    itemName: string;
    orderQty: number;
    unitPrice: number | null;
    remark: string | null;
  }[];
}

const INIT_FORM: PoFormData = {
  poNo: "", partnerId: "", orderDate: "", dueDate: "", remark: "",
};

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
        partnerId: editData.partnerId || "",
        orderDate: editData.orderDate?.slice(0, 10) || "",
        dueDate: editData.dueDate?.slice(0, 10) || "",
        remark: editData.remark || "",
      });
      setItems(
        editData.items.map(it => ({
          itemCode: it.itemCode || "",
          itemName: it.itemName || "",
          orderQty: it.orderQty ?? 0,
          unitPrice: it.unitPrice ?? 0,
          remark: it.remark || "",
        })),
      );
    } else {
      setForm(INIT_FORM);
      setItems([]);
    }
  }, [editData]);

  const setField = (key: keyof PoFormData, value: string) =>
    setForm(prev => ({ ...prev, [key]: value }));

  const handlePartSelect = useCallback((part: PartItem) => {
    setItems(prev => [
      ...prev,
      { itemCode: part.itemCode, itemName: part.itemName, orderQty: 1, unitPrice: 0, remark: "" },
    ]);
  }, []);

  const updateItem = (idx: number, key: keyof ItemRow, value: string | number) => {
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, [key]: value } : it));
  };

  const removeItem = (idx: number) => {
    setItems(prev => prev.filter((_, i) => i !== idx));
  };

  const totalAmount = items.reduce((s, it) => s + it.orderQty * it.unitPrice, 0);

  const handleSave = useCallback(async () => {
    if (!form.poNo || !form.partnerId || items.length === 0) return;
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
  }, [form, items, isEdit, editData, onSave, onClose]);

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
            disabled={saving || !form.poNo || !form.partnerId || items.length === 0}>
            {saving ? t("common.saving") : isEdit ? t("common.edit") : t("common.register")}
          </Button>
        </div>
      </div>

      {/* 본문 */}
      <div className="flex-1 overflow-y-auto px-5 py-3 space-y-4 min-h-0">
        {/* PO 헤더 */}
        <div className="grid grid-cols-2 gap-3">
          <Input label={t("material.po.poNo")} placeholder="PO-YYYYMMDD-001"
            value={form.poNo} onChange={e => setField("poNo", e.target.value)}
            disabled={isEdit} fullWidth />
          <PartnerSelect label={t("material.po.partnerName")} partnerType="SUPPLIER"
            value={form.partnerId} onChange={v => setField("partnerId", v)} fullWidth />
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
        <div className="border-t border-border pt-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-text">
              {t("material.po.itemList", "발주 품목")} ({items.length})
            </span>
            <Button size="sm" variant="secondary" onClick={() => setPartModalOpen(true)}>
              <Plus className="w-3 h-3 mr-1" />{t("material.po.addItem", "품목 추가")}
            </Button>
          </div>

          {items.length === 0 ? (
            <div className="text-center py-8 text-text-muted">
              <Search className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p>{t("material.po.noItems", "품목을 추가하세요")}</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[320px] overflow-y-auto">
              {items.map((item, idx) => (
                <div key={idx} className="p-3 rounded-lg border border-border bg-surface-secondary dark:bg-slate-800/50">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <span className="font-mono font-medium text-primary">{item.itemCode}</span>
                      <span className="ml-2 text-text-muted">{item.itemName}</span>
                    </div>
                    <button onClick={() => removeItem(idx)}
                      className="p-1 hover:bg-red-50 dark:hover:bg-red-900/20 rounded">
                      <Trash2 className="w-3.5 h-3.5 text-red-500" />
                    </button>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <Input label={t("material.po.orderQty")} type="number" value={String(item.orderQty)}
                      onChange={e => updateItem(idx, "orderQty", Number(e.target.value) || 0)} fullWidth />
                    <Input label={t("material.po.unitPrice")} type="number" value={String(item.unitPrice)}
                      onChange={e => updateItem(idx, "unitPrice", Number(e.target.value) || 0)} fullWidth />
                    <Input label={t("common.remark")} value={item.remark}
                      onChange={e => updateItem(idx, "remark", e.target.value)} fullWidth />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* 합계 */}
          {items.length > 0 && (
            <div className="flex justify-end mt-2 text-xs">
              <span className="text-text-muted mr-2">{t("material.po.totalAmount")}:</span>
              <span className="font-bold text-primary">{totalAmount.toLocaleString()}</span>
            </div>
          )}
        </div>
      </div>

      <PartSearchModal isOpen={partModalOpen} onClose={() => setPartModalOpen(false)}
        onSelect={handlePartSelect} itemType="RAW_MATERIAL" />
    </div>
  );
}
