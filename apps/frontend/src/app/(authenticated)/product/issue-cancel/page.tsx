"use client";

/**
 * @file src/app/(authenticated)/product/issue-cancel/page.tsx
 * @description 제품출고취소 페이지 - 제품 출고 트랜잭션 역분개 처리
 *
 * 초보자 가이드:
 * 1. PRODUCT_TRANSACTIONS에서 WIP_OUT/FG_OUT 유형의 DONE 상태만 취소 가능
 * 2. 취소 시 source='product'로 전달하여 ProductInventoryService로 라우팅
 * 3. 역분개: 원래 출고의 반대 트랜잭션 생성 + PRODUCT_STOCKS 재고 복구
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { RotateCcw, Search, RefreshCw, XCircle } from "lucide-react";
import { Card, CardContent, Button, Input, StatCard, Modal } from "@/components/ui";
import ComCodeBadge from "@/components/ui/ComCodeBadge";
import DataGrid from "@/components/data-grid/DataGrid";
import { ColumnDef } from "@tanstack/react-table";
import api from "@/services/api";

interface ProductIssueTx {
  id: string;
  transNo: string;
  transType: string;
  transDate: string;
  itemCode: string;
  itemType: string | null;
  qty: number;
  status: string;
  issueType: string | null;
  cancelRefId: string | null;
  remark: string | null;
  part?: { itemCode: string; itemName: string; unit: string } | null;
  fromWarehouse?: { warehouseName: string } | null;
}

const statusColors: Record<string, string> = {
  DONE: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
  CANCELED: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
};

export default function ProductIssueCancelPage() {
  const { t } = useTranslation();

  const [data, setData] = useState<ProductIssueTx[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTx, setSelectedTx] = useState<ProductIssueTx | null>(null);
  const [reason, setReason] = useState("");

  /** 제품 출고 이력 조회 */
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {
        transType: "WIP_OUT,FG_OUT,WIP_OUT_CANCEL,FG_OUT_CANCEL",
        limit: "5000",
      };
      if (startDate) params.dateFrom = startDate;
      if (endDate) params.dateTo = endDate;
      const res = await api.get("/inventory/product/transactions", { params });
      const list = res.data?.data ?? res.data;
      setData(Array.isArray(list) ? list : []);
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => { fetchData(); }, [fetchData]);

  /** 통계 */
  const stats = useMemo(() => ({
    total: data.filter((d) => d.transType === "WIP_OUT" || d.transType === "FG_OUT").length,
    cancellable: data.filter(
      (d) => (d.transType === "WIP_OUT" || d.transType === "FG_OUT") && d.status !== "CANCELED" && !d.cancelRefId,
    ).length,
    canceled: data.filter(
      (d) => d.status === "CANCELED" || d.transType.includes("CANCEL"),
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

  const columns = useMemo<ColumnDef<ProductIssueTx>[]>(() => [
    {
      accessorKey: "transDate", header: t("productMgmt.issueCancel.transDate"), size: 100,
      meta: { filterType: "text" as const },
      cell: ({ getValue }) => String(getValue() ?? "").slice(0, 10),
    },
    {
      accessorKey: "transNo", header: t("productMgmt.issueCancel.transNo"), size: 160,
      meta: { filterType: "text" as const },
      cell: ({ getValue }) => <span className="font-mono text-sm">{getValue() as string}</span>,
    },
    {
      accessorKey: "transType", header: t("productMgmt.issueCancel.transType"), size: 110,
      cell: ({ getValue }) => {
        const v = getValue() as string;
        const isCancelType = v.includes("CANCEL");
        return (
          <span className={`px-2 py-0.5 rounded text-xs ${isCancelType ? "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300" : "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300"}`}>
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
      id: "warehouse", header: t("productMgmt.issueCancel.warehouse"), size: 110,
      cell: ({ row }) => row.original.fromWarehouse?.warehouseName || "-",
    },
    {
      accessorKey: "issueType", header: t("productMgmt.issueCancel.issueType"), size: 110,
      cell: ({ getValue }) => {
        const v = getValue() as string | null;
        return v ? <ComCodeBadge groupCode="ISSUE_TYPE" code={v} /> : <span className="text-text-muted">-</span>;
      },
    },
    {
      accessorKey: "qty", header: t("productMgmt.issueCancel.qty"), size: 100,
      meta: { align: "right" as const },
      cell: ({ row }) => {
        const q = row.original.qty;
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
    {
      id: "actions", header: "", size: 90,
      cell: ({ row }) => {
        const tx = row.original;
        if (tx.status === "CANCELED" || tx.cancelRefId || tx.transType.includes("CANCEL")) return null;
        return (
          <Button size="sm" variant="secondary" onClick={() => {
            setSelectedTx(tx);
            setReason("");
            setIsModalOpen(true);
          }}>
            <XCircle className="w-4 h-4 mr-1" />{t("productMgmt.issueCancel.cancel")}
          </Button>
        );
      },
    },
  ], [t]);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* 헤더 */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2">
            <RotateCcw className="w-7 h-7 text-primary" />
            {t("productMgmt.issueCancel.title")}
          </h1>
          <p className="text-text-muted mt-1">{t("productMgmt.issueCancel.subtitle")}</p>
        </div>
      </div>

      {/* StatCards */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard label={t("productMgmt.issueCancel.stats.total")} value={stats.total} icon={RotateCcw} color="blue" />
        <StatCard label={t("productMgmt.issueCancel.stats.cancellable")} value={stats.cancellable} icon={XCircle} color="yellow" />
        <StatCard label={t("productMgmt.issueCancel.stats.canceled")} value={stats.canceled} icon={RotateCcw} color="red" />
      </div>

      {/* DataGrid */}
      <Card><CardContent>
        <DataGrid data={data} columns={columns} isLoading={loading} enableColumnFilter enableExport
          exportFileName={t("productMgmt.issueCancel.title")}
          toolbarLeft={
            <div className="flex gap-3 flex-1 min-w-0">
              <div className="flex-1 min-w-0">
                <Input placeholder={t("productMgmt.issueCancel.searchPlaceholder")}
                  value={searchText} onChange={(e) => setSearchText(e.target.value)}
                  leftIcon={<Search className="w-4 h-4" />} fullWidth />
              </div>
              <div className="w-36 flex-shrink-0">
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} fullWidth />
              </div>
              <div className="w-36 flex-shrink-0">
                <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} fullWidth />
              </div>
              <Button variant="secondary" onClick={fetchData}>
                <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              </Button>
            </div>
          } />
      </CardContent></Card>

      {/* 취소 모달 */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)}
        title={t("productMgmt.issueCancel.cancelTitle")} size="lg">
        {selectedTx && (
          <div className="space-y-4">
            <div className="p-3 bg-red-50 dark:bg-red-950/30 rounded-lg border border-red-200 dark:border-red-800">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-text-muted">{t("productMgmt.issueCancel.transNo")}:</span>{" "}
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
                  <span className="text-text-muted">{t("productMgmt.issueCancel.qty")}:</span>{" "}
                  <span className="font-medium text-red-600 dark:text-red-400">
                    {selectedTx.qty.toLocaleString()} {selectedTx.part?.unit || ""}
                  </span>
                </div>
                {selectedTx.issueType && (
                  <div>
                    <span className="text-text-muted">{t("productMgmt.issueCancel.issueType")}:</span>{" "}
                    <ComCodeBadge groupCode="ISSUE_TYPE" code={selectedTx.issueType} />
                  </div>
                )}
              </div>
            </div>
            <Input label={t("productMgmt.issueCancel.reason")}
              placeholder={t("productMgmt.issueCancel.reasonPlaceholder")}
              value={reason} onChange={(e) => setReason(e.target.value)} fullWidth />
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="secondary" onClick={() => setIsModalOpen(false)}>{t("common.cancel")}</Button>
              <Button onClick={handleCancel} disabled={saving || !reason}>
                {saving ? t("common.saving") : (
                  <><XCircle className="w-4 h-4 mr-1" />{t("productMgmt.issueCancel.confirm")}</>
                )}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
