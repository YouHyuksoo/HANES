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
import { Card, CardContent, Button, Input, StatCard, Modal } from "@/components/ui";
import DataGrid from "@/components/data-grid/DataGrid";
import { ColumnDef } from "@tanstack/react-table";
import api from "@/services/api";
import { getTodayLocal } from "@/utils/date";
import DateRangeFilter from "@/components/shared/DateRangeFilter";

interface ProductReceiptTx {
  id: string;
  transNo: string;
  transType: string;
  transDate: string;
  itemCode: string;
  itemType: string | null;
  qty: number;
  status: string;
  refType?: string | null;
  cancelRefId: string | null;
  remark: string | null;
  orderNo: string | null;
  part?: { itemCode: string; itemName: string; unit: string } | null;
  toWarehouse?: { warehouseName: string } | null;
}

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

function isReceiptMovement(tx: ProductReceiptTx): boolean {
  return tx.transType === "WIP_IN" || tx.transType === "FG_IN" || tx.transType === "WIP_OUT";
}

function displayReceiptQty(tx: ProductReceiptTx): number {
  if (tx.transType === "WIP_OUT") return Math.abs(tx.qty);
  if (tx.transType === "WIP_OUT_CANCEL") return -Math.abs(tx.qty);
  return tx.qty;
}

const statusColors: Record<string, string> = {
  DONE: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
  CANCELED: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
};

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
      const [receiptRes, boxMoveRes] = await Promise.all([
        api.get("/inventory/product/transactions", {
          params: { ...params, transType: "WIP_IN,FG_IN,WIP_IN_CANCEL,FG_IN_CANCEL" },
        }),
        api.get("/inventory/product/transactions", {
          params: { ...params, transType: "WIP_OUT,WIP_OUT_CANCEL", refType: "BOX" },
        }),
      ]);
      setData(mergeReceiptTransactions(
        extractReceiptTransactions(receiptRes),
        extractReceiptTransactions(boxMoveRes),
      ));
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate]);

  useEffect(() => { fetchData(); }, [fetchData]);

  /** 통계 */
  const stats = useMemo(() => ({
    total: data.filter(isReceiptMovement).length,
    cancellable: data.filter(
      (d) => isReceiptMovement(d) && d.status !== "CANCELED" && !d.cancelRefId
    ).length,
    canceled: data.filter(
      (d) => d.status === "CANCELED" || d.transType.includes("CANCEL")
    ).length,
  }), [data]);

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

  const columns = useMemo<ColumnDef<ProductReceiptTx>[]>(() => [
    {
      id: "actions", header: "", size: 90,
      meta: { align: "center" as const, filterType: "none" as const },
      cell: ({ row }) => {
        const tx = row.original;
        if (tx.status === "CANCELED" || tx.cancelRefId || tx.transType.includes("CANCEL")) return null;
        return (
          <Button size="sm" variant="secondary" onClick={() => {
            setSelectedTx(tx);
            setReason("");
            setIsModalOpen(true);
          }}>
            <XCircle className="w-4 h-4 mr-1" />{t("productMgmt.receiptCancel.cancel")}
          </Button>
        );
      },
    },
    {
      accessorKey: "transDate", header: t("productMgmt.receiptCancel.transDate"), size: 100,
      meta: { filterType: "text" as const },
      cell: ({ getValue }) => String(getValue() ?? "").slice(0, 10),
    },
    {
      accessorKey: "transNo", header: t("productMgmt.receiptCancel.transNo"), size: 160,
      meta: { filterType: "text" as const },
      cell: ({ getValue }) => <span className="font-mono text-sm">{getValue() as string}</span>,
    },
    {
      accessorKey: "transType", header: t("productMgmt.receiptCancel.transType"), size: 100,
      cell: ({ getValue }) => {
        const v = getValue() as string;
        const isCancelType = v.includes("CANCEL");
        return (
          <span className={`px-2 py-0.5 rounded text-xs ${isCancelType ? "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300" : "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300"}`}>
            {v}
          </span>
        );
      },
    },
    {
      id: "partCode", header: t("common.partCode"), size: 120,
      meta: { filterType: "text" as const },
      cell: ({ row }) => <span className="font-mono text-sm">{row.original.part?.itemCode || "-"}</span>,
    },
    {
      id: "partName", header: t("common.partName"), size: 150,
      meta: { filterType: "text" as const },
      cell: ({ row }) => row.original.part?.itemName || "-",
    },
    {
      id: "warehouse", header: t("productMgmt.receiptCancel.warehouse"), size: 110,
      cell: ({ row }) => row.original.toWarehouse?.warehouseName || "-",
    },
    {
      accessorKey: "qty", header: t("productMgmt.receiptCancel.qty"), size: 100,
      meta: { align: "right" as const },
      cell: ({ row }) => {
        const q = displayReceiptQty(row.original);
        const color = q > 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400";
        return (
          <span className={`font-medium ${color}`}>
            {q > 0 ? "+" : ""}{q.toLocaleString()} {row.original.part?.unit || ""}
          </span>
        );
      },
    },
    {
      accessorKey: "status", header: t("common.status"), size: 80,
      cell: ({ getValue }) => {
        const s = getValue() as string;
        return <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusColors[s] || ""}`}>{s}</span>;
      },
    },
  ], [t]);

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

      {/* StatCards */}
      <div className="grid grid-cols-3 gap-3 flex-shrink-0">
        <StatCard label={t("productMgmt.receiptCancel.stats.total")} value={stats.total} icon={RotateCcw} color="blue" />
        <StatCard label={t("productMgmt.receiptCancel.stats.cancellable")} value={stats.cancellable} icon={XCircle} color="yellow" />
        <StatCard label={t("productMgmt.receiptCancel.stats.canceled")} value={stats.canceled} icon={RotateCcw} color="red" />
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
          sqlQuery={`SELECT *\nFROM PRODUCT_TRANSACTIONS\nWHERE COMPANY = '40'\n  AND PLANT_CD = '1000'\n  AND (\n    TRANS_TYPE IN ('WIP_IN', 'FG_IN', 'WIP_IN_CANCEL', 'FG_IN_CANCEL')\n    OR (REF_TYPE = 'BOX' AND TRANS_TYPE IN ('WIP_OUT', 'WIP_OUT_CANCEL'))\n  )\nORDER BY TRANS_DATE DESC`}/>
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
                    {displayReceiptQty(selectedTx).toLocaleString()} {selectedTx.part?.unit || ""}
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
