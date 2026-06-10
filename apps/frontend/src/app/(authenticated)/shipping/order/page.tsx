"use client";

/**
 * @file src/app/(authenticated)/shipping/order/page.tsx
 * @description 출하지시등록 페이지 - 출하지시 CRUD 및 품목 관리
 *
 * 초보자 가이드:
 * 1. **출하지시**: 고객사에 출하할 품목과 수량을 지정하는 지시서
 * 2. **상태 흐름**: DRAFT -> CONFIRMED -> SHIPPING -> SHIPPED
 * 3. API: GET/POST/PUT/DELETE /shipping/orders
 */
import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { ColumnDef } from "@tanstack/react-table";
import {
  ClipboardList, Plus, Search, RefreshCw, Edit2, Trash2, X,
} from "lucide-react";
import { Card, CardContent, Button, Input, Modal, Select, ComCodeBadge, ConfirmModal } from "@/components/ui";
import DataGrid from "@/components/data-grid/DataGrid";
import { useComCodeOptions } from "@/hooks/useComCode";
import { usePartnerOptions } from "@/hooks/useMasterOptions";
import PartSearchModal from "@/components/shared/PartSearchModal";
import type { PartItem } from "@/components/shared/PartSearchModal";
import api from "@/services/api";

interface ShipOrderLine {
  itemCode: string;
  itemName?: string;
  unit?: string;
  orderQty: number;
  remark?: string;
}

interface ShipOrder {
  shipOrderNo: string;
  customerName: string;
  customerId: string;
  dueDate: string;
  shipDate: string;
  status: string;
  itemCount: number;
  totalQty: number;
  remark: string;
  items?: ShipOrderLine[];
}

export default function ShipOrderPage() {
  const { t } = useTranslation();
  const [data, setData] = useState<ShipOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPartModalOpen, setIsPartModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ShipOrder | null>(null);
  const [form, setForm] = useState({ shipOrderNo: "", customerId: "", dueDate: "", shipDate: "", remark: "" });
  const [orderItems, setOrderItems] = useState<ShipOrderLine[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<ShipOrder | null>(null);

  const comCodeStatusOptions = useComCodeOptions("SHIP_ORDER_STATUS");
  const { options: customerOptions } = usePartnerOptions("CUSTOMER");
  const statusOptions = useMemo(() => [
    { value: "", label: t("common.allStatus") }, ...comCodeStatusOptions
  ], [t, comCodeStatusOptions]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { limit: "5000" };
      if (searchText) params.search = searchText;
      if (statusFilter) params.status = statusFilter;
      const res = await api.get("/shipping/orders", { params });
      const rows = Array.isArray(res.data?.data) ? res.data.data : [];
      setData(rows.map((row: ShipOrder) => {
        const items = row.items ?? [];
        return {
          ...row,
          itemCount: row.itemCount ?? items.length,
          totalQty: row.totalQty ?? items.reduce((sum, item) => sum + (Number(item.orderQty) || 0), 0),
        };
      }));
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [searchText, statusFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const openCreate = useCallback(() => {
    setEditingItem(null);
    setForm({ shipOrderNo: "", customerId: "", dueDate: "", shipDate: "", remark: "" });
    setOrderItems([]);
    setIsModalOpen(true);
  }, []);

  const openEdit = useCallback((item: ShipOrder) => {
    setEditingItem(item);
    setForm({ shipOrderNo: item.shipOrderNo, customerId: item.customerId || "", dueDate: item.dueDate, shipDate: item.shipDate, remark: item.remark || "" });
    setOrderItems((item.items ?? []).map((line) => ({
      itemCode: line.itemCode,
      itemName: line.itemName,
      unit: line.unit,
      orderQty: Number(line.orderQty) || 0,
      remark: line.remark || "",
    })));
    setIsModalOpen(true);
  }, []);

  const addOrderItem = useCallback((part: PartItem) => {
    setOrderItems((prev) => {
      if (prev.some((item) => item.itemCode === part.itemCode)) return prev;
      return [...prev, {
        itemCode: part.itemCode,
        itemName: part.itemName,
        unit: part.unit,
        orderQty: 1,
        remark: "",
      }];
    });
  }, []);

  const updateOrderItem = useCallback((itemCode: string, field: "orderQty" | "remark", value: number | string) => {
    setOrderItems((prev) => prev.map((item) => {
      if (item.itemCode !== itemCode) return item;
      return field === "orderQty"
        ? { ...item, orderQty: Number(value) || 0 }
        : { ...item, remark: String(value) };
    }));
  }, []);

  const removeOrderItem = useCallback((itemCode: string) => {
    setOrderItems((prev) => prev.filter((item) => item.itemCode !== itemCode));
  }, []);

  const totalOrderQty = useMemo(
    () => orderItems.reduce((sum, item) => sum + (Number(item.orderQty) || 0), 0),
    [orderItems],
  );
  const canSave = form.shipOrderNo.trim().length > 0
    && orderItems.length > 0
    && orderItems.every((item) => Number.isInteger(item.orderQty) && item.orderQty > 0);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const payload = {
        ...form,
        items: orderItems.map((item) => ({
          itemCode: item.itemCode,
          orderQty: item.orderQty,
          remark: item.remark || undefined,
        })),
      };
      if (editingItem) {
        await api.put(`/shipping/orders/${editingItem.shipOrderNo}`, payload);
      } else {
        await api.post("/shipping/orders", payload);
      }
      setIsModalOpen(false);
      fetchData();
    } catch (e) {
      console.error("Save failed:", e);
    } finally {
      setSaving(false);
    }
  }, [editingItem, form, orderItems, fetchData]);

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteTarget) return;
    try {
      await api.delete(`/shipping/orders/${deleteTarget.shipOrderNo}`);
      fetchData();
    } catch (e) {
      console.error("Delete failed:", e);
    } finally {
      setDeleteTarget(null);
    }
  }, [deleteTarget, fetchData]);

  const columns = useMemo<ColumnDef<ShipOrder>[]>(() => [
    { id: "actions", header: "", size: 80, meta: { align: "center" as const, filterType: "none" as const }, cell: ({ row }) => (
      <div className="flex gap-1">
        <button onClick={() => openEdit(row.original)} className="p-1 hover:bg-surface rounded"><Edit2 className="w-4 h-4 text-primary" /></button>
        <button onClick={() => setDeleteTarget(row.original)} className="p-1 hover:bg-surface rounded"><Trash2 className="w-4 h-4 text-red-500" /></button>
      </div>
    ) },
    { accessorKey: "shipOrderNo", header: t("shipping.shipOrder.shipOrderNo"), size: 160, meta: { filterType: "text" as const } },
    { accessorKey: "customerName", header: t("shipping.shipOrder.customer"), size: 120, meta: { filterType: "text" as const } },
    { accessorKey: "dueDate", header: t("shipping.shipOrder.dueDate"), size: 100, meta: { filterType: "date" as const } },
    { accessorKey: "shipDate", header: t("shipping.shipOrder.shipDate"), size: 100, meta: { filterType: "date" as const } },
    { accessorKey: "itemCount", header: t("shipping.shipOrder.itemCount"), size: 70, meta: { filterType: "number" as const }, cell: ({ getValue }) => <span className="font-medium">{getValue() as number}</span> },
    { accessorKey: "totalQty", header: t("common.totalQty"), size: 90, meta: { filterType: "number" as const }, cell: ({ getValue }) => <span className="font-medium">{((getValue() as number) ?? 0).toLocaleString()}</span> },
    { accessorKey: "status", header: t("common.status"), size: 90, meta: { filterType: "multi" as const }, cell: ({ getValue }) => <ComCodeBadge groupCode="SHIP_ORDER_STATUS" code={getValue() as string} /> },
  ], [t, openEdit]);

  return (
    <div className="h-full flex flex-col overflow-hidden p-6 gap-4 animate-fade-in">
      <div className="flex justify-between items-center flex-shrink-0">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2"><ClipboardList className="w-7 h-7 text-primary" />{t("shipping.shipOrder.title")}</h1>
          <p className="text-text-muted mt-1">{t("shipping.shipOrder.subtitle")}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={fetchData}>
            <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} />{t('common.refresh')}
          </Button>
          <Button size="sm" onClick={openCreate}><Plus className="w-4 h-4 mr-1" />{t("common.register")}</Button>
        </div>
      </div>
      <Card className="flex-1 min-h-0 overflow-hidden" padding="none"><CardContent className="h-full p-4">
        <DataGrid data={data} columns={columns} isLoading={loading} enableColumnFilter
          enableExport exportFileName={t("shipping.shipOrder.title")}
          toolbarLeft={
            <div className="flex gap-3 flex-1 min-w-0">
              <div className="flex-1 min-w-0">
                <Input placeholder={t("shipping.shipOrder.searchPlaceholder")} value={searchText} onChange={(e) => setSearchText(e.target.value)} leftIcon={<Search className="w-4 h-4" />} fullWidth />
              </div>
              <div className="w-36 flex-shrink-0">
                <Select options={statusOptions} value={statusFilter} onChange={setStatusFilter} fullWidth />
              </div>
            </div>
          } 
          sqlQuery={`SELECT *\nFROM SHIPPING_ORDERS\nWHERE COMPANY = '40'\n  AND PLANT_CD = '1000'\nORDER BY CREATED_AT DESC`}/>
      </CardContent></Card>
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingItem ? t("shipping.shipOrder.editTitle") : t("shipping.shipOrder.addTitle")} size="xl">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label={t("shipping.shipOrder.shipOrderNo")} placeholder="SO-YYYYMMDD-NNN"
              value={form.shipOrderNo} onChange={e => setForm(p => ({ ...p, shipOrderNo: e.target.value }))} fullWidth />
            <Select label={t("shipping.shipOrder.customer")} options={customerOptions}
              value={form.customerId} onChange={v => setForm(p => ({ ...p, customerId: v }))} fullWidth />
            <Input label={t("shipping.shipOrder.dueDate")} type="date"
              value={form.dueDate} onChange={e => setForm(p => ({ ...p, dueDate: e.target.value }))} fullWidth />
            <Input label={t("shipping.shipOrder.shipDate")} type="date"
              value={form.shipDate} onChange={e => setForm(p => ({ ...p, shipDate: e.target.value }))} fullWidth />
          </div>
          <Input label={t("common.remark")} placeholder={t("common.remarkPlaceholder")}
            value={form.remark} onChange={e => setForm(p => ({ ...p, remark: e.target.value }))} fullWidth />

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-text">
                {t("shipping.shipOrder.items", "출하지시 품목")}
              </h3>
              <Button variant="secondary" size="sm" onClick={() => setIsPartModalOpen(true)}>
                <Plus className="w-4 h-4 mr-1" />
                {t("common.add")}
              </Button>
            </div>

            <div className="border border-border rounded-lg overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-background/50">
                  <tr>
                    <th className="text-left px-3 py-2 text-text-muted font-medium">{t("common.partCode")}</th>
                    <th className="text-left px-3 py-2 text-text-muted font-medium">{t("common.partName")}</th>
                    <th className="text-center px-3 py-2 text-text-muted font-medium w-20">{t("common.unit")}</th>
                    <th className="text-center px-3 py-2 text-text-muted font-medium w-32">{t("pda.shipping.orderQty", "지시수량")}</th>
                    <th className="text-left px-3 py-2 text-text-muted font-medium w-40">{t("common.remark")}</th>
                    <th className="w-10" />
                  </tr>
                </thead>
                <tbody>
                  {orderItems.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-3 py-6 text-center text-text-muted">
                        {t("shipping.shipOrder.noItems", "품목을 추가해 주세요.")}
                      </td>
                    </tr>
                  ) : orderItems.map((item) => (
                    <tr key={item.itemCode} className="border-t border-border">
                      <td className="px-3 py-2 font-mono">{item.itemCode}</td>
                      <td className="px-3 py-2">{item.itemName || "-"}</td>
                      <td className="px-3 py-2 text-center text-text-muted">{item.unit || "-"}</td>
                      <td className="px-3 py-2">
                        <Input
                          type="number"
                          min={1}
                          step={1}
                          value={item.orderQty ? String(item.orderQty) : ""}
                          onChange={(e) => updateOrderItem(item.itemCode, "orderQty", Math.trunc(Number(e.target.value)) || 0)}
                          fullWidth
                        />
                      </td>
                      <td className="px-3 py-2">
                        <Input
                          value={item.remark || ""}
                          onChange={(e) => updateOrderItem(item.itemCode, "remark", e.target.value)}
                          fullWidth
                        />
                      </td>
                      <td className="px-3 py-2 text-center">
                        <button
                          type="button"
                          onClick={() => removeOrderItem(item.itemCode)}
                          className="p-1 rounded hover:bg-red-50 text-red-500"
                          aria-label={t("common.delete")}
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {orderItems.length > 0 && (
                <div className="px-3 py-2 border-t border-border bg-background/30 text-xs text-text-muted flex justify-end gap-4">
                  <span>{t("shipping.shipOrder.itemCount")}: <strong className="text-text">{orderItems.length.toLocaleString()}</strong></span>
                  <span>{t("common.totalQty")}: <strong className="text-text">{totalOrderQty.toLocaleString()}</strong></span>
                </div>
              )}
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-4 border-t border-border">
            <Button variant="secondary" onClick={() => setIsModalOpen(false)}>{t("common.cancel")}</Button>
            <Button onClick={handleSave} disabled={!canSave || saving}>
              {saving ? t("common.saving") : editingItem ? t("common.edit") : t("common.register")}
            </Button>
          </div>
        </div>
      </Modal>
      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        variant="danger"
        message={`'${deleteTarget?.shipOrderNo || ""}'을(를) 삭제하시겠습니까?`}
      />
      <PartSearchModal
        isOpen={isPartModalOpen}
        onClose={() => setIsPartModalOpen(false)}
        onSelect={addOrderItem}
        itemType="FINISHED"
      />
    </div>
  );
}
