/**
 * @file shipping/customer-po/components/CustomerPoFormPanel.tsx
 * @description 고객발주 등록/수정 오른쪽 슬라이드 패널 - 품목 검색 + 장바구니 패턴
 *
 * 초보자 가이드:
 * 1. **슬라이드 패널**: 오른쪽에서 슬라이드 인/아웃되는 폼 패널
 * 2. **기본 정보**: 수주번호, 고객사, 수주일, 납기일 입력
 * 3. **품목 검색**: 품목코드/품목명으로 검색하여 [+]로 추가
 * 4. **품목 목록**: 추가된 품목별 수주수량, 단가 입력
 * 5. API: GET /parts (검색), POST/PUT /shipping/customer-orders (저장)
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Search, Plus, X } from "lucide-react";
import { Button, Input, Select } from "@/components/ui";
import { usePartnerOptions } from "@/hooks/useMasterOptions";
import api from "@/services/api";

interface PartItem {
  partCode: string;
  partName: string;
  unit: string;
}

export interface OrderItem {
  partCode: string;
  partName: string;
  unit: string;
  orderQty: number;
  unitPrice: number;
}

export interface CustomerOrder {
  id: string;
  orderNo: string;
  customerName: string;
  orderDate: string;
  dueDate: string;
  status: string;
  itemCount: number;
  totalAmount: number;
  currency: string;
}

interface Props {
  editingItem: CustomerOrder | null;
  onClose: () => void;
  onSave: () => void;
  animate?: boolean;
}

export default function CustomerPoFormPanel({ editingItem, onClose, onSave, animate = true }: Props) {
  const { t } = useTranslation();
  const isEdit = !!editingItem;
  const { options: customerOptions } = usePartnerOptions("CUSTOMER");

  const [form, setForm] = useState({
    orderNo: "",
    customerCode: "",
    orderDate: new Date().toISOString().split("T")[0],
    dueDate: "",
    remark: "",
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<PartItem[]>([]);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm({
      orderNo: editingItem?.orderNo || "",
      customerCode: editingItem?.customerName || "",
      orderDate: editingItem?.orderDate || new Date().toISOString().split("T")[0],
      dueDate: editingItem?.dueDate || "",
      remark: "",
    });
    setSearchQuery("");
    setSearchResults([]);
    setOrderItems([]);
  }, [editingItem]);

  const setField = (key: string, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) { setSearchResults([]); return; }
    try {
      const res = await api.get("/parts", { params: { search: searchQuery, limit: "50" } });
      setSearchResults(res.data?.data ?? []);
    } catch {
      setSearchResults([]);
    }
  }, [searchQuery]);

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSearch();
  };

  const addItem = (item: PartItem) => {
    if (orderItems.some((r) => r.partCode === item.partCode)) return;
    setOrderItems((prev) => [
      ...prev,
      { partCode: item.partCode, partName: item.partName, unit: item.unit, orderQty: 0, unitPrice: 0 },
    ]);
  };

  const removeItem = (partCode: string) => {
    setOrderItems((prev) => prev.filter((r) => r.partCode !== partCode));
  };

  const updateItem = (partCode: string, field: "orderQty" | "unitPrice", value: number) => {
    setOrderItems((prev) =>
      prev.map((r) => (r.partCode === partCode ? { ...r, [field]: value } : r)),
    );
  };

  const handleSubmit = useCallback(async () => {
    setSaving(true);
    try {
      const payload = {
        ...form,
        items: orderItems,
        totalAmount: orderItems.reduce((s, r) => s + r.orderQty * r.unitPrice, 0),
      };
      if (isEdit && editingItem?.id) {
        await api.put(`/shipping/customer-orders/${editingItem.id}`, payload);
      } else {
        await api.post("/shipping/customer-orders", payload);
      }
      onSave();
      onClose();
    } catch {
      // 에러는 api 인터셉터에서 처리
    } finally {
      setSaving(false);
    }
  }, [form, orderItems, isEdit, editingItem, onSave, onClose]);

  const canSubmit = orderItems.length > 0 && orderItems.every((r) => r.orderQty > 0);
  const totalAmount = orderItems.reduce((sum, r) => sum + r.orderQty * r.unitPrice, 0);

  return (
    <div className={`w-[560px] border-l border-border bg-background flex flex-col h-full overflow-hidden shadow-2xl text-xs ${animate ? "animate-slide-in-right" : ""}`}>
      {/* 헤더 */}
      <div className="px-5 py-3 border-b border-border flex items-center justify-between flex-shrink-0">
        <h2 className="text-sm font-bold text-text">
          {isEdit ? t("shipping.customerPo.editTitle") : t("shipping.customerPo.addTitle")}
        </h2>
        <button onClick={onClose} className="p-1 rounded hover:bg-surface transition-colors">
          <X className="w-4 h-4 text-text-muted hover:text-text" />
        </button>
      </div>

      {/* 본문 */}
      <div className="flex-1 overflow-y-auto px-5 py-3 space-y-4">
        {/* 기본정보 */}
        <div>
          <h3 className="text-xs font-semibold text-text-muted mb-2">{t("shipping.customerPo.sectionBasic", "기본정보")}</h3>
          <div className="grid grid-cols-2 gap-3">
            <Input label={t("shipping.customerPo.orderNo")} placeholder="CO-YYYYMMDD-NNN"
              value={form.orderNo} onChange={(e) => setField("orderNo", e.target.value)} fullWidth />
            <Select label={t("shipping.customerPo.customer")} options={customerOptions}
              value={form.customerCode} onChange={(v) => setField("customerCode", v)} fullWidth />
            <Input label={t("shipping.customerPo.orderDate")} type="date"
              value={form.orderDate} onChange={(e) => setField("orderDate", e.target.value)} fullWidth />
            <Input label={t("shipping.customerPo.dueDate")} type="date"
              value={form.dueDate} onChange={(e) => setField("dueDate", e.target.value)} fullWidth />
          </div>
        </div>

        {/* 품목 검색 */}
        <div>
          <h3 className="text-xs font-semibold text-text-muted mb-2">{t("shipping.customerPo.searchPart")}</h3>
          <div className="flex gap-2">
            <Input
              placeholder={t("shipping.customerPo.searchPartPlaceholder")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              leftIcon={<Search className="w-4 h-4" />}
              fullWidth
            />
            <Button variant="secondary" size="sm" onClick={handleSearch}>{t("common.search")}</Button>
          </div>

          {searchResults.length > 0 && (
            <div className="border border-border rounded-lg overflow-hidden mt-2">
              <div className="bg-background px-3 py-1.5 text-[10px] font-medium text-text-muted">
                {t("shipping.customerPo.searchResultCount", { count: searchResults.length })}
              </div>
              <div className="max-h-[120px] overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="bg-background/50">
                    <tr>
                      <th className="text-left px-2 py-1 text-text-muted font-medium">{t("common.partCode")}</th>
                      <th className="text-left px-2 py-1 text-text-muted font-medium">{t("common.partName")}</th>
                      <th className="text-center px-2 py-1 text-text-muted font-medium w-12">{t("common.unit")}</th>
                      <th className="w-8"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {searchResults.map((item) => {
                      const alreadyAdded = orderItems.some((r) => r.partCode === item.partCode);
                      return (
                        <tr key={item.partCode} className="border-t border-border hover:bg-background/30">
                          <td className="px-2 py-1 font-mono">{item.partCode}</td>
                          <td className="px-2 py-1">{item.partName}</td>
                          <td className="px-2 py-1 text-center text-text-muted">{item.unit}</td>
                          <td className="px-2 py-1 text-center">
                            <button
                              onClick={() => addItem(item)}
                              disabled={alreadyAdded}
                              className={`p-0.5 rounded ${alreadyAdded ? "text-text-muted opacity-50" : "text-primary hover:bg-primary/10"}`}
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* 발주 품목 목록 */}
        {orderItems.length > 0 && (
          <div>
            <div className="border border-border rounded-lg overflow-hidden">
              <div className="bg-primary/5 px-3 py-1.5 text-xs font-medium text-primary flex justify-between">
                <span>{t("shipping.customerPo.orderItemCount", { count: orderItems.length })}</span>
                <span>{t("shipping.customerPo.totalAmount")}: {totalAmount.toLocaleString()} KRW</span>
              </div>
              <table className="w-full text-xs">
                <thead className="bg-background/50">
                  <tr>
                    <th className="text-left px-2 py-1 text-text-muted font-medium w-6">#</th>
                    <th className="text-left px-2 py-1 text-text-muted font-medium">{t("common.partName")}</th>
                    <th className="text-center px-2 py-1 text-text-muted font-medium w-20">{t("shipping.customerPo.orderQty")}</th>
                    <th className="text-center px-2 py-1 text-text-muted font-medium w-24">{t("shipping.customerPo.unitPrice")}</th>
                    <th className="text-right px-2 py-1 text-text-muted font-medium w-24">{t("shipping.customerPo.amount")}</th>
                    <th className="w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {orderItems.map((item, idx) => (
                    <tr key={item.partCode} className="border-t border-border">
                      <td className="px-2 py-1 text-text-muted">{idx + 1}</td>
                      <td className="px-2 py-1">
                        <span className="font-medium">{item.partName}</span>
                        <span className="ml-1 text-[10px] text-text-muted">({item.partCode})</span>
                      </td>
                      <td className="px-2 py-1">
                        <input
                          type="number"
                          min={0}
                          value={item.orderQty || ""}
                          onChange={(e) => updateItem(item.partCode, "orderQty", Number(e.target.value))}
                          className="w-full px-1.5 py-0.5 text-xs border border-gray-400 dark:border-gray-500 rounded text-right bg-background text-text"
                          placeholder="0"
                        />
                      </td>
                      <td className="px-2 py-1">
                        <input
                          type="number"
                          min={0}
                          value={item.unitPrice || ""}
                          onChange={(e) => updateItem(item.partCode, "unitPrice", Number(e.target.value))}
                          className="w-full px-1.5 py-0.5 text-xs border border-gray-400 dark:border-gray-500 rounded text-right bg-background text-text"
                          placeholder="0"
                        />
                      </td>
                      <td className="px-2 py-1 text-right font-medium">{(item.orderQty * item.unitPrice).toLocaleString()}</td>
                      <td className="px-2 py-1 text-center">
                        <button onClick={() => removeItem(item.partCode)} className="p-0.5 text-red-400 hover:text-red-600 rounded">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 비고 */}
        <div>
          <Input label={t("common.remark")} placeholder={t("common.remarkPlaceholder")}
            value={form.remark} onChange={(e) => setField("remark", e.target.value)} fullWidth />
        </div>
      </div>

      {/* 푸터 */}
      <div className="px-5 py-3 border-t border-border flex gap-2 justify-end flex-shrink-0">
        <Button variant="secondary" onClick={onClose}>{t("common.cancel")}</Button>
        <Button onClick={handleSubmit} disabled={!canSubmit || saving}>
          {saving ? t("common.saving") : isEdit ? t("common.edit") : t("common.register")}
        </Button>
      </div>
    </div>
  );
}
