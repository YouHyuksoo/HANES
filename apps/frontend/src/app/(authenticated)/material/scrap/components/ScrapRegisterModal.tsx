"use client";

/**
 * @file material/scrap/components/ScrapRegisterModal.tsx
 * @description 폐기 등록 모달 - 창고/품목/LOT 선택 → 수량/사유 입력 → 폐기 처리
 *
 * 초보자 가이드:
 * 1. 창고 선택 → 품목 선택 → LOT 선택 (현재고 표시)
 * 2. 폐기 수량 + 사유 입력
 * 3. POST /inventory/scrap 호출
 */

import { useState, useEffect, useMemo, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Modal, Button, Input, Select } from "@/components/ui";
import { useWarehouseOptions } from "@/hooks/useMasterOptions";
import api from "@/services/api";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
}

interface StockItem {
  id: string;
  partId: string;
  partCode: string;
  partName: string;
  lotId: string;
  lotNo: string;
  availableQty: number;
}

export default function ScrapRegisterModal({ isOpen, onClose, onCreated }: Props) {
  const { t } = useTranslation();
  const { options: warehouseOptions } = useWarehouseOptions();
  const [saving, setSaving] = useState(false);
  const [stocks, setStocks] = useState<StockItem[]>([]);

  const [form, setForm] = useState({
    warehouseId: "",
    stockId: "",
    qty: "",
    reason: "",
  });

  const whOptions = useMemo(() => [
    { value: "", label: t("common.select") }, ...warehouseOptions,
  ], [t, warehouseOptions]);

  useEffect(() => {
    if (!form.warehouseId) { setStocks([]); return; }
    api.get("/inventory/stocks", { params: { warehouseId: form.warehouseId, limit: 5000 } }).then(res => {
      const list = (res.data?.data ?? [])
        .filter((s: any) => s.availableQty > 0)
        .map((s: any) => ({
          id: s.id,
          partId: s.partId,
          partCode: s.part?.partCode || "",
          partName: s.part?.partName || "",
          lotId: s.lotId || "",
          lotNo: s.lot?.lotNo || "",
          availableQty: s.availableQty,
        }));
      setStocks(list);
    }).catch(() => setStocks([]));
  }, [form.warehouseId]);

  const stockOptions = useMemo(() => [
    { value: "", label: t("common.select") },
    ...stocks.map(s => ({
      value: s.id,
      label: `${s.partCode} - ${s.partName} (${s.lotNo || "N/A"}) [${s.availableQty}]`,
    })),
  ], [t, stocks]);

  const selectedStock = useMemo(() =>
    stocks.find(s => s.id === form.stockId), [stocks, form.stockId]);

  const handleSubmit = useCallback(async () => {
    if (!selectedStock || !form.qty || !form.reason) return;
    setSaving(true);
    try {
      await api.post("/inventory/scrap", {
        warehouseId: form.warehouseId,
        partId: selectedStock.partId,
        lotId: selectedStock.lotId || undefined,
        qty: Number(form.qty),
        transType: "SCRAP",
        remark: form.reason,
      });
      setForm({ warehouseId: "", stockId: "", qty: "", reason: "" });
      onCreated();
      onClose();
    } catch (e) {
      console.error("Scrap failed:", e);
    } finally {
      setSaving(false);
    }
  }, [form, selectedStock, onCreated, onClose]);

  const maxQty = selectedStock?.availableQty ?? 0;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t("material.scrap.register")} size="lg">
      <div className="space-y-4">
        <Select label={t("material.scrap.warehouse")} options={whOptions}
          value={form.warehouseId} onChange={v => setForm(p => ({ ...p, warehouseId: v, stockId: "" }))} fullWidth />
        <Select label={t("material.scrap.stockSelect")} options={stockOptions}
          value={form.stockId} onChange={v => setForm(p => ({ ...p, stockId: v }))} fullWidth />

        {selectedStock && (
          <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800 text-sm">
            <div className="grid grid-cols-3 gap-2">
              <div><span className="text-text-muted">{t("common.partCode")}:</span> <span className="font-mono">{selectedStock.partCode}</span></div>
              <div><span className="text-text-muted">{t("common.partName")}:</span> {selectedStock.partName}</div>
              <div><span className="text-text-muted">{t("material.scrap.availableQty")}:</span> <span className="font-medium text-blue-600 dark:text-blue-400">{selectedStock.availableQty.toLocaleString()}</span></div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <Input label={`${t("material.scrap.qty")} (${t("material.scrap.max")}: ${maxQty})`} type="number"
            value={form.qty} onChange={e => setForm(p => ({ ...p, qty: e.target.value }))}
            fullWidth />
          <Input label={t("material.scrap.reason")} placeholder={t("material.scrap.reasonPlaceholder")}
            value={form.reason} onChange={e => setForm(p => ({ ...p, reason: e.target.value }))}
            fullWidth />
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-6">
        <Button variant="secondary" onClick={onClose}>{t("common.cancel")}</Button>
        <Button onClick={handleSubmit}
          disabled={saving || !form.stockId || !form.qty || Number(form.qty) <= 0 || Number(form.qty) > maxQty || !form.reason}>
          {saving ? t("common.saving") : t("material.scrap.register")}
        </Button>
      </div>
    </Modal>
  );
}
