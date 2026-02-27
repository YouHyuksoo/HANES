"use client";

/**
 * @file src/app/(authenticated)/material/lot/page.tsx
 * @description 자재 LOT관리 페이지 - 자재 LOT별 이력/상태 조회
 *
 * 초보자 가이드:
 * 1. **LOT**: 동일 조건으로 입하된 자재 묶음 단위
 * 2. **추적**: LOT번호로 입하→IQC→입고→출고 이력 추적 가능
 * 3. API: GET /material/lots
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Tag, Search, RefreshCw, Eye, Layers, CheckCircle, AlertCircle, MinusCircle } from "lucide-react";
import { Card, CardContent, Button, Input, Select, Modal, StatCard } from "@/components/ui";
import DataGrid from "@/components/data-grid/DataGrid";
import { ColumnDef } from "@tanstack/react-table";
import api from "@/services/api";

interface MatLotItem {
  id: string;
  matUid: string;
  itemCode?: string;
  itemName?: string;
  initQty: number;
  currentQty: number;
  unit?: string;
  vendor?: string;
  recvDate?: string;
  iqcStatus: string;
  status: string;
}

const getStatusColor = (status: string) => {
  const c: Record<string, string> = {
    NORMAL: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
    HOLD: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300",
    DEPLETED: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300",
  };
  return c[status] || "bg-gray-100 text-gray-800";
};

const getIqcColor = (status: string) => {
  const c: Record<string, string> = {
    PASS: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
    FAIL: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
    HOLD: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300",
    PENDING: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300",
  };
  return c[status] || "bg-gray-100 text-gray-800";
};

export default function MatLotPage() {
  const { t } = useTranslation();

  const [data, setData] = useState<MatLotItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [iqcFilter, setIqcFilter] = useState("");
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedLot, setSelectedLot] = useState<MatLotItem | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { limit: "5000" };
      if (searchText) params.matUid = searchText;
      if (statusFilter) params.status = statusFilter;
      if (iqcFilter) params.iqcStatus = iqcFilter;
      const res = await api.get("/material/lots", { params });
      setData(res.data?.data ?? []);
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [searchText, statusFilter, iqcFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const LOT_STATUS = useMemo(() => [
    { value: "", label: t("common.status") },
    { value: "NORMAL", label: t("material.lot.status.normal") },
    { value: "HOLD", label: t("material.lot.status.hold") },
    { value: "DEPLETED", label: t("material.lot.status.depleted") },
  ], [t]);

  const IQC_STATUS = useMemo(() => [
    { value: "", label: "IQC" },
    { value: "PASS", label: "PASS" },
    { value: "FAIL", label: "FAIL" },
    { value: "PENDING", label: "PENDING" },
  ], [t]);

  const stats = useMemo(() => ({
    total: data.length,
    normal: data.filter(l => l.status === "NORMAL").length,
    hold: data.filter(l => l.status === "HOLD").length,
    depleted: data.filter(l => l.status === "DEPLETED").length,
  }), [data]);

  const columns = useMemo<ColumnDef<MatLotItem>[]>(() => [
    {
      accessorKey: "matUid", header: t("material.lot.columns.matUid"), size: 160,
      meta: { filterType: "text" as const },
      cell: ({ getValue }) => <span className="font-mono text-sm">{getValue() as string}</span>,
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
      accessorKey: "vendor", header: t("material.lot.columns.vendor"), size: 100,
      meta: { filterType: "text" as const },
    },
    {
      accessorKey: "recvDate", header: t("material.lot.columns.recvDate"), size: 100,
      meta: { filterType: "date" as const },
      cell: ({ getValue }) => {
        const v = getValue() as string;
        return v ? new Date(v).toLocaleDateString() : "-";
      },
    },
    {
      accessorKey: "initQty", header: t("material.lot.columns.initQty"), size: 100,
      meta: { filterType: "number" as const, align: "right" as const },
      cell: ({ row }) => <span>{row.original.initQty.toLocaleString()} {row.original.unit || ""}</span>,
    },
    {
      accessorKey: "currentQty", header: t("material.lot.columns.currentQty"), size: 100,
      meta: { filterType: "number" as const, align: "right" as const },
      cell: ({ row }) => (
        <span className={row.original.currentQty <= 0 ? "text-text-muted" : "font-semibold"}>
          {row.original.currentQty.toLocaleString()} {row.original.unit || ""}
        </span>
      ),
    },
    {
      accessorKey: "iqcStatus", header: "IQC", size: 80, meta: { filterType: "multi" as const },
      cell: ({ getValue }) => {
        const s = getValue() as string;
        return <span className={`px-2 py-0.5 rounded text-xs font-medium ${getIqcColor(s)}`}>{s}</span>;
      },
    },
    {
      accessorKey: "status", header: t("common.status"), size: 80, meta: { filterType: "multi" as const },
      cell: ({ getValue }) => {
        const s = getValue() as string;
        return <span className={`px-2 py-0.5 rounded text-xs font-medium ${getStatusColor(s)}`}>{s}</span>;
      },
    },
    {
      id: "actions", header: "", size: 50, meta: { filterType: "none" as const },
      cell: ({ row }) => (
        <button className="p-1 hover:bg-surface rounded" title={t("common.detail")}
          onClick={() => { setSelectedLot(row.original); setDetailModalOpen(true); }}>
          <Eye className="w-4 h-4 text-primary" />
        </button>
      ),
    },
  ], [t]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2">
            <Tag className="w-7 h-7 text-primary" />{t("material.lot.title")}
          </h1>
          <p className="text-text-muted mt-1">{t("material.lot.description")}</p>
        </div>
        <Button variant="secondary" size="sm" onClick={fetchData}>
          <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} />{t("common.refresh")}
        </Button>
      </div>

      <div className="grid grid-cols-4 gap-3">
        <StatCard label={t("material.lot.stats.totalLot")} value={stats.total} icon={Layers} color="blue" />
        <StatCard label={t("material.lot.stats.normal")} value={stats.normal} icon={CheckCircle} color="green" />
        <StatCard label={t("material.lot.stats.hold")} value={stats.hold} icon={AlertCircle} color="yellow" />
        <StatCard label={t("material.lot.stats.depleted")} value={stats.depleted} icon={MinusCircle} color="gray" />
      </div>

      <Card><CardContent>
        <DataGrid data={data} columns={columns} isLoading={loading} enableColumnFilter
          enableExport exportFileName={t("material.lot.title")}
          toolbarLeft={
            <div className="flex gap-3 flex-1 min-w-0">
              <div className="flex-1 min-w-0">
                <Input placeholder={t("material.lot.searchPlaceholder")}
                  value={searchText} onChange={e => setSearchText(e.target.value)}
                  leftIcon={<Search className="w-4 h-4" />} fullWidth />
              </div>
              <div className="w-32 flex-shrink-0">
                <Select options={LOT_STATUS} value={statusFilter} onChange={setStatusFilter} fullWidth />
              </div>
              <div className="w-32 flex-shrink-0">
                <Select options={IQC_STATUS} value={iqcFilter} onChange={setIqcFilter} fullWidth />
              </div>
              <Button variant="secondary" onClick={fetchData}>
                <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              </Button>
            </div>
          } />
      </CardContent></Card>

      <Modal isOpen={detailModalOpen} onClose={() => setDetailModalOpen(false)}
        title={t("material.lot.detailTitle")} size="lg">
        {selectedLot && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="space-y-2">
                <div className="flex justify-between border-b border-border pb-2">
                  <span className="text-text-muted">{t("material.lot.columns.matUid")}</span>
                  <span className="font-mono font-medium">{selectedLot.matUid}</span>
                </div>
                <div className="flex justify-between border-b border-border pb-2">
                  <span className="text-text-muted">{t("common.partCode")}</span>
                  <span className="font-mono">{selectedLot.itemCode}</span>
                </div>
                <div className="flex justify-between border-b border-border pb-2">
                  <span className="text-text-muted">{t("common.partName")}</span>
                  <span>{selectedLot.itemName}</span>
                </div>
                <div className="flex justify-between border-b border-border pb-2">
                  <span className="text-text-muted">{t("material.lot.columns.vendor")}</span>
                  <span>{selectedLot.vendor || "-"}</span>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between border-b border-border pb-2">
                  <span className="text-text-muted">{t("material.lot.columns.recvDate")}</span>
                  <span>{selectedLot.recvDate ? new Date(selectedLot.recvDate).toLocaleDateString() : "-"}</span>
                </div>
                <div className="flex justify-between border-b border-border pb-2">
                  <span className="text-text-muted">{t("material.lot.columns.initQty")}</span>
                  <span>{selectedLot.initQty.toLocaleString()} {selectedLot.unit || ""}</span>
                </div>
                <div className="flex justify-between border-b border-border pb-2">
                  <span className="text-text-muted">{t("material.lot.columns.currentQty")}</span>
                  <span className="font-semibold">{selectedLot.currentQty.toLocaleString()} {selectedLot.unit || ""}</span>
                </div>
                <div className="flex justify-between border-b border-border pb-2">
                  <span className="text-text-muted">IQC</span>
                  <span className={`px-2 py-0.5 rounded text-xs ${getIqcColor(selectedLot.iqcStatus)}`}>{selectedLot.iqcStatus}</span>
                </div>
              </div>
            </div>
            <div className="flex justify-end pt-4">
              <Button variant="secondary" onClick={() => setDetailModalOpen(false)}>{t("common.close")}</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
