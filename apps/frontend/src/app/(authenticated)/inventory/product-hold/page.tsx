"use client";

/**
 * @file src/app/(authenticated)/inventory/product-hold/page.tsx
 * @description 제품재고홀드 페이지 - 제품 재고(WIP/FG)의 홀드/해제 관리
 *
 * 초보자 가이드:
 * 1. **홀드**: 품질 이슈 등으로 제품 재고 사용/출하 일시 중지
 * 2. **해제**: 이슈 해결 후 다시 출하 가능 상태로 변경
 * 3. API: GET /inventory/product-hold, POST /inventory/product-hold/hold, POST /inventory/product-hold/release
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  ShieldAlert, Search, RefreshCw, Lock, Unlock, AlertTriangle, CheckCircle,
} from "lucide-react";
import { Card, CardContent, Button, Input, Select, Modal, StatCard } from "@/components/ui";
import { ComCodeBadge } from "@/components/ui";
import DataGrid from "@/components/data-grid/DataGrid";
import { ColumnDef } from "@tanstack/react-table";
import api from "@/services/api";

interface ProductHoldStock {
  id: string;
  warehouseCode: string;
  itemCode: string;
  itemName: string;
  itemType: string;
  prdUid: string | null;
  qty: number;
  unit: string;
  status: string;
  holdReason: string | null;
  holdAt: string | null;
}

const statusColors: Record<string, string> = {
  HOLD: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
  NORMAL: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
};

export default function ProductHoldPage() {
  const { t } = useTranslation();

  const [data, setData] = useState<ProductHoldStock[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedStock, setSelectedStock] = useState<ProductHoldStock | null>(null);
  const [actionType, setActionType] = useState<"hold" | "release">("hold");
  const [reason, setReason] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { limit: "5000" };
      if (searchText) params.search = searchText;
      if (statusFilter) params.status = statusFilter;
      if (typeFilter) params.itemType = typeFilter;
      const res = await api.get("/inventory/product-hold", { params });
      setData(res.data?.data ?? []);
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [searchText, statusFilter, typeFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const statusOptions = useMemo(() => [
    { value: "", label: t("common.status") },
    { value: "HOLD", label: "HOLD" },
    { value: "NORMAL", label: "NORMAL" },
  ], [t]);

  const typeOptions = useMemo(() => [
    { value: "", label: t("productHold.partType") },
    { value: "WIP", label: "WIP" },
    { value: "FG", label: "FG" },
  ], [t]);

  const stats = useMemo(() => ({
    total: data.length,
    holdCount: data.filter(d => d.status === "HOLD").length,
    normalCount: data.filter(d => d.status === "NORMAL").length,
  }), [data]);

  const handleAction = useCallback(async () => {
    if (!selectedStock) return;
    setSaving(true);
    try {
      const url = actionType === "hold"
        ? "/inventory/product-hold/hold"
        : "/inventory/product-hold/release";
      await api.post(url, { stockId: selectedStock.id, reason });
      setIsModalOpen(false);
      setReason("");
      setSelectedStock(null);
      fetchData();
    } catch (e) {
      console.error("Product hold action failed:", e);
    } finally {
      setSaving(false);
    }
  }, [selectedStock, actionType, reason, fetchData]);

  const columns = useMemo<ColumnDef<ProductHoldStock>[]>(() => [
    {
      accessorKey: "itemCode", header: t("productHold.partCode"), size: 120,
      meta: { filterType: "text" as const },
      cell: ({ getValue }) => <span className="font-mono text-sm">{(getValue() as string) || "-"}</span>,
    },
    {
      accessorKey: "itemName", header: t("productHold.partName"), size: 160,
      meta: { filterType: "text" as const },
    },
    {
      accessorKey: "itemType", header: t("productHold.partType"), size: 80,
      meta: { filterType: "multi" as const },
      cell: ({ getValue }) => (
        <ComCodeBadge groupCode="PART_TYPE" code={getValue() as string} />
      ),
    },
    {
      accessorKey: "warehouseCode", header: t("productHold.warehouseCode"), size: 100,
      meta: { filterType: "text" as const },
    },
    {
      accessorKey: "prdUid", header: t("productHold.prdUid"), size: 130,
      meta: { filterType: "text" as const },
      cell: ({ getValue }) => (
        <span className="font-mono text-sm">{(getValue() as string) || "-"}</span>
      ),
    },
    {
      accessorKey: "qty", header: t("productHold.qty"), size: 100,
      meta: { filterType: "number" as const, align: "right" as const },
      cell: ({ row }) => (
        <span className="font-semibold">
          {row.original.qty?.toLocaleString()} {row.original.unit || ""}
        </span>
      ),
    },
    {
      accessorKey: "status", header: t("common.status"), size: 80,
      meta: { filterType: "multi" as const },
      cell: ({ getValue }) => {
        const s = getValue() as string;
        return (
          <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusColors[s] || ""}`}>
            {s}
          </span>
        );
      },
    },
    {
      accessorKey: "holdReason", header: t("productHold.holdReason"), size: 160,
      meta: { filterType: "text" as const },
      cell: ({ getValue }) => (
        <span className="text-sm text-text-muted">{(getValue() as string) || "-"}</span>
      ),
    },
    {
      id: "actions", header: "", size: 100,
      meta: { filterType: "none" as const },
      cell: ({ row }) => {
        const isHold = row.original.status === "HOLD";
        return (
          <Button size="sm" variant={isHold ? "secondary" : "primary"} onClick={() => {
            setSelectedStock(row.original);
            setActionType(isHold ? "release" : "hold");
            setReason("");
            setIsModalOpen(true);
          }}>
            {isHold
              ? <><Unlock className="w-4 h-4 mr-1" />{t("productHold.release")}</>
              : <><Lock className="w-4 h-4 mr-1" />{t("productHold.hold")}</>}
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
            <ShieldAlert className="w-7 h-7 text-primary" />
            {t("productHold.title")}
          </h1>
          <p className="text-text-muted mt-1">{t("productHold.subtitle")}</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <StatCard label={t("productHold.stats.total")} value={stats.total} icon={ShieldAlert} color="blue" />
        <StatCard label={t("productHold.stats.holdCount")} value={stats.holdCount} icon={AlertTriangle} color="red" />
        <StatCard label={t("productHold.stats.normalCount")} value={stats.normalCount} icon={CheckCircle} color="green" />
      </div>

      <Card><CardContent>
        <DataGrid
          data={data}
          columns={columns}
          isLoading={loading}
          enableColumnFilter
          enableExport
          exportFileName={t("productHold.title")}
          toolbarLeft={
            <div className="flex gap-3 flex-1 min-w-0">
              <div className="flex-1 min-w-0">
                <Input
                  placeholder={t("productHold.searchPlaceholder")}
                  value={searchText}
                  onChange={e => setSearchText(e.target.value)}
                  leftIcon={<Search className="w-4 h-4" />}
                  fullWidth
                />
              </div>
              <div className="w-28 flex-shrink-0">
                <Select options={typeOptions} value={typeFilter} onChange={setTypeFilter} fullWidth />
              </div>
              <div className="w-32 flex-shrink-0">
                <Select options={statusOptions} value={statusFilter} onChange={setStatusFilter} fullWidth />
              </div>
              <Button variant="secondary" onClick={fetchData}>
                <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              </Button>
            </div>
          }
        />
      </CardContent></Card>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={actionType === "hold" ? t("productHold.holdTitle") : t("productHold.releaseTitle")}
        size="lg"
      >
        {selectedStock && (
          <div className="space-y-4">
            <div className={`p-3 rounded-lg border text-sm ${
              actionType === "hold"
                ? "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800"
                : "bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800"
            }`}>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-text-muted">{t("productHold.partCode")}:</span>{" "}
                  <span className="font-mono font-medium">{selectedStock.itemCode}</span>
                </div>
                <div>
                  <span className="text-text-muted">{t("productHold.partName")}:</span>{" "}
                  {selectedStock.itemName}
                </div>
                <div>
                  <span className="text-text-muted">{t("productHold.partType")}:</span>{" "}
                  <ComCodeBadge groupCode="PART_TYPE" code={selectedStock.itemType} />
                </div>
                <div>
                  <span className="text-text-muted">{t("productHold.qty")}:</span>{" "}
                  <span className="font-medium">{selectedStock.qty?.toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-text-muted">{t("productHold.warehouseCode")}:</span>{" "}
                  {selectedStock.warehouseCode}
                </div>
                <div>
                  <span className="text-text-muted">{t("productHold.prdUid")}:</span>{" "}
                  <span className="font-mono">{selectedStock.prdUid || "-"}</span>
                </div>
              </div>
            </div>
            <Input
              label={t("productHold.reason")}
              placeholder={t("productHold.reasonPlaceholder")}
              value={reason}
              onChange={e => setReason(e.target.value)}
              fullWidth
            />
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="secondary" onClick={() => setIsModalOpen(false)}>
                {t("common.cancel")}
              </Button>
              <Button onClick={handleAction} disabled={saving}>
                {saving
                  ? t("common.saving")
                  : actionType === "hold"
                    ? t("productHold.hold")
                    : t("productHold.release")}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
