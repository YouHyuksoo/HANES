"use client";

/**
 * @file src/app/(authenticated)/product/receipt-cancel/page.tsx
 * @description 제품입고취소 페이지 - 제품 입고 트랜잭션 역분개 처리
 *
 * 초보자 가이드:
 * 1. PRODUCT_TRANSACTIONS에서 WIP_IN/FG_IN 입고와 박스 완제품 입고(WIP_OUT, REF_TYPE=BOX)를 취소 가능
 * 2. 취소 시 source='product'로 전달하여 ProductInventoryService로 라우팅
 * 3. 역분개: 원래 입고의 반대 트랜잭션 생성 + PRODUCT_STOCKS 재고 차감
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { RotateCcw, Search, RefreshCw, XCircle } from "lucide-react";
import { Card, CardContent, Button, Input, Modal } from "@/components/ui";
import DataGrid from "@/components/data-grid/DataGrid";
import api from "@/services/api";
import { getTodayLocal } from "@/utils/date";
import DateRangeFilter from "@/components/shared/DateRangeFilter";
import { createProductReceiptCancelGridColumns, type ProductReceiptTx } from "./productReceiptCancelColumns";

function extractReceiptTransactions(response: { data?: unknown }): ProductReceiptTx[] {
  const body = response.data as { data?: unknown } | ProductReceiptTx[] | undefined;
  const list = body && !Array.isArray(body) && "data" in body ? body.data : body;
  return Array.isArray(list) ? list as ProductReceiptTx[] : [];
}

function mergeReceiptTransactions(...groups: ProductReceiptTx[][]): ProductReceiptTx[] {
  const merged = new Map<string, ProductReceiptTx>();
  for (const row of groups.flat()) {
    merged.set(row.transNo || row.id, row);
  }
  return [...merged.values()].sort((a, b) => String(b.transDate).localeCompare(String(a.transDate)));
}

function displayReceiptQty(row: ProductReceiptTx): ProductReceiptTx {
  if (row.transType === "WIP_OUT") {
    return { ...row, qty: Math.abs(Number(row.qty) || 0) };
  }
  if (row.transType === "WIP_OUT_CANCEL") {
    return { ...row, qty: -Math.abs(Number(row.qty) || 0) };
  }
  return row;
}

export default function ProductReceiptCancelPage() {
  const { t } = useTranslation();

  const [data, setData] = useState<ProductReceiptTx[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [fromDate, setStartDate] = useState(() => getTodayLocal());
  const [toDate, setEndDate] = useState(() => getTodayLocal());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTx, setSelectedTx] = useState<ProductReceiptTx | null>(null);
  const [reason, setReason] = useState("");

  /** 제품 입고 이력 조회 */
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { limit: "5000" };
      if (fromDate) params.fromDate = fromDate;
      if (toDate) params.toDate = toDate;
      const receiptRes = await api.get("/inventory/product/transactions", {
        params: { ...params, transType: "WIP_IN,FG_IN,WIP_IN_CANCEL,FG_IN_CANCEL" },
      });
      const boxRes = await api.get("/inventory/product/transactions", {
        params: { ...params, transType: "WIP_OUT,WIP_OUT_CANCEL", refType: "BOX" },
      });
      setData(mergeReceiptTransactions(
        extractReceiptTransactions(receiptRes),
        extractReceiptTransactions(boxRes).map(displayReceiptQty),
      ));
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate]);

  useEffect(() => { fetchData(); }, [fetchData]);

  /** 취소 처리 */
  const handleCancel = useCallback(async () => {
    if (!selectedTx || !reason) return;
    setSaving(true);
    try {
      await api.post("/inventory/cancel", {
        transactionId: selectedTx.id,
        remark: reason,
        source: "product",
      });
      setIsModalOpen(false);
      setReason("");
      setSelectedTx(null);
      fetchData();
    } catch (e) {
      console.error("Cancel failed:", e);
    } finally {
      setSaving(false);
    }
  }, [selectedTx, reason, fetchData]);

  const columns = useMemo(() => createProductReceiptCancelGridColumns({
    t,
    setSelectedTx,
    setReason,
    setIsModalOpen,
  }), [t]);

  return (
    <div className="h-full flex flex-col overflow-hidden p-6 gap-4 animate-fade-in">
      {/* 헤더 */}
      <div className="flex justify-between items-center flex-shrink-0">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2">
            <RotateCcw className="w-7 h-7 text-primary" />
            {t("productMgmt.receiptCancel.title")}
          </h1>
          <p className="text-text-muted mt-1">{t("productMgmt.receiptCancel.subtitle")}</p>
        </div>
        <Button variant="secondary" size="sm" onClick={fetchData}>
          <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} />{t("common.refresh")}
        </Button>
      </div>

      {/* DataGrid */}
      <Card className="flex-1 min-h-0 overflow-hidden" padding="none"><CardContent className="h-full p-4">
        <DataGrid data={data} columns={columns} isLoading={loading} enableColumnFilter enableExport
          exportFileName={t("productMgmt.receiptCancel.title")}
          toolbarLeft={
            <div className="flex gap-3 flex-1 min-w-0">
              <div className="flex-1 min-w-0">
                <Input placeholder={t("productMgmt.receiptCancel.searchPlaceholder")}
                  value={searchText} onChange={(e) => setSearchText(e.target.value)}
                  leftIcon={<Search className="w-4 h-4" />} fullWidth />
              </div>
              <DateRangeFilter
                from={fromDate}
                to={toDate}
                onFromChange={setStartDate}
                onToChange={setEndDate}
                className="flex-shrink-0"
              />
            </div>
          } 
          sqlQuery={`SELECT *\nFROM PRODUCT_TRANSACTIONS\nWHERE COMPANY = '40'\n  AND PLANT_CD = '1000'\n  AND TRANS_TYPE IN ('WIP_IN', 'FG_IN', 'WIP_IN_CANCEL', 'FG_IN_CANCEL')\nORDER BY TRANS_DATE DESC`}/>
      </CardContent></Card>

      {/* 취소 모달 */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)}
        title={t("productMgmt.receiptCancel.cancelTitle")} size="lg">
        {selectedTx && (
          <div className="space-y-4">
            <div className="p-3 bg-red-50 dark:bg-red-950/30 rounded-lg border border-red-200 dark:border-red-800">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-text-muted">{t("productMgmt.receiptCancel.transNo")}:</span>{" "}
                  <span className="font-mono font-medium">{selectedTx.transNo}</span>
                </div>
                <div>
                  <span className="text-text-muted">{t("common.partCode")}:</span>{" "}
                  <span className="font-mono">{selectedTx.part?.itemCode}</span>
                </div>
                <div>
                  <span className="text-text-muted">{t("common.partName")}:</span>{" "}
                  {selectedTx.part?.itemName}
                </div>
                <div>
                  <span className="text-text-muted">{t("productMgmt.receiptCancel.qty")}:</span>{" "}
                  <span className="font-medium text-red-600 dark:text-red-400">
                    {selectedTx.qty.toLocaleString()} {selectedTx.part?.unit || ""}
                  </span>
                </div>
              </div>
            </div>
            <Input label={t("productMgmt.receiptCancel.reason")}
              placeholder={t("productMgmt.receiptCancel.reasonPlaceholder")}
              value={reason} onChange={(e) => setReason(e.target.value)} fullWidth />
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="secondary" onClick={() => setIsModalOpen(false)}>{t("common.cancel")}</Button>
              <Button onClick={handleCancel} disabled={saving || !reason}>
                {saving ? t("common.saving") : (
                  <><XCircle className="w-4 h-4 mr-1" />{t("productMgmt.receiptCancel.confirm")}</>
                )}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
