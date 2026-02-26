"use client";

/**
 * @file material/scrap/components/ScrapRegisterModal.tsx
 * @description 폐기 등록 모달 - 창고/품목/LOT 선택 → 수량/사유 입력 → 폐기 처리
 *
 * 초보자 가이드:
 * 1. 창고 선택 → 해당 창고의 가용재고만 표시 (availableQty > 0)
 * 2. 재고 선택 → 품목/LOT 상세 + 가용수량 표시
 * 3. 폐기 수량 + 사유 입력 → POST /inventory/scrap
 */

import { useState, useEffect, useMemo, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { AlertTriangle } from "lucide-react";
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
  itemCode: string;
  itemName: string;
  lotId: string;
  lotNo: string;
  availableQty: number;
}

const INITIAL_FORM = { warehouseCode: "", stockId: "", qty: "", reason: "" };

export default function ScrapRegisterModal({ isOpen, onClose, onCreated }: Props) {
  const { t } = useTranslation();
  const { options: warehouseOptions } = useWarehouseOptions("RAW");
  const [saving, setSaving] = useState(false);
  const [loadingStocks, setLoadingStocks] = useState(false);
  const [stocks, setStocks] = useState<StockItem[]>([]);
  const [form, setForm] = useState(INITIAL_FORM);

  /** 모달 열릴 때 폼 초기화 */
  useEffect(() => {
    if (isOpen) {
      setForm(INITIAL_FORM);
      setStocks([]);
    }
  }, [isOpen]);

  const whOptions = useMemo(() => [
    { value: "", label: t("common.select") }, ...warehouseOptions,
  ], [t, warehouseOptions]);

  /** 창고 선택 시 해당 창고의 가용재고 조회 */
  useEffect(() => {
    if (!form.warehouseCode) { setStocks([]); return; }
    setLoadingStocks(true);
    api.get("/inventory/stocks", { params: { warehouseCode: form.warehouseCode, limit: 5000 } }).then(res => {
      const list = (res.data?.data ?? [])
        .filter((s: any) => s.availableQty > 0)
        .map((s: any) => ({
          id: s.id,
          itemCode: s.part?.itemCode || "",
          itemName: s.part?.itemName || "",
          lotId: s.lotId || "",
          lotNo: s.lot?.lotNo || "",
          availableQty: s.availableQty,
        }));
      setStocks(list);
    }).catch(() => setStocks([])).finally(() => setLoadingStocks(false));
  }, [form.warehouseCode]);

  const stockOptions = useMemo(() => [
    { value: "", label: t("common.select") },
    ...stocks.map(s => ({
      value: s.id,
      label: `${s.itemCode} - ${s.itemName} (${s.lotNo || "N/A"}) [${s.availableQty}]`,
    })),
  ], [t, stocks]);

  const selectedStock = useMemo(() =>
    stocks.find(s => s.id === form.stockId), [stocks, form.stockId]);

  /** 폐기 처리 */
  const handleSubmit = useCallback(async () => {
    if (!selectedStock || !form.qty || !form.reason) return;
    setSaving(true);
    try {
      await api.post("/inventory/scrap", {
        warehouseCode: form.warehouseCode,
        itemCode: selectedStock.itemCode,
        lotId: selectedStock.lotId || undefined,
        qty: Number(form.qty),
        transType: "SCRAP",
        remark: form.reason,
      });
      setForm(INITIAL_FORM);
      onCreated();
      onClose();
    } catch (e) {
      console.error("Scrap failed:", e);
    } finally {
      setSaving(false);
    }
  }, [form, selectedStock, onCreated, onClose]);

  const maxQty = selectedStock?.availableQty ?? 0;
  const noStockAvailable = !!form.warehouseCode && !loadingStocks && stocks.length === 0;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t("material.scrap.register")} size="lg">
      <div className="space-y-4">
        <Select label={t("material.scrap.warehouse")} options={whOptions}
          value={form.warehouseCode} onChange={v => setForm(p => ({ ...p, warehouseCode: v, stockId: "", qty: "", reason: "" }))} fullWidth />

        {noStockAvailable && (
          <div className="flex items-center gap-2 p-3 bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300 rounded-lg text-sm">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            {t("material.scrap.noStock")}
          </div>
        )}

        <Select label={t("material.scrap.stockSelect")} options={stockOptions}
          value={form.stockId} onChange={v => setForm(p => ({ ...p, stockId: v }))}
          disabled={!form.warehouseCode || loadingStocks || noStockAvailable} fullWidth />

        {selectedStock && (
          <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800 text-sm">
            <div className="grid grid-cols-3 gap-2">
              <div><span className="text-text-muted">{t("common.partCode")}:</span> <span className="font-mono">{selectedStock.itemCode}</span></div>
              <div><span className="text-text-muted">{t("common.partName")}:</span> {selectedStock.itemName}</div>
              <div><span className="text-text-muted">{t("material.scrap.availableQty")}:</span> <span className="font-medium text-blue-600 dark:text-blue-400">{selectedStock.availableQty.toLocaleString()}</span></div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <Input label={`${t("material.scrap.qty")} (${t("material.scrap.max")}: ${maxQty})`} type="number"
            min={1} max={maxQty}
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
