"use client";

/**
 * @file shipping/customer-po/components/CustomerPoModal.tsx
 * @description 고객발주 등록/수정 모달 - 품목 검색 + 장바구니 패턴
 *
 * 초보자 가이드:
 * 1. **기본 정보**: 수주번호, 고객사, 수주일, 납기일 입력
 * 2. **품목 검색**: 품목코드/품목명으로 검색하여 [+]로 추가
 * 3. **품목 목록**: 추가된 품목별 수주수량, 단가 입력
 */
import { useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Search, Plus, X } from "lucide-react";
import { Modal, Button, Input, Select } from "@/components/ui";
import { usePartnerOptions } from "@/hooks/useMasterOptions";

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

/** Mock 품목 데이터 - 추후 API 연동 */
const mockParts: PartItem[] = [
  { partCode: "WIRE-001", partName: "AWG18 적색 전선", unit: "M" },
  { partCode: "WIRE-002", partName: "AWG16 흑색 전선", unit: "M" },
  { partCode: "TERM-001", partName: "단자 110형", unit: "EA" },
  { partCode: "TERM-002", partName: "단자 250형", unit: "EA" },
  { partCode: "CONN-001", partName: "커넥터 6핀", unit: "EA" },
  { partCode: "CONN-002", partName: "커넥터 12핀", unit: "EA" },
  { partCode: "HARNESS-001", partName: "엔진룸 와이어링 하네스", unit: "SET" },
  { partCode: "HARNESS-002", partName: "도어 와이어링 하네스", unit: "SET" },
  { partCode: "TAPE-001", partName: "하네스 테이프 19mm", unit: "ROLL" },
  { partCode: "TUBE-001", partName: "코루게이트 튜브 10mm", unit: "M" },
];

interface CustomerPoModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingItem: CustomerOrder | null;
}

export default function CustomerPoModal({ isOpen, onClose, editingItem }: CustomerPoModalProps) {
  const { t } = useTranslation();
  const { options: customerOptions } = usePartnerOptions("CUSTOMER");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<PartItem[]>([]);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);

  const handleSearch = useCallback(() => {
    if (!searchQuery.trim()) { setSearchResults([]); return; }
    const q = searchQuery.toLowerCase();
    setSearchResults(
      mockParts.filter((p) => p.partCode.toLowerCase().includes(q) || p.partName.toLowerCase().includes(q))
    );
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
      prev.map((r) => (r.partCode === partCode ? { ...r, [field]: value } : r))
    );
  };

  const handleSubmit = () => {
    const totalAmount = orderItems.reduce((sum, r) => sum + r.orderQty * r.unitPrice, 0);
    console.log("고객발주 등록:", { items: orderItems, totalAmount });
    handleClose();
  };

  const handleClose = () => {
    setSearchQuery("");
    setSearchResults([]);
    setOrderItems([]);
    onClose();
  };

  const canSubmit = orderItems.length > 0 && orderItems.every((r) => r.orderQty > 0);
  const totalAmount = orderItems.reduce((sum, r) => sum + r.orderQty * r.unitPrice, 0);

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={editingItem ? t("shipping.customerPo.editTitle") : t("shipping.customerPo.addTitle")} size="lg">
      <div className="space-y-4">
        {/* 기본 정보 */}
        <div className="grid grid-cols-2 gap-4">
          <Input label={t("shipping.customerPo.orderNo")} placeholder="CO-YYYYMMDD-NNN" defaultValue={editingItem?.orderNo} fullWidth />
          <Select label={t("shipping.customerPo.customer")} options={customerOptions} value={editingItem?.customerName ?? ""} onChange={() => {}} fullWidth />
          <Input label={t("shipping.customerPo.orderDate")} type="date" defaultValue={editingItem?.orderDate || new Date().toISOString().split("T")[0]} fullWidth />
          <Input label={t("shipping.customerPo.dueDate")} type="date" defaultValue={editingItem?.dueDate} fullWidth />
        </div>

        {/* 품목 검색 */}
        <div>
          <label className="block text-sm font-medium text-text mb-1">{t("shipping.customerPo.searchPart")}</label>
          <div className="flex gap-2">
            <Input
              placeholder={t("shipping.customerPo.searchPartPlaceholder")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              leftIcon={<Search className="w-4 h-4" />}
              fullWidth
            />
            <Button variant="secondary" onClick={handleSearch}>{t("common.search")}</Button>
          </div>
        </div>

        {/* 검색 결과 */}
        {searchResults.length > 0 && (
          <div className="border border-border rounded-lg overflow-hidden">
            <div className="bg-background px-3 py-2 text-xs font-medium text-text-muted">
              {t("shipping.customerPo.searchResultCount", { count: searchResults.length })}
            </div>
            <div className="max-h-[140px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-background/50">
                  <tr>
                    <th className="text-left px-3 py-1.5 text-text-muted font-medium">{t("common.partCode")}</th>
                    <th className="text-left px-3 py-1.5 text-text-muted font-medium">{t("common.partName")}</th>
                    <th className="text-center px-3 py-1.5 text-text-muted font-medium">{t("common.unit")}</th>
                    <th className="text-center px-3 py-1.5 w-12"></th>
                  </tr>
                </thead>
                <tbody>
                  {searchResults.map((item) => {
                    const alreadyAdded = orderItems.some((r) => r.partCode === item.partCode);
                    return (
                      <tr key={item.partCode} className="border-t border-border hover:bg-background/30">
                        <td className="px-3 py-1.5 font-mono text-xs">{item.partCode}</td>
                        <td className="px-3 py-1.5">{item.partName}</td>
                        <td className="px-3 py-1.5 text-center text-text-muted">{item.unit}</td>
                        <td className="px-3 py-1.5 text-center">
                          <button
                            onClick={() => addItem(item)}
                            disabled={alreadyAdded}
                            className={`p-1 rounded ${alreadyAdded ? "text-text-muted opacity-50" : "text-primary hover:bg-primary/10"}`}
                          >
                            <Plus className="w-4 h-4" />
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

        {/* 발주 품목 목록 */}
        {orderItems.length > 0 && (
          <div className="border border-border rounded-lg overflow-hidden">
            <div className="bg-primary/5 px-3 py-2 text-xs font-medium text-primary flex justify-between">
              <span>{t("shipping.customerPo.orderItemCount", { count: orderItems.length })}</span>
              <span>{t("shipping.customerPo.totalAmount")}: {totalAmount.toLocaleString()} KRW</span>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-background/50">
                <tr>
                  <th className="text-left px-3 py-1.5 text-text-muted font-medium w-8">#</th>
                  <th className="text-left px-3 py-1.5 text-text-muted font-medium">{t("common.partName")}</th>
                  <th className="text-center px-3 py-1.5 text-text-muted font-medium w-24">{t("shipping.customerPo.orderQty")}</th>
                  <th className="text-center px-3 py-1.5 text-text-muted font-medium w-28">{t("shipping.customerPo.unitPrice")}</th>
                  <th className="text-right px-3 py-1.5 text-text-muted font-medium w-28">{t("shipping.customerPo.amount")}</th>
                  <th className="text-center px-3 py-1.5 w-10"></th>
                </tr>
              </thead>
              <tbody>
                {orderItems.map((item, idx) => (
                  <tr key={item.partCode} className="border-t border-border">
                    <td className="px-3 py-1.5 text-text-muted">{idx + 1}</td>
                    <td className="px-3 py-1.5">
                      <span>{item.partName}</span>
                      <span className="ml-1 text-xs text-text-muted">({item.partCode})</span>
                    </td>
                    <td className="px-3 py-1.5">
                      <input
                        type="number"
                        min={0}
                        value={item.orderQty || ""}
                        onChange={(e) => updateItem(item.partCode, "orderQty", Number(e.target.value))}
                        className="w-full px-2 py-1 text-sm border border-border rounded text-right bg-surface text-text"
                        placeholder="0"
                      />
                    </td>
                    <td className="px-3 py-1.5">
                      <input
                        type="number"
                        min={0}
                        value={item.unitPrice || ""}
                        onChange={(e) => updateItem(item.partCode, "unitPrice", Number(e.target.value))}
                        className="w-full px-2 py-1 text-sm border border-border rounded text-right bg-surface text-text"
                        placeholder="0"
                      />
                    </td>
                    <td className="px-3 py-1.5 text-right font-medium">{(item.orderQty * item.unitPrice).toLocaleString()}</td>
                    <td className="px-3 py-1.5 text-center">
                      <button onClick={() => removeItem(item.partCode)} className="p-1 text-red-400 hover:text-red-600 rounded">
                        <X className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* 비고 */}
        <Input label={t("common.remark")} placeholder={t("common.remarkPlaceholder")} fullWidth />

        {/* 버튼 */}
        <div className="flex justify-end gap-2 pt-4 border-t border-border">
          <Button variant="secondary" onClick={handleClose}>{t("common.cancel")}</Button>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            {editingItem ? t("common.edit") : t("common.register")}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
