"use client";

/**
 * @file src/app/(authenticated)/material/lot-merge/page.tsx
 * @description 자재 LOT 병합 관리 페이지
 *
 * 초보자 가이드:
 * 1. 같은 품목의 LOT 2개 이상을 선택하여 하나로 병합
 * 2. 체크박스로 병합할 LOT 선택 → 병합 버튼 → 확인
 * 3. 대상 LOT에 수량 합산, 원본 LOT은 소진(DEPLETED) 처리
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Merge, Search, RefreshCw, CheckSquare, AlertCircle } from "lucide-react";
import { Card, CardContent, Button, Input, Select, Modal, StatCard } from "@/components/ui";
import DataGrid from "@/components/data-grid/DataGrid";
import { ColumnDef } from "@tanstack/react-table";
import api from "@/services/api";

interface MergeableLot {
  id: string;
  lotNo: string;
  itemCode: string;
  itemName?: string;
  unit?: string;
  currentQty: number;
  status: string;
  expireDate?: string;
  vendor?: string;
}

export default function LotMergePage() {
  const { t } = useTranslation();

  const [data, setData] = useState<MergeableLot[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [merging, setMerging] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { limit: "5000" };
      if (searchText) params.search = searchText;
      const res = await api.get("/material/lot-merge", { params });
      setData(res.data?.data ?? []);
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [searchText]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const selectedLots = useMemo(
    () => data.filter(d => selectedIds.has(d.id)),
    [data, selectedIds],
  );

  const canMerge = useMemo(() => {
    if (selectedLots.length < 2) return false;
    const partIds = new Set(selectedLots.map(l => l.itemCode));
    return partIds.size === 1;
  }, [selectedLots]);

  const totalMergeQty = useMemo(
    () => selectedLots.reduce((sum, l) => sum + l.currentQty, 0),
    [selectedLots],
  );

  const handleMerge = useCallback(async () => {
    if (!canMerge) return;
    setMerging(true);
    try {
      await api.post("/material/lot-merge", {
        sourceLotIds: Array.from(selectedIds),
      });
      setShowConfirm(false);
      setSelectedIds(new Set());
      fetchData();
    } catch (e) {
      console.error("Merge failed:", e);
    } finally {
      setMerging(false);
    }
  }, [canMerge, selectedIds, fetchData]);

  const partMismatch = useMemo(() => {
    if (selectedLots.length < 2) return false;
    const partIds = new Set(selectedLots.map(l => l.itemCode));
    return partIds.size > 1;
  }, [selectedLots]);

  const columns = useMemo<ColumnDef<MergeableLot>[]>(() => [
    {
      id: "select", header: "", size: 40,
      meta: { filterType: "none" as const },
      cell: ({ row }) => (
        <input type="checkbox" checked={selectedIds.has(row.original.id)}
          onChange={() => toggleSelect(row.original.id)}
          className="w-4 h-4 rounded border-border accent-primary" />
      ),
    },
    { accessorKey: "lotNo", header: t("material.lotMerge.lotNo"), size: 160,
      meta: { filterType: "text" as const },
    },
    { accessorKey: "itemCode", header: t("common.partCode"), size: 110,
      meta: { filterType: "text" as const },
    },
    { accessorKey: "itemName", header: t("common.partName"), size: 140,
      meta: { filterType: "text" as const },
    },
    { accessorKey: "currentQty", header: t("common.quantity"), size: 90,
      meta: { filterType: "number" as const },
      cell: ({ getValue, row }) => (
        <span className="font-semibold">{(getValue() as number).toLocaleString()} {row.original.unit || "EA"}</span>
      ),
    },
    { accessorKey: "vendor", header: t("material.lotMerge.vendor"), size: 100,
      meta: { filterType: "text" as const },
      cell: ({ getValue }) => getValue() || "-",
    },
    { accessorKey: "status", header: t("common.status"), size: 80, meta: { filterType: "multi" as const },
      cell: ({ getValue }) => {
        const v = getValue() as string;
        const color = v === "NORMAL"
          ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
          : "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400";
        return <span className={`px-2 py-0.5 text-xs rounded-full ${color}`}>{v}</span>;
      },
    },
    { accessorKey: "expireDate", header: t("material.lotMerge.expireDate"), size: 100,
      meta: { filterType: "date" as const },
      cell: ({ getValue }) => {
        const v = getValue() as string;
        return v ? new Date(v).toLocaleDateString() : "-";
      },
    },
  ], [t, selectedIds, toggleSelect]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2">
            <Merge className="w-7 h-7 text-primary" />
            {t("material.lotMerge.title")}
          </h1>
          <p className="text-text-muted mt-1">{t("material.lotMerge.subtitle")}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={fetchData}>
            <RefreshCw className="w-4 h-4 mr-1" />{t('common.refresh')}
          </Button>
          <Button size="sm" onClick={() => setShowConfirm(true)}
            disabled={!canMerge}>
            <CheckSquare className="w-4 h-4 mr-1" />
            {t("material.lotMerge.mergeSelected")} ({selectedLots.length})
          </Button>
        </div>
      </div>

      {/* 선택 상태 */}
      {selectedLots.length > 0 && (
        <div className="grid grid-cols-4 gap-4">
          <StatCard label={t("material.lotMerge.selectedCount")} value={selectedLots.length} icon={CheckSquare} color="blue" />
          <StatCard label={t("material.lotMerge.totalQty")} value={totalMergeQty.toLocaleString()} icon={Merge} color="purple" />
          <StatCard label={t("material.lotMerge.targetLot")} value={selectedLots[0]?.lotNo || "-"} icon={Merge} color="green" />
          <StatCard label={t("common.status")}
            value={partMismatch ? t("material.lotMerge.partMismatch") : t("material.lotMerge.ready")}
            icon={AlertCircle} color={partMismatch ? "red" : "green"} />
        </div>
      )}

      {partMismatch && (
        <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-300 text-sm">
          <AlertCircle className="w-4 h-4" />
          {t("material.lotMerge.partMismatchWarning")}
        </div>
      )}

      <Card><CardContent>
        <DataGrid
          data={data}
          columns={columns}
          isLoading={loading}
          enableColumnFilter
          enableExport
          exportFileName={t("material.lotMerge.title")}
          toolbarLeft={
            <div className="flex gap-2 items-center">
              <Input placeholder={t("material.lotMerge.searchPlaceholder")}
                value={searchText} onChange={(e) => setSearchText(e.target.value)}
                leftIcon={<Search className="w-4 h-4" />} />
              <Button variant="secondary" size="sm"
                onClick={() => setSelectedIds(new Set())}>
                {t("material.lotMerge.clearSelection")}
              </Button>
            </div>
          }
        />
      </CardContent></Card>

      {/* 병합 확인 모달 */}
      <Modal isOpen={showConfirm} onClose={() => setShowConfirm(false)}
        title={t("material.lotMerge.confirmTitle")} size="lg">
        <div className="space-y-4">
          <p className="text-text">{t("material.lotMerge.confirmMessage")}</p>
          <div className="bg-surface-alt dark:bg-surface rounded-lg p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-text-muted">{t("material.lotMerge.targetLot")}:</span>
              <span className="font-semibold text-text">{selectedLots[0]?.lotNo}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-text-muted">{t("material.lotMerge.mergingLots")}:</span>
              <span className="text-text">{selectedLots.slice(1).map(l => l.lotNo).join(", ")}</span>
            </div>
            <div className="flex justify-between text-sm border-t border-border pt-2">
              <span className="text-text-muted">{t("material.lotMerge.totalQty")}:</span>
              <span className="font-bold text-primary">{totalMergeQty.toLocaleString()} EA</span>
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-6">
          <Button variant="secondary" onClick={() => setShowConfirm(false)}>{t("common.cancel")}</Button>
          <Button onClick={handleMerge} disabled={merging}>
            {merging ? t("common.saving") : t("material.lotMerge.confirmMerge")}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
