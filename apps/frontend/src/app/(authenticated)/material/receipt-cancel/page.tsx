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
import { Card, CardContent, Button, Input, StatCard, Modal } from "@/components/ui";
import DataGrid from "@/components/data-grid/DataGrid";
import { ColumnDef } from "@tanstack/react-table";
import api from "@/services/api";

interface ReceiptTransaction {
  id: string;
  transNo: string;
  transType: string;
  itemCode: string;
  itemName: string;
  lotNo: string;
  warehouseName: string;
  qty: number;
  unit: string;
  transDate: string;
  status: string;
  cancelRefId?: string;
}

const statusColors: Record<string, string> = {
  DONE: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
  CANCELED: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
};

export default function ReceiptCancelPage() {
  const { t } = useTranslation();

  const [data, setData] = useState<ReceiptTransaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState(() => new Date().toISOString().slice(0, 10));
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

  const stats = useMemo(() => ({
    total: data.length,
    cancellable: data.filter(d => !d.cancelRefId && d.status !== "CANCELED").length,
    canceled: data.filter(d => d.status === "CANCELED" || d.cancelRefId).length,
  }), [data]);

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

  const columns = useMemo<ColumnDef<ReceiptTransaction>[]>(() => [
    {
      accessorKey: "transDate", header: t("material.receiptCancel.transDate"), size: 100,
      meta: { filterType: "text" as const },
      cell: ({ getValue }) => String(getValue() ?? "").slice(0, 10),
    },
    {
      accessorKey: "transNo", header: t("material.receiptCancel.transNo"), size: 150,
      meta: { filterType: "text" as const },
      cell: ({ getValue }) => <span className="font-mono text-sm">{getValue() as string}</span>,
    },
    {
      accessorKey: "transType", header: t("material.receiptCancel.transType"), size: 90, meta: { filterType: "multi" as const },
      cell: ({ getValue }) => (
        <span className="px-2 py-0.5 rounded text-xs bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300">
          {getValue() as string}
        </span>
      ),
    },
    {
      accessorKey: "itemCode", header: t("common.partCode"), size: 110,
      meta: { filterType: "text" as const },
      cell: ({ getValue }) => <span className="font-mono text-sm">{(getValue() as string) || "-"}</span>,
    },
    {
      accessorKey: "itemName", header: t("common.partName"), size: 140,
      meta: { filterType: "text" as const },
    },
    {
      accessorKey: "lotNo", header: "LOT No.", size: 150,
      meta: { filterType: "text" as const },
      cell: ({ getValue }) => <span className="font-mono text-sm">{(getValue() as string) || "-"}</span>,
    },
    {
      accessorKey: "warehouseName", header: t("material.receiptCancel.warehouse"), size: 100,
      meta: { filterType: "text" as const },
    },
    {
      accessorKey: "qty", header: t("material.receiptCancel.qty"), size: 100,
      meta: { filterType: "number" as const, align: "right" as const },
      cell: ({ row }) => (
        <span className="font-medium text-green-600 dark:text-green-400">
          +{row.original.qty.toLocaleString()} {row.original.unit || ""}
        </span>
      ),
    },
    {
      accessorKey: "status", header: t("common.status"), size: 80, meta: { filterType: "multi" as const },
      cell: ({ getValue }) => {
        const s = getValue() as string;
        return <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusColors[s] || ""}`}>{s}</span>;
      },
    },
    {
      id: "actions", header: "", size: 90, meta: { filterType: "none" as const },
      cell: ({ row }) => {
        if (row.original.status === "CANCELED" || row.original.cancelRefId) return null;
        return (
          <Button size="sm" variant="secondary" onClick={() => {
            setSelectedTx(row.original);
            setReason("");
            setIsModalOpen(true);
          }}>
            <XCircle className="w-4 h-4 mr-1" />{t("material.receiptCancel.cancel")}
          </Button>
        );
      },
    },
  ], [t]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2">
            <RotateCcw className="w-7 h-7 text-primary" />
            {t("material.receiptCancel.title")}
          </h1>
          <p className="text-text-muted mt-1">{t("material.receiptCancel.subtitle")}</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <StatCard label={t("material.receiptCancel.stats.total")} value={stats.total} icon={RotateCcw} color="blue" />
        <StatCard label={t("material.receiptCancel.stats.cancellable")} value={stats.cancellable} icon={XCircle} color="yellow" />
        <StatCard label={t("material.receiptCancel.stats.canceled")} value={stats.canceled} icon={RotateCcw} color="red" />
      </div>

      <Card><CardContent>
        <DataGrid data={data} columns={columns} isLoading={loading} enableColumnFilter enableExport exportFileName={t("material.receiptCancel.title")}
          toolbarLeft={
            <div className="flex gap-3 flex-1 min-w-0">
              <div className="flex-1 min-w-0">
                <Input placeholder={t("material.receiptCancel.searchPlaceholder")}
                  value={searchText} onChange={e => setSearchText(e.target.value)}
                  leftIcon={<Search className="w-4 h-4" />} fullWidth />
              </div>
              <div className="w-36 flex-shrink-0">
                <Input type="date"
                  value={startDate} onChange={e => setStartDate(e.target.value)} fullWidth />
              </div>
              <div className="w-36 flex-shrink-0">
                <Input type="date"
                  value={endDate} onChange={e => setEndDate(e.target.value)} fullWidth />
              </div>
              <Button variant="secondary" onClick={fetchData}>
                <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              </Button>
            </div>
          } />
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
