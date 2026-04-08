"use client";

/**
 * @file product/issue/components/IssueFormPanel.tsx
 * @description 제품 출고등록 우측 슬라이드 패널
 *
 * 초보자 가이드:
 * 1. **우측 패널**: 출고등록 버튼 클릭 시 오른쪽에서 슬라이드 인
 * 2. **품목유형 탭**: WIP(반제품) / FG(완제품) 전환
 * 3. **재고 기반 선택**: 가용재고가 있는 품목만 표시
 * 4. **출고계정(ISSUE_TYPE)**: ComCode 기반 필수 선택
 */
import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Button, Input, Select } from "@/components/ui";
import { useComCodeOptions } from "@/hooks/useComCode";
import api from "@/services/api";

interface ProductStockItem {
  id: string;
  itemCode: string;
  itemName: string | null;
  warehouseCode: string;
  warehouseName: string | null;
  availableQty: number;
  unit: string | null;
}

export interface IssueFormValues {
  itemCode: string;
  warehouseCode: string;
  qty: number;
  itemType: "SEMI_PRODUCT" | "FINISHED";
  transType: string;
  issueType: string;
  remark: string;
}

interface Props {
  onClose: () => void;
  onSubmit: (data: IssueFormValues) => void;
  loading?: boolean;
}

const INITIAL_FORM = {
  itemCode: "",
  warehouseCode: "",
  qty: 1,
  issueType: "",
  remark: "",
};

export default function IssueFormPanel({ onClose, onSubmit, loading }: Props) {
  const { t } = useTranslation();
  const [partType, setPartType] = useState<"SEMI_PRODUCT" | "FINISHED">("SEMI_PRODUCT");
  const [form, setForm] = useState(INITIAL_FORM);
  const [stocks, setStocks] = useState<ProductStockItem[]>([]);

  const issueTypeOptions = useComCodeOptions("ISSUE_TYPE");

  const tabs = [
    { key: "SEMI_PRODUCT" as const, label: t("productMgmt.receive.tabWip") },
    { key: "FINISHED" as const, label: t("productMgmt.receive.tabFg") },
  ];

  /** 가용재고 조회 */
  const fetchStocks = useCallback(async (type: string) => {
    try {
      const res = await api.get("/inventory/product/stock", {
        params: { itemType: type, includeZero: false },
      });
      const list = res.data?.data ?? res.data;
      setStocks(Array.isArray(list) ? list.filter((s: ProductStockItem) => s.availableQty > 0) : []);
    } catch {
      setStocks([]);
    }
  }, []);

  useEffect(() => { fetchStocks(partType); }, [partType, fetchStocks]);

  /** 품목유형 전환 */
  const handlePartTypeChange = useCallback((type: "SEMI_PRODUCT" | "FINISHED") => {
    setPartType(type);
    setForm((prev) => ({ ...prev, itemCode: "", warehouseCode: "" }));
  }, []);

  /** 품목 선택 시 창고 자동 설정 */
  const handlePartChange = useCallback((itemCode: string) => {
    const stock = stocks.find((s) => s.itemCode === itemCode);
    setForm((prev) => ({
      ...prev,
      itemCode,
      warehouseCode: stock?.warehouseCode || "",
      qty: Math.min(prev.qty, stock?.availableQty || 1),
    }));
  }, [stocks]);

  /** 선택된 품목의 가용수량 */
  const selectedStock = useMemo(
    () => stocks.find((s) => s.itemCode === form.itemCode && s.warehouseCode === form.warehouseCode),
    [stocks, form.itemCode, form.warehouseCode],
  );

  /** 재고 기반 품목 옵션 */
  const stockPartOptions = useMemo(() => {
    const seen = new Set<string>();
    return stocks
      .filter((s) => { if (seen.has(s.itemCode)) return false; seen.add(s.itemCode); return true; })
      .map((s) => ({ value: s.itemCode, label: `${s.itemCode} - ${s.itemName || ""}` }));
  }, [stocks]);

  /** 선택된 품목의 창고 옵션 */
  const stockWarehouseOptions = useMemo(
    () => stocks
      .filter((s) => s.itemCode === form.itemCode)
      .map((s) => ({
        value: s.warehouseCode,
        label: `${s.warehouseName || s.warehouseCode} (${t("common.available")}: ${s.availableQty})`,
      })),
    [stocks, form.itemCode, t],
  );

  const handleSubmit = () => {
    if (!form.itemCode || !form.warehouseCode || !form.issueType || form.qty < 1) return;
    onSubmit({
      itemCode: form.itemCode,
      warehouseCode: form.warehouseCode,
      qty: form.qty,
      itemType: partType,
      transType: partType === "SEMI_PRODUCT" ? "WIP_OUT" : "FG_OUT",
      issueType: form.issueType,
      remark: form.remark,
    });
    setForm(INITIAL_FORM);
  };

  return (
    <div className="w-[420px] border-l border-border bg-background flex flex-col h-full overflow-hidden shadow-2xl text-xs animate-slide-in-right">
      {/* 헤더 */}
      <div className="px-5 py-3 border-b border-border flex items-center justify-between flex-shrink-0">
        <h2 className="text-sm font-bold text-text">{t("productMgmt.issue.modal.title")}</h2>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="secondary" onClick={onClose}>{t("common.cancel")}</Button>
          <Button size="sm" onClick={handleSubmit}
            disabled={loading || !form.itemCode || !form.warehouseCode || !form.issueType}>
            {loading ? t("common.saving") : t("productMgmt.issue.modal.confirm")}
          </Button>
        </div>
      </div>

      {/* 본문 */}
      <div className="flex-1 overflow-y-auto px-5 py-3 space-y-4">
        {/* 품목유형 탭 */}
        <div>
          <h3 className="text-xs font-semibold text-text-muted mb-2">
            {t("productMgmt.issue.modal.partType")}
          </h3>
          <div className="flex gap-2">
            {tabs.map((tab) => (
              <button key={tab.key} onClick={() => handlePartTypeChange(tab.key)}
                className={`flex-1 px-3 py-2 text-sm rounded-md border transition-colors ${
                  partType === tab.key
                    ? "bg-primary text-white border-primary"
                    : "bg-surface border-border text-text hover:bg-muted"
                }`}>
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* 품목 / 창고 */}
        <Select label={t("productMgmt.issue.modal.partId")}
          options={stockPartOptions} value={form.itemCode}
          onChange={handlePartChange} fullWidth />

        <Select label={t("productMgmt.issue.modal.warehouseId")}
          options={stockWarehouseOptions} value={form.warehouseCode}
          onChange={(v) => setForm({ ...form, warehouseCode: v })} fullWidth />

        {/* 수량 + 가용수량 표시 */}
        <Input label={t("productMgmt.issue.modal.qty")} type="number" min={1}
          max={selectedStock?.availableQty || 99999}
          value={String(form.qty)}
          onChange={(e) => setForm({ ...form, qty: Number(e.target.value) })} fullWidth />

        {selectedStock && (
          <div className="text-sm text-text-muted">
            {t("common.available")}: <span className="font-bold text-text">{selectedStock.availableQty.toLocaleString()}</span> {selectedStock.unit || ""}
          </div>
        )}

        {/* 출고계정 */}
        <Select label={`${t("productMgmt.issue.modal.issueType")} *`}
          options={issueTypeOptions} value={form.issueType}
          onChange={(v) => setForm({ ...form, issueType: v })} fullWidth />

        {/* 비고 */}
        <Input label={t("productMgmt.issue.modal.remark")} value={form.remark}
          onChange={(e) => setForm({ ...form, remark: e.target.value })} fullWidth />
      </div>

    </div>
  );
}
