"use client";

/**
 * @file src/app/(authenticated)/shipping/pack/page.tsx
 * @description 포장관리 페이지 - 박스 단위 포장 관리
 *
 * 초보자 가이드:
 * 1. **박스**: 완성된 제품을 담는 포장 단위
 * 2. **상태 흐름**: OPEN(생성) -> CLOSED(포장완료) -> SHIPPED(출하)
 * 3. **시리얼 추가**: 완성품 시리얼을 박스에 할당
 * 4. API: GET/POST/PUT /shipping/boxes
 */
import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  Package, Plus, Search, RefreshCw, XCircle, Lock,
  CheckCircle, Truck,
} from "lucide-react";
import { Card, CardContent, Button, Input, Modal, Select, StatCard } from "@/components/ui";
import { useComCodeOptions } from "@/hooks/useComCode";
import DataGrid from "@/components/data-grid/DataGrid";
import { ColumnDef } from "@tanstack/react-table";
import { BoxStatusBadge } from "@/components/shipping";
import type { BoxStatus } from "@/components/shipping";
import api from "@/services/api";

/** 박스 인터페이스 */
interface Box {
  id: string;
  boxNo: string;
  partCode: string;
  partName: string;
  quantity: number;
  status: BoxStatus;
  closedAt: string | null;
  createdAt: string;
  serials: string[];
}

export default function PackPage() {
  const { t } = useTranslation();
  const comCodeOptions = useComCodeOptions("BOX_STATUS");
  const statusOptions = useMemo(
    () => [{ value: "", label: t("common.allStatus") }, ...comCodeOptions],
    [t, comCodeOptions],
  );
  const [data, setData] = useState<Box[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [statusFilter, setStatusFilter] = useState("");
  const [searchText, setSearchText] = useState("");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isSerialModalOpen, setIsSerialModalOpen] = useState(false);
  const [selectedBox, setSelectedBox] = useState<Box | null>(null);
  const [createForm, setCreateForm] = useState({ partCode: "", quantity: "" });
  const [serialInput, setSerialInput] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { limit: "5000" };
      if (searchText) params.search = searchText;
      if (statusFilter) params.status = statusFilter;
      const res = await api.get("/shipping/boxes", { params });
      setData(res.data?.data ?? []);
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [searchText, statusFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const stats = useMemo(() => ({
    open: data.filter((b) => b.status === "OPEN").length,
    closed: data.filter((b) => b.status === "CLOSED").length,
    shipped: data.filter((b) => b.status === "SHIPPED").length,
    totalQty: data.reduce((sum, b) => sum + b.quantity, 0),
  }), [data]);

  const handleCreate = useCallback(async () => {
    setSaving(true);
    try {
      await api.post("/shipping/boxes", createForm);
      setIsCreateModalOpen(false);
      setCreateForm({ partCode: "", quantity: "" });
      fetchData();
    } catch (e) {
      console.error("Create failed:", e);
    } finally {
      setSaving(false);
    }
  }, [createForm, fetchData]);

  const handleAddSerial = useCallback(async () => {
    if (!serialInput.trim() || !selectedBox) return;
    try {
      await api.post(`/shipping/boxes/${selectedBox.id}/serials`, { serial: serialInput });
      setSerialInput("");
      fetchData();
    } catch (e) {
      console.error("Add serial failed:", e);
    }
  }, [serialInput, selectedBox, fetchData]);

  const handleCloseBox = useCallback(async (box: Box) => {
    try {
      await api.put(`/shipping/boxes/${box.id}`, { status: "CLOSED" });
      fetchData();
    } catch (e) {
      console.error("Close box failed:", e);
    }
  }, [fetchData]);

  const columns = useMemo<ColumnDef<Box>[]>(() => [
    { accessorKey: "boxNo", header: t("shipping.pack.boxNo"), size: 160, meta: { filterType: "text" as const } },
    { accessorKey: "partCode", header: t("common.partCode"), size: 100, meta: { filterType: "text" as const } },
    { accessorKey: "partName", header: t("common.partName"), size: 130, meta: { filterType: "text" as const } },
    { accessorKey: "quantity", header: t("common.quantity"), size: 80, cell: ({ getValue }) => <span className="font-medium">{(getValue() as number).toLocaleString()}</span> },
    { accessorKey: "status", header: t("common.status"), size: 100, cell: ({ getValue }) => <BoxStatusBadge status={getValue() as BoxStatus} /> },
    { accessorKey: "closedAt", header: t("shipping.pack.closedAt"), size: 140, cell: ({ getValue }) => getValue() || "-" },
    {
      id: "actions", header: t("common.actions"), size: 120,
      cell: ({ row }) => {
        const box = row.original;
        return (
          <div className="flex gap-1">
            <button className="p-1 hover:bg-surface rounded" title={t("shipping.pack.addSerial")} disabled={box.status !== "OPEN"} onClick={() => { setSelectedBox(box); setIsSerialModalOpen(true); }}>
              <Plus className={`w-4 h-4 ${box.status === "OPEN" ? "text-primary" : "text-text-muted opacity-50"}`} />
            </button>
            <button className="p-1 hover:bg-surface rounded" title={t("shipping.pack.closeBox")} disabled={box.status !== "OPEN"} onClick={() => handleCloseBox(box)}>
              <Lock className={`w-4 h-4 ${box.status === "OPEN" ? "text-primary" : "text-text-muted opacity-50"}`} />
            </button>
          </div>
        );
      },
    },
  ], [t, handleCloseBox]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2"><Package className="w-7 h-7 text-primary" />{t("shipping.pack.title")}</h1>
          <p className="text-text-muted mt-1">{t("shipping.pack.description")}</p>
        </div>
        <Button size="sm" onClick={() => setIsCreateModalOpen(true)}><Plus className="w-4 h-4 mr-1" /> {t("shipping.pack.createBox")}</Button>
      </div>

      <div className="grid grid-cols-4 gap-3">
        <StatCard label={t("shipping.pack.statOpen")} value={stats.open} icon={Package} color="blue" />
        <StatCard label={t("shipping.pack.statClosed")} value={stats.closed} icon={CheckCircle} color="green" />
        <StatCard label={t("shipping.pack.statShipped")} value={stats.shipped} icon={Truck} color="purple" />
        <StatCard label={t("shipping.pack.statTotalQty")} value={stats.totalQty} icon={Package} color="gray" />
      </div>

      <Card><CardContent>
        <DataGrid
          data={data}
          columns={columns}
          isLoading={loading}
          enableColumnFilter
          enableExport
          exportFileName={t("shipping.pack.title")}
          toolbarLeft={
            <div className="flex gap-3 flex-1 min-w-0">
              <div className="flex-1 min-w-0">
                <Input placeholder={t("shipping.pack.searchPlaceholder")} value={searchText} onChange={(e) => setSearchText(e.target.value)} leftIcon={<Search className="w-4 h-4" />} fullWidth />
              </div>
              <div className="w-36 flex-shrink-0">
                <Select options={statusOptions} value={statusFilter} onChange={setStatusFilter} fullWidth />
              </div>
              <Button variant="secondary" onClick={fetchData}>
                <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              </Button>
            </div>
          }
        />
      </CardContent></Card>

      <Modal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} title={t("shipping.pack.createBox")} size="lg">
        <div className="space-y-4">
          <Input label={t("common.partCode")} placeholder="H-001" value={createForm.partCode} onChange={(e) => setCreateForm((prev) => ({ ...prev, partCode: e.target.value }))} fullWidth />
          <Input label={t("common.quantity")} type="number" placeholder="0" value={createForm.quantity} onChange={(e) => setCreateForm((prev) => ({ ...prev, quantity: e.target.value }))} fullWidth />
          <div className="flex justify-end gap-2 pt-4 border-t border-border">
            <Button variant="secondary" onClick={() => setIsCreateModalOpen(false)}>{t("common.cancel")}</Button>
            <Button onClick={handleCreate} disabled={saving}>
              {saving ? t("common.saving") : t("common.create")}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={isSerialModalOpen} onClose={() => setIsSerialModalOpen(false)} title={t("shipping.pack.addSerial")} size="lg">
        <div className="space-y-4">
          {selectedBox && (
            <div className="p-3 bg-background rounded-lg">
              <p className="text-sm text-text-muted">{t("shipping.pack.box")}: <span className="font-medium text-text">{selectedBox.boxNo}</span></p>
              <p className="text-sm text-text-muted">{t("shipping.pack.currentQty")}: <span className="font-medium text-text">{selectedBox.serials?.length ?? 0}{t("common.count")}</span></p>
            </div>
          )}
          <div className="flex gap-2">
            <Input placeholder={t("shipping.pack.serialPlaceholder")} value={serialInput} onChange={(e) => setSerialInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleAddSerial()} fullWidth />
            <Button onClick={handleAddSerial}><Plus className="w-4 h-4" /></Button>
          </div>
          <div className="max-h-40 overflow-y-auto border border-border rounded-lg p-2">
            {selectedBox?.serials?.slice(0, 10).map((serial, idx) => (
              <div key={idx} className="flex items-center justify-between py-1 px-2 hover:bg-background rounded">
                <span className="text-sm font-mono">{serial}</span>
                <XCircle className="w-4 h-4 text-text-muted cursor-pointer hover:text-red-500" />
              </div>
            ))}
            {selectedBox && (selectedBox.serials?.length ?? 0) > 10 && (
              <p className="text-xs text-text-muted text-center py-2">{t("common.andMore", { count: (selectedBox.serials?.length ?? 0) - 10 })}</p>
            )}
          </div>
          <div className="flex justify-end">
            <Button variant="secondary" onClick={() => setIsSerialModalOpen(false)}>{t("common.close")}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
