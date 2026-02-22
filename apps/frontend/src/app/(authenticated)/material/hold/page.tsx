"use client";

/**
 * @file src/app/(authenticated)/material/hold/page.tsx
 * @description 재고홀드 페이지 - LOT 홀드/해제 관리
 *
 * 초보자 가이드:
 * 1. **홀드**: 품질 이슈 등으로 LOT 사용 일시 중지
 * 2. **해제**: 이슈 해결 후 다시 사용 가능 상태로 변경
 * 3. API: GET /material/hold, POST /material/hold/hold, POST /material/hold/release
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  ShieldAlert, Search, RefreshCw, Lock, Unlock, AlertTriangle, CheckCircle,
} from "lucide-react";
import { Card, CardContent, Button, Input, Select, Modal, StatCard } from "@/components/ui";
import DataGrid from "@/components/data-grid/DataGrid";
import { ColumnDef } from "@tanstack/react-table";
import api from "@/services/api";

interface HoldLot {
  id: string;
  lotNo: string;
  partCode: string;
  partName: string;
  currentQty: number;
  unit: string;
  status: string;
  vendor: string;
  warehouseName?: string;
}

const statusColors: Record<string, string> = {
  HOLD: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
  NORMAL: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
};

export default function HoldPage() {
  const { t } = useTranslation();

  const [data, setData] = useState<HoldLot[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedLot, setSelectedLot] = useState<HoldLot | null>(null);
  const [actionType, setActionType] = useState<"hold" | "release">("hold");
  const [reason, setReason] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { limit: "5000" };
      if (searchText) params.search = searchText;
      if (statusFilter) params.status = statusFilter;
      const res = await api.get("/material/hold", { params });
      setData(res.data?.data ?? []);
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [searchText, statusFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const statusOptions = useMemo(() => [
    { value: "", label: t("common.all") },
    { value: "HOLD", label: "HOLD" },
    { value: "NORMAL", label: "NORMAL" },
  ], [t]);

  const stats = useMemo(() => ({
    total: data.length,
    holdCount: data.filter(d => d.status === "HOLD").length,
    normalCount: data.filter(d => d.status === "NORMAL").length,
  }), [data]);

  const handleAction = useCallback(async () => {
    if (!selectedLot) return;
    setSaving(true);
    try {
      const url = actionType === "hold" ? "/material/hold/hold" : "/material/hold/release";
      await api.post(url, { lotId: selectedLot.id, reason });
      setIsModalOpen(false);
      setReason("");
      setSelectedLot(null);
      fetchData();
    } catch (e) {
      console.error("Hold action failed:", e);
    } finally {
      setSaving(false);
    }
  }, [selectedLot, actionType, reason, fetchData]);

  const columns = useMemo<ColumnDef<HoldLot>[]>(() => [
    {
      accessorKey: "lotNo", header: "LOT No.", size: 160,
      meta: { filterType: "text" as const },
      cell: ({ getValue }) => <span className="font-mono text-sm">{getValue() as string}</span>,
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
      accessorKey: "currentQty", header: t("material.hold.currentQty"), size: 120,
      meta: { align: "right" as const },
      cell: ({ row }) => (
        <span className="font-semibold">{row.original.currentQty.toLocaleString()} {row.original.unit || ""}</span>
      ),
    },
    {
      accessorKey: "vendor", header: t("material.hold.vendor"), size: 100,
      meta: { filterType: "text" as const },
    },
    {
      accessorKey: "status", header: t("common.status"), size: 80,
      cell: ({ getValue }) => {
        const s = getValue() as string;
        return <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusColors[s] || ""}`}>{s}</span>;
      },
    },
    {
      id: "actions", header: "", size: 100,
      cell: ({ row }) => {
        const isHold = row.original.status === "HOLD";
        return (
          <Button size="sm" variant={isHold ? "secondary" : "primary"} onClick={() => {
            setSelectedLot(row.original);
            setActionType(isHold ? "release" : "hold");
            setReason("");
            setIsModalOpen(true);
          }}>
            {isHold
              ? <><Unlock className="w-4 h-4 mr-1" />{t("material.hold.release")}</>
              : <><Lock className="w-4 h-4 mr-1" />{t("material.hold.hold")}</>}
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
            {t("material.hold.title")}
          </h1>
          <p className="text-text-muted mt-1">{t("material.hold.subtitle")}</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <StatCard label={t("material.hold.stats.total")} value={stats.total} icon={ShieldAlert} color="blue" />
        <StatCard label={t("material.hold.stats.holdCount")} value={stats.holdCount} icon={AlertTriangle} color="red" />
        <StatCard label={t("material.hold.stats.normalCount")} value={stats.normalCount} icon={CheckCircle} color="green" />
      </div>

      <Card><CardContent>
        <DataGrid data={data} columns={columns} isLoading={loading} enableColumnFilter enableExport exportFileName={t("material.hold.title")}
          toolbarLeft={
            <div className="flex gap-3 flex-1 min-w-0">
              <div className="flex-1 min-w-0">
                <Input placeholder={t("material.hold.searchPlaceholder")}
                  value={searchText} onChange={e => setSearchText(e.target.value)}
                  leftIcon={<Search className="w-4 h-4" />} fullWidth />
              </div>
              <div className="w-36 flex-shrink-0">
                <Select options={statusOptions}
                  value={statusFilter} onChange={setStatusFilter} fullWidth />
              </div>
              <Button variant="secondary" onClick={fetchData}>
                <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              </Button>
            </div>
          } />
      </CardContent></Card>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)}
        title={actionType === "hold" ? t("material.hold.holdTitle") : t("material.hold.releaseTitle")} size="lg">
        {selectedLot && (
          <div className="space-y-4">
            <div className={`p-3 rounded-lg border text-sm ${
              actionType === "hold"
                ? "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800"
                : "bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800"
            }`}>
              <div className="grid grid-cols-2 gap-3">
                <div><span className="text-text-muted">LOT:</span> <span className="font-mono font-medium">{selectedLot.lotNo}</span></div>
                <div><span className="text-text-muted">{t("common.partCode")}:</span> <span className="font-mono">{selectedLot.partCode}</span></div>
                <div><span className="text-text-muted">{t("common.partName")}:</span> {selectedLot.partName}</div>
                <div><span className="text-text-muted">{t("material.hold.currentQty")}:</span> <span className="font-medium">{selectedLot.currentQty.toLocaleString()}</span></div>
              </div>
            </div>
            <Input label={t("material.hold.reason")} placeholder={t("material.hold.reasonPlaceholder")}
              value={reason} onChange={e => setReason(e.target.value)} fullWidth />
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="secondary" onClick={() => setIsModalOpen(false)}>{t("common.cancel")}</Button>
              <Button onClick={handleAction} disabled={saving}>
                {saving ? t("common.saving") : actionType === "hold" ? t("material.hold.hold") : t("material.hold.release")}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
