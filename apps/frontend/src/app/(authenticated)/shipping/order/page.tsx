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
  ClipboardList, Plus, Search, RefreshCw, Edit2, Trash2, X, Printer, HelpCircle, CheckCircle, RotateCcw,
} from "lucide-react";
import { Card, CardContent, Button, Input, Select, ComCodeBadge, ConfirmModal } from "@/components/ui";
import QtyInput from "@/components/shared/QtyInput";
import DateRangeFilter from "@/components/shared/DateRangeFilter";
import OpenIncludedNotice from "@/components/shared/OpenIncludedNotice";
import { getTodayLocal } from "@/utils/date";
import DataGrid from "@/components/data-grid/DataGrid";
import { useComCodeOptions } from "@/hooks/useComCode";
import { usePartnerOptions } from "@/hooks/useMasterOptions";
import PartSearchModal from "@/components/shared/PartSearchModal";
import type { PartItem } from "@/components/shared/PartSearchModal";
import api from "@/services/api";
import toast from "react-hot-toast";

/** Axios 에러에서 서버 메시지 추출 (없으면 fallback) */
const getApiErrorMessage = (e: unknown, fallback: string): string =>
  (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? fallback;

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
  customerPoNo?: string;
  dueDate: string;
  shipDate: string;
  status: string;
  itemCount: number;
  totalQty: number;
  remark: string;
  items?: ShipOrderLine[];
}

/** 상태 코드별 설명. 상태명(라벨)은 공통코드(SHIP_ORDER_STATUS)에서 실제 언어로 가져온다. */
const SHIP_ORDER_STATUS_DESC: Record<string, string> = {
  DRAFT: "출하지시 작성 중 상태입니다. 품목, 고객사, 출하일을 수정할 수 있습니다.",
  CONFIRMED: "출하지시가 확정되어 박스 또는 팔레트 출하 작업을 진행할 수 있습니다.",
  SHIPPING: "출하 작업이 진행 중인 상태입니다. 일부 물류 처리가 남아 있을 수 있습니다.",
  SHIPPED: "출하 처리가 완료된 상태입니다. 출하 이력과 수불이 기록되었습니다.",
  CLOSED: "출하지시 수량이 모두 처리되어 마감된 상태입니다.",
};

function ShipOrderStatusHeader() {
  const { t } = useTranslation();
  // 그리드 배지(ComCodeBadge)와 동일하게 공통코드 라벨을 사용 → 툴팁의 상태명이 실제 언어로 그리드와 일치
  const statusOptions = useComCodeOptions("SHIP_ORDER_STATUS");
  const helpText = useMemo(
    () =>
      statusOptions
        .map((opt) => {
          const desc = SHIP_ORDER_STATUS_DESC[opt.value];
          return desc ? `${opt.label}: ${desc}` : opt.label;
        })
        .join("\n"),
    [statusOptions],
  );

  return (
    <div className="flex items-center justify-center gap-1">
      <span>{t("common.status")}</span>
      <span
        className="inline-flex h-4 w-4 items-center justify-center rounded-full text-text-muted hover:bg-surface hover:text-primary"
        title={helpText}
        aria-label={helpText}
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
  // 작업 대상 목록 기본 필터: 당일 출하예정분 + 미완료(DRAFT/CONFIRMED/SHIPPING)는 기간 무관 항상 노출
  const [shipDateFrom, setShipDateFrom] = useState(getTodayLocal());
  const [shipDateTo, setShipDateTo] = useState(getTodayLocal());
  const [isFormPanelOpen, setIsFormPanelOpen] = useState(false);
  const [isPartModalOpen, setIsPartModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ShipOrder | null>(null);
  const [form, setForm] = useState({ customerId: "", customerPoNo: "", dueDate: "", shipDate: "", remark: "" });
  const [orderItems, setOrderItems] = useState<ShipOrderLine[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<ShipOrder | null>(null);
  const [printTarget, setPrintTarget] = useState<ShipOrder | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<ShipOrder | null>(null);
  const [unconfirmTarget, setUnconfirmTarget] = useState<ShipOrder | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [unconfirming, setUnconfirming] = useState(false);

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
      if (shipDateFrom) params.shipDateFrom = shipDateFrom;
      if (shipDateTo) params.shipDateTo = shipDateTo;
      // 상태 미지정 시 기간 밖이어도 미완료(작업 중) 지시는 항상 노출
      if (!statusFilter) params.includeOpen = "true";
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
  }, [searchText, statusFilter, shipDateFrom, shipDateTo]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const openCreate = useCallback(() => {
    setEditingItem(null);
    setForm({ customerId: "", customerPoNo: "", dueDate: "", shipDate: "", remark: "" });
    setOrderItems([]);
    setIsFormPanelOpen(true);
  }, []);

  const openEdit = useCallback((item: ShipOrder) => {
    setEditingItem(item);
    setForm({ customerId: item.customerId || "", customerPoNo: item.customerPoNo || "", dueDate: item.dueDate, shipDate: item.shipDate, remark: item.remark || "" });
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
  const canEditCurrentOrder = !editingItem || editingItem.status === "DRAFT";

  const shipOrderNoDisplay = editingItem
    ? { shipOrderNo: editingItem.shipOrderNo }
    : { shipOrderNo: t("common.autoGenerated", "자동생성") };

  // 기간(출하예정일) 밖이지만 미완료(SHIPPED 아님)라 includeOpen으로 포함된 행
  const outOfRangeNos = useMemo(() => {
    const set = new Set<string>();
    if (statusFilter) return set; // 상태 명시 시 includeOpen 미적용
    for (const o of data) {
      const d = (o.shipDate || "").slice(0, 10);
      const inRange = !!d && !!shipDateFrom && !!shipDateTo && d >= shipDateFrom && d <= shipDateTo;
      if (!inRange && o.status !== "SHIPPED") set.add(o.shipOrderNo);
    }
    return set;
  }, [data, statusFilter, shipDateFrom, shipDateTo]);

  const buildSavePayload = useCallback(() => ({
    customerId: form.customerId || undefined,
    customerPoNo: form.customerPoNo || undefined,
    dueDate: form.dueDate || undefined,
    shipDate: form.shipDate,
    remark: form.remark || undefined,
    items: orderItems.map((item) => ({
      itemCode: item.itemCode,
      orderQty: item.orderQty,
      remark: item.remark || undefined,
    })),
  }), [form, orderItems]);

  const handleSave = useCallback(async () => {
    if (!canSave || saving) return;
    setSaving(true);
    try {
      const payload = buildSavePayload();
      if (editingItem) {
        await api.put(`/shipping/orders/${editingItem.shipOrderNo}`, payload);
      } else {
        await api.post("/shipping/orders", payload);
      }
      setIsFormPanelOpen(false);
      fetchData();
    } catch (e) {
      console.error("Save failed:", e);
      toast.error(getApiErrorMessage(e, t("shipping.shipOrder.saveFailed", "저장에 실패했습니다.")));
    } finally {
      setSaving(false);
    }
  }, [buildSavePayload, canSave, editingItem, fetchData, saving]);

  const handleSaveAndConfirm = useCallback(async () => {
    if (!canSave || saving || confirming) return;
    setSaving(true);
    setConfirming(true);
    try {
      const payload = buildSavePayload();
      let createdOrderNo = editingItem?.shipOrderNo;
      if (editingItem) {
        await api.put(`/shipping/orders/${editingItem.shipOrderNo}`, payload);
      } else {
        const created = await api.post("/shipping/orders", payload);
        createdOrderNo = created.data?.data?.shipOrderNo ?? created.data?.shipOrderNo;
      }
      if (!createdOrderNo) {
        throw new Error("Missing created ship order number");
      }
      await api.put(`/shipping/orders/${createdOrderNo}/confirm`);
      setIsFormPanelOpen(false);
      fetchData();
    } catch (e) {
      console.error("Save and confirm failed:", e);
      toast.error(getApiErrorMessage(e, t("shipping.shipOrder.confirmFailed", "확정에 실패했습니다.")));
    } finally {
      setConfirming(false);
      setSaving(false);
    }
  }, [buildSavePayload, canSave, confirming, editingItem, fetchData, saving, t]);

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteTarget) return;
    if (deleteTarget.status !== "DRAFT") {
      setDeleteTarget(null);
      return;
    }
    try {
      await api.delete(`/shipping/orders/${deleteTarget.shipOrderNo}`);
      fetchData();
    } catch (e) {
      console.error("Delete failed:", e);
      toast.error(getApiErrorMessage(e, t("shipping.shipOrder.deleteFailed", "삭제에 실패했습니다.")));
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
      toast.error(getApiErrorMessage(e, t("shipping.shipOrder.confirmFailed", "확정에 실패했습니다.")));
    } finally {
      setConfirming(false);
    }
  }, [confirmTarget, closeFormPanel, fetchData]);

  const handleUnconfirmOrder = useCallback(async () => {
    if (!unconfirmTarget) return;
    setUnconfirming(true);
    try {
      await api.put(`/shipping/orders/${unconfirmTarget.shipOrderNo}/unconfirm`);
      setUnconfirmTarget(null);
      closeFormPanel();
      fetchData();
    } catch (e) {
      console.error("Unconfirm failed:", e);
      toast.error(getApiErrorMessage(e, t("shipping.shipOrder.unconfirmFailed", "확정취소에 실패했습니다.")));
    } finally {
      setUnconfirming(false);
    }
  }, [unconfirmTarget, closeFormPanel, fetchData]);

  const columns = useMemo<ColumnDef<ShipOrder>[]>(() => [
    { id: "actions", header: "", size: 168, meta: { align: "center" as const, filterType: "none" as const }, cell: ({ row }) => (
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
        {row.original.status === "CONFIRMED" && (
          <button
            onClick={() => setUnconfirmTarget(row.original)}
            className="p-1 hover:bg-surface rounded"
            title={t("shipping.shipOrder.unconfirmOrder", "확정취소")}
          >
            <RotateCcw className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          </button>
        )}
        <button onClick={() => openEdit(row.original)} className="p-1 hover:bg-surface rounded"><Edit2 className="w-4 h-4 text-primary" /></button>
        {row.original.status === "DRAFT" && (
          <button
            onClick={() => setDeleteTarget(row.original)}
            className="p-1 hover:bg-surface rounded"
            title={t("common.delete")}
          >
            <Trash2 className="w-4 h-4 text-red-500" />
          </button>
        )}
      </div>
    ) },
    { accessorKey: "shipOrderNo", header: t("shipping.shipOrder.shipOrderNo"), size: 160, meta: { filterType: "text" as const } },
    { accessorKey: "customerName", header: t("shipping.shipOrder.customer"), size: 120, meta: { filterType: "text" as const } },
    { accessorKey: "customerPoNo", header: t("shipping.shipOrder.customerPoNo", "고객 PO번호"), size: 140, meta: { filterType: "text" as const }, cell: ({ getValue }) => (getValue() as string) || "-" },
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
        <OpenIncludedNotice count={outOfRangeNos.size} />
        <Card className="flex-1 min-h-0 overflow-hidden" padding="none"><CardContent className="h-full p-4">
          <DataGrid data={data} columns={columns} isLoading={loading} enableColumnFilter
            rowClassName={(row) => outOfRangeNos.has(row.shipOrderNo) ? "border-l-2 border-l-amber-500" : ""}
            enableExport exportFileName={t("shipping.shipOrder.title")}
            toolbarLeft={
              <div className="flex gap-3 flex-1 min-w-0 items-center flex-wrap">
                <DateRangeFilter
                  from={shipDateFrom}
                  to={shipDateTo}
                  onFromChange={setShipDateFrom}
                  onToChange={setShipDateTo}
                  label={t("shipping.shipOrder.shipDate")}
                />
                <div className="flex-1 min-w-[12rem]">
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

          {/* 액션 버튼 — 상단 표준 배치 */}
          <div className="flex flex-wrap justify-end gap-2 border-b border-border px-4 py-3">
            <Button variant="secondary" onClick={closeFormPanel}>{t("common.cancel")}</Button>
            {canEditCurrentOrder && (
              <Button
                variant="secondary"
                className="border-green-500 text-green-600 dark:text-green-400"
                onClick={handleSaveAndConfirm}
                disabled={!canSave || saving || confirming}
                title={orderItems.length === 0 ? t("shipping.shipOrder.confirmNeedItems", "품목이 있어야 확정할 수 있습니다.") : undefined}
              >
                <CheckCircle className="w-4 h-4 mr-1" />
                {t("shipping.shipOrder.saveAndConfirm", "저장 후 확정")}
              </Button>
            )}
            {editingItem && editingItem.status === "CONFIRMED" && (
              <Button
                variant="secondary"
                className="border-amber-500 text-amber-600 dark:text-amber-400"
                onClick={() => setUnconfirmTarget(editingItem)}
                disabled={saving || unconfirming}
              >
                <RotateCcw className="w-4 h-4 mr-1" />
                {t("shipping.shipOrder.unconfirmOrder", "확정취소")}
              </Button>
            )}
            <Button onClick={handleSave} disabled={!canEditCurrentOrder || !canSave || saving}>
              {saving ? t("common.saving") : t("common.save", "저장")}
            </Button>
          </div>

          <div className="flex min-h-0 flex-1 flex-col">
              <div className="min-h-0 flex-1 space-y-4 overflow-auto p-4">
                <div className="grid grid-cols-2 gap-3">
                  <Input label={t("shipping.shipOrder.shipOrderNo")} placeholder={t("common.autoGenerated", "자동생성")}
                    value={shipOrderNoDisplay.shipOrderNo} disabled fullWidth />
                  <Select label={t("shipping.shipOrder.customer")} options={customerOptions}
                    value={form.customerId} onChange={v => setForm(p => ({ ...p, customerId: v }))} fullWidth />
                  <Input label={t("shipping.shipOrder.customerPoNo", "고객 PO번호")}
                    placeholder={t("shipping.shipOrder.customerPoNoPlaceholder", "고객 PO번호 입력")}
                    value={form.customerPoNo} onChange={e => setForm(p => ({ ...p, customerPoNo: e.target.value }))} maxLength={100} fullWidth />
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
                          <QtyInput
                            value={item.orderQty || 0}
                            onChange={(n) => updateOrderItem(item.itemCode, "orderQty", n)}
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
      <ConfirmModal
        isOpen={!!unconfirmTarget}
        onClose={() => setUnconfirmTarget(null)}
        onConfirm={handleUnconfirmOrder}
        message={`'${unconfirmTarget?.shipOrderNo || ""}' ${t("shipping.shipOrder.unconfirmOrderMessage", "출하지시 확정을 취소하고 작성중(DRAFT) 상태로 되돌리시겠습니까? 출하수량 또는 배정된 박스/팔레트가 있으면 처리되지 않습니다.")}`}
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
                <span className="w-28 text-gray-500">{t("shipping.shipOrder.customerPoNo", "고객 PO번호")}</span>
                <span className="font-semibold">{printTarget.customerPoNo || "-"}</span>
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
