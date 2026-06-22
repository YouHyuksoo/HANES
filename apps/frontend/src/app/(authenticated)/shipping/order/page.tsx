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
import QRCode from "react-qr-code";
import {
  ClipboardList, Plus, Search, RefreshCw, Edit2, Trash2, X, Printer, HelpCircle, CheckCircle,
} from "lucide-react";
import { Card, CardContent, Button, Input, Select, ComCodeBadge, ConfirmModal } from "@/components/ui";
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

const shipOrderStatusHelpText = [
  "DRAFT: 출하지시 작성 중 상태입니다. 품목, 고객사, 출하일을 수정할 수 있습니다.",
  "CONFIRMED: 출하지시가 확정되어 박스 또는 팔레트 출하 작업을 진행할 수 있습니다.",
  "SHIPPING: 출하 작업이 진행 중인 상태입니다. 일부 물류 처리가 남아 있을 수 있습니다.",
  "SHIPPED: 출하 처리가 완료된 상태입니다. 출하 이력과 수불이 기록되었습니다.",
  "CLOSED: 출하지시 수량이 모두 처리되어 마감된 상태입니다.",
].join("\n");

function ShipOrderStatusHeader() {
  const { t } = useTranslation();

  return (
    <div className="flex items-center justify-center gap-1">
      <span>{t("common.status")}</span>
      <span
        className="inline-flex h-4 w-4 items-center justify-center rounded-full text-text-muted hover:bg-surface hover:text-primary"
        title={shipOrderStatusHelpText}
        aria-label={shipOrderStatusHelpText}
      >
        <HelpCircle className="h-3.5 w-3.5" />
      </span>
    </div>
  );
}

export default function ShipOrderPage() {
  const { t } = useTranslation();
  const [data, setData] = useState<ShipOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [isFormPanelOpen, setIsFormPanelOpen] = useState(false);
  const [isPartModalOpen, setIsPartModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ShipOrder | null>(null);
  const [form, setForm] = useState({ customerId: "", dueDate: "", shipDate: "", remark: "" });
  const [orderItems, setOrderItems] = useState<ShipOrderLine[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<ShipOrder | null>(null);
  const [printTarget, setPrintTarget] = useState<ShipOrder | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<ShipOrder | null>(null);
  const [confirming, setConfirming] = useState(false);

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
    setForm({ customerId: "", dueDate: "", shipDate: "", remark: "" });
    setOrderItems([]);
    setIsFormPanelOpen(true);
  }, []);

  const openEdit = useCallback((item: ShipOrder) => {
    setEditingItem(item);
    setForm({ customerId: item.customerId || "", dueDate: item.dueDate, shipDate: item.shipDate, remark: item.remark || "" });
    setOrderItems((item.items ?? []).map((line) => ({
      itemCode: line.itemCode,
      itemName: line.itemName,
      unit: line.unit,
      orderQty: Number(line.orderQty) || 0,
      remark: line.remark || "",
    })));
    setIsFormPanelOpen(true);
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
  const canSave = orderItems.length > 0
    && form.shipDate.trim().length > 0
    && orderItems.every((item) => Number.isInteger(item.orderQty) && item.orderQty > 0);

  const shipOrderNoDisplay = editingItem
    ? { shipOrderNo: editingItem.shipOrderNo }
    : { shipOrderNo: t("common.autoGenerated", "자동생성") };

  const handleSave = useCallback(async () => {
    if (!canSave || saving) return;
    setSaving(true);
    try {
      const payload = {
        customerId: form.customerId || undefined,
        dueDate: form.dueDate || undefined,
        shipDate: form.shipDate,
        remark: form.remark || undefined,
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
      setIsFormPanelOpen(false);
      fetchData();
    } catch (e) {
      console.error("Save failed:", e);
    } finally {
      setSaving(false);
    }
  }, [canSave, editingItem, form, orderItems, fetchData, saving]);

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

  const handlePrintShipOrder = useCallback((order: ShipOrder) => {
    setPrintTarget(order);
    window.setTimeout(() => window.print(), 80);
  }, []);

  const closeFormPanel = useCallback(() => {
    setIsFormPanelOpen(false);
    setEditingItem(null);
  }, []);

  const handleConfirmOrder = useCallback(async () => {
    if (!confirmTarget) return;
    setConfirming(true);
    try {
      await api.put(`/shipping/orders/${confirmTarget.shipOrderNo}/confirm`);
      setConfirmTarget(null);
      closeFormPanel();
      fetchData();
    } catch (e) {
      console.error("Confirm failed:", e);
    } finally {
      setConfirming(false);
    }
  }, [confirmTarget, closeFormPanel, fetchData]);

  const columns = useMemo<ColumnDef<ShipOrder>[]>(() => [
    { id: "actions", header: "", size: 140, meta: { align: "center" as const, filterType: "none" as const }, cell: ({ row }) => (
      <div className="flex gap-1">
        <button
          onClick={() => handlePrintShipOrder(row.original)}
          className="p-1 hover:bg-surface rounded"
          title={t("shipping.shipOrder.printOrder", "출하지시서 출력")}
        >
          <Printer className="w-4 h-4 text-primary" />
        </button>
        {row.original.status === "DRAFT" && (
          <button
            onClick={() => setConfirmTarget(row.original)}
            disabled={(row.original.itemCount ?? 0) === 0}
            className="p-1 hover:bg-surface rounded disabled:opacity-40 disabled:cursor-not-allowed"
            title={(row.original.itemCount ?? 0) === 0
              ? t("shipping.shipOrder.confirmNeedItems", "품목이 있어야 확정할 수 있습니다.")
              : t("shipping.shipOrder.confirmOrder", "출하지시 확정")}
          >
            <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
          </button>
        )}
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
    { accessorKey: "status", header: () => <ShipOrderStatusHeader />, size: 90, meta: { filterType: "multi" as const }, cell: ({ getValue }) => <ComCodeBadge groupCode="SHIP_ORDER_STATUS" code={getValue() as string} /> },
  ], [t, openEdit, handlePrintShipOrder]);

  return (
    <div className="flex h-full animate-fade-in">
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden p-6 gap-4">
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
            sqlQuery={`SELECT
  so.SHIP_ORDER_NO,
  so.CUSTOMER_ID,
  COALESCE(pm.PARTNER_NAME, so.CUSTOMER_NAME) AS CUSTOMER_NAME,
  so.DUE_DATE,
  so.SHIP_DATE,
  so.STATUS,
  so.REMARK,
  soi.SEQ,
  soi.ITEM_CODE,
  im.ITEM_NAME,
  soi.ORDER_QTY,
  soi.SHIPPED_QTY,
  soi.REMARK AS ITEM_REMARK
FROM SHIPMENT_ORDERS so
LEFT JOIN SHIPMENT_ORDER_ITEMS soi
  ON soi.SHIP_ORDER_ID = so.SHIP_ORDER_NO
 AND soi.COMPANY = so.COMPANY
 AND soi.PLANT_CD = so.PLANT_CD
LEFT JOIN ITEM_MASTERS im
  ON im.ITEM_CODE = soi.ITEM_CODE
 AND im.COMPANY = so.COMPANY
 AND im.PLANT_CD = so.PLANT_CD
LEFT JOIN PARTNER_MASTERS pm
  ON pm.PARTNER_CODE = so.CUSTOMER_ID
 AND pm.COMPANY = so.COMPANY
 AND pm.PLANT_CD = so.PLANT_CD
WHERE so.COMPANY = '40'
  AND so.PLANT_CD = '1000'
  /* 검색: so.SHIP_ORDER_NO LIKE :search */
  /* 상태: so.STATUS = :status */
ORDER BY so.CREATED_AT DESC`}/>
        </CardContent></Card>
      </div>

      {isFormPanelOpen && (
        <aside className="flex w-[480px] min-h-0 flex-col overflow-hidden border-l border-border bg-surface shadow-2xl animate-slide-in-right">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div className="min-w-0">
              <h2 className="truncate text-base font-semibold text-text">
                {editingItem ? t("shipping.shipOrder.editTitle") : t("shipping.shipOrder.addTitle")}
              </h2>
              <p className="mt-1 text-xs text-text-muted">
                {t("shipping.shipOrder.subtitle")}
              </p>
            </div>
            <button type="button" onClick={closeFormPanel} className="rounded p-1 text-text-muted hover:bg-surface-secondary hover:text-text" aria-label={t("common.close", "닫기")}>
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex min-h-0 flex-1 flex-col">
              <div className="min-h-0 flex-1 space-y-4 overflow-auto p-4">
                <div className="grid grid-cols-2 gap-3">
                  <Input label={t("shipping.shipOrder.shipOrderNo")} placeholder={t("common.autoGenerated", "자동생성")}
                    value={shipOrderNoDisplay.shipOrderNo} disabled fullWidth />
                  <Select label={t("shipping.shipOrder.customer")} options={customerOptions}
                    value={form.customerId} onChange={v => setForm(p => ({ ...p, customerId: v }))} fullWidth />
                  <Input label={t("shipping.shipOrder.dueDate")} type="date"
                    value={form.dueDate} onChange={e => setForm(p => ({ ...p, dueDate: e.target.value }))} fullWidth />
                  <Input label={t("shipping.shipOrder.shipDate")} type="date"
                    value={form.shipDate} onChange={e => setForm(p => ({ ...p, shipDate: e.target.value }))} required fullWidth />
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

                  <div className="space-y-2">
                    {orderItems.length === 0 ? (
                      <div className="rounded border border-dashed border-border px-3 py-8 text-center text-sm text-text-muted">
                        {t("shipping.shipOrder.noItems", "품목을 추가해 주세요.")}
                      </div>
                    ) : orderItems.map((item) => (
                      <div key={item.itemCode} className="rounded border border-border bg-surface-secondary p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="truncate text-sm font-semibold text-text">{item.itemName || "-"}</div>
                            <div className="mt-1 font-mono text-xs text-text-muted">{item.itemCode} · {item.unit || "-"}</div>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeOrderItem(item.itemCode)}
                            className="rounded p-1 text-red-500 hover:bg-red-50"
                            aria-label={t("common.delete")}
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                        <div className="mt-3 grid grid-cols-[120px_minmax(0,1fr)] gap-2">
                          <Input
                            type="number"
                            min={1}
                            step={1}
                            value={item.orderQty ? String(item.orderQty) : ""}
                            onChange={(e) => updateOrderItem(item.itemCode, "orderQty", Math.trunc(Number(e.target.value)) || 0)}
                            fullWidth
                          />
                          <Input
                            value={item.remark || ""}
                            placeholder={t("common.remark")}
                            onChange={(e) => updateOrderItem(item.itemCode, "remark", e.target.value)}
                            fullWidth
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                  {orderItems.length > 0 && (
                    <div className="rounded border border-border bg-background/30 px-3 py-2 text-xs text-text-muted flex justify-end gap-4">
                      <span>{t("shipping.shipOrder.itemCount")}: <strong className="text-text">{orderItems.length.toLocaleString()}</strong></span>
                      <span>{t("common.totalQty")}: <strong className="text-text">{totalOrderQty.toLocaleString()}</strong></span>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex justify-end gap-2 border-t border-border p-4">
                <Button variant="secondary" onClick={closeFormPanel}>{t("common.cancel")}</Button>
                {editingItem && editingItem.status === "DRAFT" && (
                  <Button
                    variant="secondary"
                    className="border-green-500 text-green-600 dark:text-green-400"
                    onClick={() => setConfirmTarget(editingItem)}
                    disabled={orderItems.length === 0 || saving || confirming}
                    title={orderItems.length === 0 ? t("shipping.shipOrder.confirmNeedItems", "품목이 있어야 확정할 수 있습니다.") : undefined}
                  >
                    <CheckCircle className="w-4 h-4 mr-1" />
                    {t("shipping.shipOrder.confirmOrder", "출하지시 확정")}
                  </Button>
                )}
                <Button onClick={handleSave} disabled={!canSave || saving}>
                  {saving ? t("common.saving") : editingItem ? t("common.edit") : t("common.register")}
                </Button>
              </div>
            </div>
        </aside>
      )}
      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        variant="danger"
        message={`'${deleteTarget?.shipOrderNo || ""}'${t("common.deleteConfirmSuffix", "을(를) 삭제하시겠습니까?")}`}
      />
      <ConfirmModal
        isOpen={!!confirmTarget}
        onClose={() => setConfirmTarget(null)}
        onConfirm={handleConfirmOrder}
        message={`'${confirmTarget?.shipOrderNo || ""}' ${t("shipping.shipOrder.confirmOrderMessage", "출하지시를 확정하시겠습니까? 확정 후에는 수정·삭제할 수 없습니다.")}`}
      />
      <PartSearchModal
        isOpen={isPartModalOpen}
        onClose={() => setIsPartModalOpen(false)}
        onSelect={addOrderItem}
        itemType="FINISHED"
      />
      {printTarget && (
        <div className="ship-order-print-root">
          <section className="mx-auto w-full max-w-[190mm] bg-white text-black">
            <div className="flex items-start justify-between border-b-2 border-black pb-4">
              <div>
                <h1 className="text-2xl font-bold tracking-normal">{t("shipping.shipOrder.printTitle", "출하지시서")}</h1>
                <p className="mt-2 text-sm text-gray-700">{t("shipping.shipOrder.printDate", "출력일")}: {new Date().toLocaleString()}</p>
              </div>
              <div className="flex items-center gap-4">
                <div className="bg-white p-2">
                  <QRCode value={printTarget.shipOrderNo} size={92} level="M" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-500">{t("shipping.shipOrder.shipOrderNo")}</p>
                  <p className="mt-1 font-mono text-xl font-bold">{printTarget.shipOrderNo}</p>
                </div>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
              <div className="flex border-b border-gray-300 pb-1">
                <span className="w-28 text-gray-500">{t("shipping.shipOrder.customer")}</span>
                <span className="font-semibold">{printTarget.customerName || "-"}</span>
              </div>
              <div className="flex border-b border-gray-300 pb-1">
                <span className="w-28 text-gray-500">{t("common.status")}</span>
                <span className="font-semibold">{printTarget.status || "-"}</span>
              </div>
              <div className="flex border-b border-gray-300 pb-1">
                <span className="w-28 text-gray-500">{t("shipping.shipOrder.dueDate")}</span>
                <span className="font-semibold">{printTarget.dueDate || "-"}</span>
              </div>
              <div className="flex border-b border-gray-300 pb-1">
                <span className="w-28 text-gray-500">{t("shipping.shipOrder.shipDate")}</span>
                <span className="font-semibold">{printTarget.shipDate || "-"}</span>
              </div>
              <div className="col-span-2 flex border-b border-gray-300 pb-1">
                <span className="w-28 text-gray-500">{t("common.remark")}</span>
                <span className="font-semibold">{printTarget.remark || "-"}</span>
              </div>
            </div>

            <table className="mt-6 w-full border-collapse text-sm">
              <thead>
                <tr className="border-y-2 border-black">
                  <th className="px-2 py-2 text-left">{t("common.partCode")}</th>
                  <th className="px-2 py-2 text-left">{t("common.partName")}</th>
                  <th className="px-2 py-2 text-center">{t("common.unit")}</th>
                  <th className="px-2 py-2 text-right">{t("pda.shipping.orderQty", "지시수량")}</th>
                  <th className="px-2 py-2 text-left">{t("common.remark")}</th>
                </tr>
              </thead>
              <tbody>
                {(printTarget.items ?? []).map((item) => (
                  <tr key={item.itemCode} className="border-b border-gray-300">
                    <td className="px-2 py-2 font-mono">{item.itemCode}</td>
                    <td className="px-2 py-2">{item.itemName || "-"}</td>
                    <td className="px-2 py-2 text-center">{item.unit || "-"}</td>
                    <td className="px-2 py-2 text-right">{Number(item.orderQty || 0).toLocaleString()}</td>
                    <td className="px-2 py-2">{item.remark || "-"}</td>
                  </tr>
                ))}
                {(printTarget.items ?? []).length === 0 && (
                  <tr className="border-b border-gray-300">
                    <td colSpan={5} className="px-2 py-8 text-center text-gray-500">
                      {t("shipping.shipOrder.noItems", "품목을 추가해 주세요.")}
                    </td>
                  </tr>
                )}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-black font-bold">
                  <td className="px-2 py-2" colSpan={3}>{t("common.totalQty")}</td>
                  <td className="px-2 py-2 text-right">{Number(printTarget.totalQty || 0).toLocaleString()}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </section>
        </div>
      )}
      <style jsx global>{`
        @media screen {
          .ship-order-print-root {
            display: none;
          }
        }

        @media print {
          @page {
            size: A4 portrait;
            margin: 12mm;
          }

          body * {
            visibility: hidden !important;
          }

          .ship-order-print-root,
          .ship-order-print-root * {
            visibility: visible !important;
          }

          .ship-order-print-root {
            display: block !important;
            position: absolute;
            inset: 0 auto auto 0;
            width: 100%;
            min-height: 100%;
            padding: 0;
            background: white;
            color: black;
          }
        }
      `}</style>
    </div>
  );
}
