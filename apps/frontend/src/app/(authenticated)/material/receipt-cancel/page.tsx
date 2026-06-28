"use client";

/**
 * @file src/app/(authenticated)/material/receipt-cancel/page.tsx
 * @description 입고취소 페이지 - 입고 트랜잭션 역분개 처리
 *
 * 초보자 가이드:
 * 1. **역분개**: 원래 입고의 반대 트랜잭션을 생성하여 입고 취소
 * 2. **취소 가능**: cancelRefId 없는 RECEIPT 유형만 취소 가능
 * 3. API: GET /material/receipt-cancel, POST /material/receipt-cancel
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { RotateCcw, Search, RefreshCw, XCircle } from "lucide-react";
import { Card, CardContent, Button, Input, Modal } from "@/components/ui";
import DateRangeFilter from "@/components/shared/DateRangeFilter";
import DataGrid from "@/components/data-grid/DataGrid";
import api from "@/services/api";
import { getTodayLocal } from "@/utils/date";
import { createReceiptCancelGridColumns, type ReceiptTransaction } from "./receiptCancelColumns";

export default function ReceiptCancelPage() {
  const { t } = useTranslation();

  const [data, setData] = useState<ReceiptTransaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [startDate, setStartDate] = useState(() => getTodayLocal());
  const [endDate, setEndDate] = useState(() => getTodayLocal());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTx, setSelectedTx] = useState<ReceiptTransaction | null>(null);
  const [reason, setReason] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { limit: "5000" };
      if (searchText) params.search = searchText;
      if (startDate) params.fromDate = startDate;
      if (endDate) params.toDate = endDate;
      const res = await api.get("/material/receipt-cancel", { params });
      setData(res.data?.data ?? []);
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [searchText, startDate, endDate]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleCancel = useCallback(async () => {
    if (!selectedTx || !reason) return;
    setSaving(true);
    try {
      await api.post("/material/receipt-cancel", {
        transactionId: selectedTx.id,
        reason,
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

  const columns = useMemo(() => createReceiptCancelGridColumns({
    t,
    setSelectedTx,
    setReason,
    setIsModalOpen,
  }), [t]);

  return (
    <div className="h-full flex flex-col overflow-hidden p-6 gap-3 animate-fade-in">
      <div className="flex justify-between items-center flex-shrink-0">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2">
            <RotateCcw className="w-7 h-7 text-primary" />
            {t("material.receiptCancel.title")}
          </h1>
          <p className="text-text-muted mt-1">{t("material.receiptCancel.subtitle")}</p>
        </div>
        <Button variant="secondary" size="sm" onClick={fetchData}>
          <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} />{t("common.refresh")}
        </Button>
      </div>

      <Card className="flex-1 min-h-0 overflow-hidden" padding="none"><CardContent className="h-full p-4">
        <DataGrid data={data} columns={columns} isLoading={loading} enableColumnFilter enableExport exportFileName={t("material.receiptCancel.title")}
          toolbarLeft={
            <div className="flex gap-3 flex-1 min-w-0">
              <div className="flex-1 min-w-0">
                <Input placeholder={t("material.receiptCancel.searchPlaceholder")}
                  value={searchText} onChange={e => setSearchText(e.target.value)}
                  leftIcon={<Search className="w-4 h-4" />} fullWidth />
              </div>
              <DateRangeFilter
                from={startDate}
                to={endDate}
                onFromChange={setStartDate}
                onToChange={setEndDate}
                className="flex-shrink-0"
              />
            </div>
          } 
          sqlQuery={`SELECT *\nFROM MAT_RECEIPT_CANCELS\nWHERE COMPANY = '40'\n  AND PLANT_CD = '1000'\nORDER BY CREATED_AT DESC`}/>
      </CardContent></Card>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)}
        title={t("material.receiptCancel.cancelTitle")} size="lg">
        {selectedTx && (
          <div className="space-y-4">
            <div className="p-3 bg-red-50 dark:bg-red-950/30 rounded-lg border border-red-200 dark:border-red-800">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-text-muted">{t("material.receiptCancel.transNo")}:</span> <span className="font-mono font-medium">{selectedTx.transNo}</span></div>
                <div><span className="text-text-muted">{t("common.partCode")}:</span> <span className="font-mono">{selectedTx.itemCode}</span></div>
                <div><span className="text-text-muted">{t("common.partName")}:</span> {selectedTx.itemName}</div>
                <div><span className="text-text-muted">{t("material.receiptCancel.qty")}:</span> <span className="font-medium text-red-600 dark:text-red-400">{selectedTx.qty.toLocaleString()} {selectedTx.unit || ""}</span></div>
              </div>
            </div>
            <Input label={t("material.receiptCancel.reason")} placeholder={t("material.receiptCancel.reasonPlaceholder")}
              value={reason} onChange={e => setReason(e.target.value)} fullWidth />
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="secondary" onClick={() => setIsModalOpen(false)}>{t("common.cancel")}</Button>
              <Button onClick={handleCancel} disabled={saving || !reason}>
                {saving ? t("common.saving") : <><XCircle className="w-4 h-4 mr-1" />{t("material.receiptCancel.confirm")}</>}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
