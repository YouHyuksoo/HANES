"use client";

/**
 * @file src/app/(authenticated)/material/po/page.tsx
 * @description PO관리 페이지 - 좌측 마스터(PO목록) + 우측 디테일(품목목록)
 *
 * 초보자 가이드:
 * 1. **좌측 패널**: PO 목록 (마스터) - 클릭 시 우측에 해당 PO의 품목 표시
 * 2. **우측 패널**: 선택된 PO의 품목 목록 (디테일)
 * 3. API: GET/POST/PUT/DELETE /material/purchase-orders
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  ShoppingCart, Plus, Edit2, Trash2, Search, RefreshCw,
  CheckCircle, Clock, Truck, Archive, Package,
} from "lucide-react";
import { Card, CardContent, Button, Input, Modal, StatCard, ConfirmModal } from "@/components/ui";
import { ComCodeSelect } from "@/components/shared";
import DataGrid from "@/components/data-grid/DataGrid";
import { ColumnDef } from "@tanstack/react-table";
import api from "@/services/api";

interface PurchaseOrderItem {
  id: number;
  poNo: string;
  itemCode: string;
  itemName: string;
  spec: string | null;
  unit: string | null;
  orderQty: number;
  receivedQty: number;
  unitPrice: number | null;
  remark: string | null;
}

interface PurchaseOrder {
  poNo: string;
  partnerName: string;
  orderDate: string;
  dueDate: string;
  status: string;
  totalAmount: number | null;
  remark: string | null;
  items: PurchaseOrderItem[];
}

const statusColors: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300",
  CONFIRMED: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
  PARTIAL: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300",
  RECEIVED: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
  CLOSED: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300",
};

export default function PoPage() {
  const { t } = useTranslation();

  const [data, setData] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [selectedPo, setSelectedPo] = useState<PurchaseOrder | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<PurchaseOrder | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    poNo: "", partnerName: "", orderDate: "", dueDate: "", remark: "",
  });
  const [deleteTarget, setDeleteTarget] = useState<PurchaseOrder | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { limit: "5000" };
      if (searchText) params.search = searchText;
      if (statusFilter) params.status = statusFilter;
      const res = await api.get("/material/purchase-orders", { params });
      const list = res.data?.data ?? [];
      setData(list);
      if (selectedPo) {
        const updated = list.find((p: PurchaseOrder) => p.poNo === selectedPo.poNo);
        setSelectedPo(updated ?? list[0] ?? null);
      } else if (list.length > 0) {
        setSelectedPo(list[0]);
      }
    } catch {
      setData([]);
      setSelectedPo(null);
    } finally {
      setLoading(false);
    }
  }, [searchText, statusFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const stats = useMemo(() => ({
    total: data.length,
    confirmed: data.filter(d => d.status === "CONFIRMED").length,
    partial: data.filter(d => d.status === "PARTIAL").length,
    received: data.filter(d => d.status === "RECEIVED").length,
  }), [data]);

  const openCreate = useCallback(() => {
    setEditingItem(null);
    setForm({ poNo: "", partnerName: "", orderDate: "", dueDate: "", remark: "" });
    setIsModalOpen(true);
  }, []);

  const openEdit = useCallback((po: PurchaseOrder) => {
    setEditingItem(po);
    setForm({
      poNo: po.poNo, partnerName: po.partnerName,
      orderDate: po.orderDate, dueDate: po.dueDate, remark: po.remark || "",
    });
    setIsModalOpen(true);
  }, []);

  const handleSave = useCallback(async () => {
    if (!form.poNo || !form.partnerName) return;
    setSaving(true);
    try {
      if (editingItem) {
        await api.put(`/material/purchase-orders/${editingItem.poNo}`, form);
      } else {
        await api.post("/material/purchase-orders", { ...form, items: [] });
      }
      setIsModalOpen(false);
      fetchData();
    } catch (e) {
      console.error("Save failed:", e);
    } finally {
      setSaving(false);
    }
  }, [editingItem, form, fetchData]);

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteTarget) return;
    try {
      await api.delete(`/material/purchase-orders/${deleteTarget.poNo}`);
      if (selectedPo?.poNo === deleteTarget.poNo) setSelectedPo(null);
      fetchData();
    } catch (e) {
      console.error("Delete failed:", e);
    } finally {
      setDeleteTarget(null);
    }
  }, [deleteTarget, fetchData, selectedPo]);

  /** 마스터 그리드 컬럼 (PO 목록) */
  const masterColumns = useMemo<ColumnDef<PurchaseOrder>[]>(() => [
    {
      accessorKey: "poNo", header: t("material.po.poNo"), size: 150,
      meta: { filterType: "text" as const },
      cell: ({ getValue }) => (
        <span className="font-mono text-sm font-medium">{getValue() as string}</span>
      ),
    },
    {
      accessorKey: "partnerName", header: t("material.po.partnerName"), size: 120,
      meta: { filterType: "text" as const },
    },
    {
      accessorKey: "orderDate", header: t("material.po.orderDate"), size: 100,
      meta: { filterType: "date" as const },
    },
    {
      accessorKey: "dueDate", header: t("material.po.dueDate"), size: 100,
      meta: { filterType: "date" as const },
    },
    {
      accessorKey: "totalAmount", header: t("material.po.totalAmount"), size: 120,
      meta: { filterType: "number" as const, align: "right" as const },
      cell: ({ getValue }) => (
        <span className="font-semibold">
          {(getValue() as number | null)?.toLocaleString() ?? "-"}
        </span>
      ),
    },
    {
      accessorKey: "status", header: t("common.status"), size: 100,
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
      id: "actions", header: "", size: 70,
      meta: { filterType: "none" as const },
      cell: ({ row }) => (
        <div className="flex gap-1">
          <button onClick={(e) => { e.stopPropagation(); openEdit(row.original); }}
            className="p-1 hover:bg-surface rounded">
            <Edit2 className="w-4 h-4 text-primary" />
          </button>
          <button onClick={(e) => { e.stopPropagation(); setDeleteTarget(row.original); }}
            className="p-1 hover:bg-surface rounded">
            <Trash2 className="w-4 h-4 text-red-500" />
          </button>
        </div>
      ),
    },
  ], [t, openEdit]);

  /** 디테일 그리드 컬럼 (품목 목록) */
  const detailColumns = useMemo<ColumnDef<PurchaseOrderItem>[]>(() => [
    {
      accessorKey: "itemCode", header: t("material.po.itemCode"), size: 100,
      meta: { filterType: "text" as const },
      cell: ({ getValue }) => (
        <span className="font-mono text-sm">{getValue() as string}</span>
      ),
    },
    {
      accessorKey: "itemName", header: t("material.po.itemName"), size: 180,
      meta: { filterType: "text" as const },
    },
    {
      accessorKey: "spec", header: t("material.po.spec"), size: 160,
      meta: { filterType: "text" as const },
      cell: ({ getValue }) => <span>{(getValue() as string) || "-"}</span>,
    },
    {
      accessorKey: "unit", header: t("material.po.unit"), size: 60,
      meta: { filterType: "text" as const },
      cell: ({ getValue }) => <span>{(getValue() as string) || "-"}</span>,
    },
    {
      accessorKey: "orderQty", header: t("material.po.orderQty"), size: 100,
      meta: { filterType: "number" as const, align: "right" as const },
      cell: ({ getValue }) => (
        <span className="font-semibold">{(getValue() as number).toLocaleString()}</span>
      ),
    },
    {
      accessorKey: "receivedQty", header: t("material.po.receivedQty"), size: 100,
      meta: { filterType: "number" as const, align: "right" as const },
      cell: ({ getValue }) => <span>{(getValue() as number).toLocaleString()}</span>,
    },
    {
      accessorKey: "unitPrice", header: t("material.po.unitPrice"), size: 100,
      meta: { filterType: "number" as const, align: "right" as const },
      cell: ({ getValue }) => (
        <span>{(getValue() as number | null)?.toLocaleString() ?? "-"}</span>
      ),
    },
    {
      id: "amount", header: t("material.po.amount"), size: 120,
      meta: { filterType: "none" as const, align: "right" as const },
      cell: ({ row }) => {
        const { orderQty, unitPrice } = row.original;
        const amt = unitPrice != null ? orderQty * unitPrice : null;
        return <span className="font-semibold">{amt?.toLocaleString() ?? "-"}</span>;
      },
    },
  ], [t]);

  const detailItems = selectedPo?.items ?? [];

  return (
    <div className="space-y-4 animate-fade-in">
      {/* 헤더 */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2">
            <ShoppingCart className="w-7 h-7 text-primary" />{t("material.po.title")}
          </h1>
          <p className="text-text-muted mt-1">{t("material.po.subtitle")}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={fetchData}>
            <RefreshCw className="w-4 h-4 mr-1" />{t("common.refresh")}
          </Button>
          <Button size="sm" onClick={openCreate}>
            <Plus className="w-4 h-4 mr-1" />{t("common.register")}
          </Button>
        </div>
      </div>

      {/* 통계 */}
      <div className="grid grid-cols-4 gap-3">
        <StatCard label={t("material.po.stats.total")} value={stats.total}
          icon={ShoppingCart} color="blue" />
        <StatCard label={t("material.po.stats.confirmed")} value={stats.confirmed}
          icon={CheckCircle} color="yellow" />
        <StatCard label={t("material.po.stats.partial")} value={stats.partial}
          icon={Truck} color="orange" />
        <StatCard label={t("material.po.stats.received")} value={stats.received}
          icon={Archive} color="green" />
      </div>

      {/* 마스터-디테일 좌우 분할 */}
      <div className="grid grid-cols-12 gap-4">
        {/* 좌측: PO 마스터 */}
        <div className="col-span-7">
          <Card><CardContent>
            <DataGrid data={data} columns={masterColumns} isLoading={loading}
              enableColumnFilter enableExport exportFileName={t("material.po.title")}
              onRowClick={(row) => setSelectedPo(row)}
              selectedRowId={selectedPo?.poNo}
              getRowId={(row) => row.poNo}
              toolbarLeft={
                <div className="flex gap-3 flex-1 min-w-0">
                  <div className="flex-1 min-w-0">
                    <Input placeholder={t("material.po.searchPlaceholder")}
                      value={searchText} onChange={e => setSearchText(e.target.value)}
                      leftIcon={<Search className="w-4 h-4" />} fullWidth />
                  </div>
                  <div className="w-36 flex-shrink-0">
                    <ComCodeSelect groupCode="PO_STATUS"
                      value={statusFilter} onChange={setStatusFilter} fullWidth />
                  </div>
                </div>
              } />
          </CardContent></Card>
        </div>

        {/* 우측: 품목 디테일 */}
        <div className="col-span-5">
          <Card>
            <CardContent>
              {selectedPo ? (
                <div className="space-y-3">
                  {/* 선택된 PO 헤더 정보 */}
                  <div className="p-3 rounded-lg bg-surface-secondary dark:bg-slate-800/50 border border-border">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-mono font-bold text-primary text-lg">
                        {selectedPo.poNo}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusColors[selectedPo.status] || ""}`}>
                        {selectedPo.status}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                      <div>
                        <span className="text-text-muted">{t("material.po.partnerName")}:</span>{" "}
                        <span className="font-medium">{selectedPo.partnerName}</span>
                      </div>
                      <div>
                        <span className="text-text-muted">{t("material.po.totalAmount")}:</span>{" "}
                        <span className="font-semibold">
                          {selectedPo.totalAmount?.toLocaleString() ?? "-"}
                        </span>
                      </div>
                      <div>
                        <span className="text-text-muted">{t("material.po.orderDate")}:</span>{" "}
                        {selectedPo.orderDate}
                      </div>
                      <div>
                        <span className="text-text-muted">{t("material.po.dueDate")}:</span>{" "}
                        {selectedPo.dueDate}
                      </div>
                    </div>
                  </div>

                  {/* 품목 목록 */}
                  <DataGrid data={detailItems} columns={detailColumns}
                    enableColumnFilter={false}
                    enableExport exportFileName={`${selectedPo.poNo}_items`} />
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-20 text-text-muted">
                  <Package className="w-12 h-12 mb-3 opacity-40" />
                  <p className="text-sm">PO를 선택하면 품목이 표시됩니다</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* 등록/수정 모달 */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)}
        title={editingItem ? t("common.edit") : t("common.register")} size="lg">
        <div className="grid grid-cols-2 gap-4">
          <Input label={t("material.po.poNo")} placeholder="PO-YYYYMMDD-001"
            value={form.poNo}
            onChange={e => setForm(p => ({ ...p, poNo: e.target.value }))}
            disabled={!!editingItem} fullWidth />
          <Input label={t("material.po.partnerName")}
            placeholder={t("material.po.partnerName")}
            value={form.partnerName}
            onChange={e => setForm(p => ({ ...p, partnerName: e.target.value }))}
            fullWidth />
          <Input label={t("material.po.orderDate")} type="date"
            value={form.orderDate}
            onChange={e => setForm(p => ({ ...p, orderDate: e.target.value }))}
            fullWidth />
          <Input label={t("material.po.dueDate")} type="date"
            value={form.dueDate}
            onChange={e => setForm(p => ({ ...p, dueDate: e.target.value }))}
            fullWidth />
        </div>
        <div className="flex justify-end gap-2 pt-6">
          <Button variant="secondary" onClick={() => setIsModalOpen(false)}>
            {t("common.cancel")}
          </Button>
          <Button onClick={handleSave}
            disabled={saving || !form.poNo || !form.partnerName}>
            {saving ? t("common.saving") : editingItem ? t("common.edit") : t("common.register")}
          </Button>
        </div>
      </Modal>

      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        variant="danger"
        message={`'${deleteTarget?.poNo || ""}'${t("common.deleteConfirm") || "을(를) 삭제하시겠습니까?"}`}
      />
    </div>
  );
}
