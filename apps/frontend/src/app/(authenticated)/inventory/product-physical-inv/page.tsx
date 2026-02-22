"use client";

/**
 * @file src/app/(authenticated)/inventory/product-physical-inv/page.tsx
 * @description 제품 재고실사 페이지 - Stock 대사 후 실사수량 반영
 *
 * 초보자 가이드:
 * 1. 창고/검색 필터로 Stock 목록 조회
 * 2. 각 행에 실사수량(countedQty) 입력
 * 3. [실사반영] 버튼 → POST /inventory/product-physical-inv
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  ClipboardList, Search, RefreshCw, CheckSquare, AlertTriangle, CheckCircle,
} from "lucide-react";
import { Card, CardContent, Button, Input, Select, StatCard, Modal } from "@/components/ui";
import DataGrid from "@/components/data-grid/DataGrid";
import { ColumnDef } from "@tanstack/react-table";
import { useWarehouseOptions } from "@/hooks/useMasterOptions";
import api from "@/services/api";

interface StockForCount {
  id: string;
  warehouseId: string;
  warehouseName?: string;
  partId: string;
  partCode?: string;
  partName?: string;
  partType?: string;
  lotId?: string;
  lotNo?: string;
  qty: number;
  unit?: string;
  lastCountAt?: string;
  countedQty: number | null;
}

export default function ProductPhysicalInvPage() {
  const { t } = useTranslation();
  const { options: warehouseOpts } = useWarehouseOptions();

  const [data, setData] = useState<StockForCount[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [warehouseFilter, setWarehouseFilter] = useState("");
  const [showConfirm, setShowConfirm] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { limit: "5000" };
      if (searchText) params.search = searchText;
      if (warehouseFilter) params.warehouseId = warehouseFilter;
      const res = await api.get("/inventory/product-physical-inv", { params });
      const rows = (res.data?.data ?? []).map((s: any) => ({ ...s, countedQty: null }));
      setData(rows);
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [searchText, warehouseFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const warehouseOptions = useMemo(() => [
    { value: "", label: t("common.all") }, ...warehouseOpts,
  ], [t, warehouseOpts]);

  const updateCountedQty = useCallback((id: string, value: number | null) => {
    setData(prev => prev.map(row => row.id === id ? { ...row, countedQty: value } : row));
  }, []);

  const countedItems = useMemo(() => data.filter(d => d.countedQty !== null), [data]);
  const mismatchItems = useMemo(() => countedItems.filter(d => d.countedQty !== d.qty), [countedItems]);

  const stats = useMemo(() => ({
    total: data.length,
    counted: countedItems.length,
    mismatch: mismatchItems.length,
    matched: countedItems.filter(d => d.countedQty === d.qty).length,
  }), [data, countedItems, mismatchItems]);

  const handleApply = useCallback(async () => {
    if (countedItems.length === 0) return;
    setSaving(true);
    try {
      await api.post("/inventory/product-physical-inv", {
        items: countedItems.map(item => ({
          stockId: item.id,
          countedQty: item.countedQty!,
          remark: "제품재고실사",
        })),
      });
      setShowConfirm(false);
      fetchData();
    } catch (e) {
      console.error("Apply failed:", e);
    } finally {
      setSaving(false);
    }
  }, [countedItems, fetchData]);

  const columns = useMemo<ColumnDef<StockForCount>[]>(() => [
    {
      accessorKey: "warehouseName", header: t("inventory.productPhysicalInv.warehouse"), size: 110,
      meta: { filterType: "text" as const },
    },
    {
      accessorKey: "partCode", header: t("common.partCode"), size: 110,
      meta: { filterType: "text" as const },
      cell: ({ getValue }) => <span className="font-mono text-sm">{(getValue() as string) || "-"}</span>,
    },
    {
      accessorKey: "partName", header: t("common.partName"), size: 140,
      meta: { filterType: "text" as const },
    },
    {
      accessorKey: "lotNo", header: "LOT No.", size: 150,
      meta: { filterType: "text" as const },
      cell: ({ getValue }) => <span className="font-mono text-xs">{(getValue() as string) || "-"}</span>,
    },
    {
      accessorKey: "qty", header: t("inventory.productPhysicalInv.systemQty"), size: 100,
      cell: ({ row }) => <span>{row.original.qty.toLocaleString()} {row.original.unit || ""}</span>,
      meta: { align: "right" as const },
    },
    {
      id: "countedQty", header: t("inventory.productPhysicalInv.countedQty"), size: 120,
      meta: { filterType: "none" as const },
      cell: ({ row }) => (
        <input
          type="number"
          className="w-full px-2 py-1 text-sm border border-border rounded bg-surface text-text text-right focus:outline-none focus:ring-1 focus:ring-primary"
          value={row.original.countedQty ?? ""}
          placeholder="-"
          onChange={(e) => {
            const v = e.target.value;
            updateCountedQty(row.original.id, v === "" ? null : Number(v));
          }}
        />
      ),
    },
    {
      id: "diffQty", header: t("inventory.productPhysicalInv.diffQty"), size: 90,
      cell: ({ row }) => {
        const { qty, countedQty } = row.original;
        if (countedQty === null) return <span className="text-text-muted">-</span>;
        const diff = countedQty - qty;
        if (diff === 0) return <span className="text-green-600 dark:text-green-400">0</span>;
        const cls = diff > 0
          ? "text-blue-600 dark:text-blue-400 font-medium"
          : "text-red-600 dark:text-red-400 font-medium";
        return <span className={cls}>{diff > 0 ? "+" : ""}{diff.toLocaleString()}</span>;
      },
      meta: { align: "right" as const },
    },
    {
      accessorKey: "lastCountAt", header: t("inventory.productPhysicalInv.lastCountDate"), size: 110,
      cell: ({ getValue }) => {
        const v = getValue() as string;
        return v ? new Date(v).toLocaleDateString() : <span className="text-text-muted">-</span>;
      },
    },
  ], [t, updateCountedQty]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2">
            <ClipboardList className="w-7 h-7 text-primary" />
            {t("inventory.productPhysicalInv.title")}
          </h1>
          <p className="text-text-muted mt-1">{t("inventory.productPhysicalInv.subtitle")}</p>
        </div>
        <Button size="sm" onClick={() => setShowConfirm(true)} disabled={countedItems.length === 0}>
          <CheckSquare className="w-4 h-4 mr-1" />
          {t("inventory.productPhysicalInv.applyCount")} ({countedItems.length})
        </Button>
      </div>

      <div className="grid grid-cols-4 gap-3">
        <StatCard label={t("inventory.productPhysicalInv.stats.total")} value={stats.total} icon={ClipboardList} color="blue" />
        <StatCard label={t("inventory.productPhysicalInv.stats.counted")} value={stats.counted} icon={CheckSquare} color="purple" />
        <StatCard label={t("inventory.productPhysicalInv.stats.mismatch")} value={stats.mismatch} icon={AlertTriangle} color="red" />
        <StatCard label={t("inventory.productPhysicalInv.stats.matched")} value={stats.matched} icon={CheckCircle} color="green" />
      </div>

      <Card><CardContent>
        <DataGrid data={data} columns={columns} isLoading={loading} enableColumnFilter enableExport exportFileName={t("inventory.productPhysicalInv.title")}
          toolbarLeft={
            <div className="flex gap-3 flex-1 min-w-0">
              <div className="flex-1 min-w-0">
                <Input placeholder={t("inventory.productPhysicalInv.searchPlaceholder")}
                  value={searchText} onChange={e => setSearchText(e.target.value)}
                  leftIcon={<Search className="w-4 h-4" />} fullWidth />
              </div>
              <div className="w-40 flex-shrink-0">
                <Select options={warehouseOptions} value={warehouseFilter} onChange={setWarehouseFilter} fullWidth />
              </div>
              <Button variant="secondary" onClick={fetchData}>
                <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              </Button>
            </div>
          } />
      </CardContent></Card>

      <Modal isOpen={showConfirm} onClose={() => setShowConfirm(false)}
        title={t("inventory.productPhysicalInv.applyCount")} size="lg">
        <div className="space-y-4">
          <p className="text-text">{t("inventory.productPhysicalInv.confirmMessage", { count: countedItems.length })}</p>
          {mismatchItems.length > 0 && (
            <div className="bg-surface-alt dark:bg-surface rounded-lg p-4 space-y-2 max-h-60 overflow-y-auto">
              {mismatchItems.map(item => (
                <div key={item.id} className="flex justify-between text-sm border-b border-border pb-1">
                  <span className="text-text">{item.partCode} — {item.partName}</span>
                  <span className={
                    (item.countedQty! - item.qty) > 0
                      ? "text-blue-600 dark:text-blue-400 font-medium"
                      : "text-red-600 dark:text-red-400 font-medium"
                  }>
                    {item.qty} → {item.countedQty} ({(item.countedQty! - item.qty) > 0 ? "+" : ""}
                    {item.countedQty! - item.qty})
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 pt-6">
          <Button variant="secondary" onClick={() => setShowConfirm(false)}>{t("common.cancel")}</Button>
          <Button onClick={handleApply} disabled={saving}>
            {saving ? t("common.saving") : t("inventory.productPhysicalInv.applyCount")}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
