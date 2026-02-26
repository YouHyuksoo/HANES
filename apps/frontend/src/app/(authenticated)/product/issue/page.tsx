"use client";

/**
 * @file src/app/(authenticated)/product/issue/page.tsx
 * @description 제품출고관리 페이지 - 반제품/완제품 출고 처리 (폐기, 창고이동, 기타)
 *
 * 초보자 가이드:
 * 1. 출고 이력 DataGrid: WIP_OUT, FG_OUT, WIP_OUT_CANCEL, FG_OUT_CANCEL 조회
 * 2. 출고등록 모달: 품목유형(WIP/FG) 선택 → 재고에서 품목 선택 → 출고계정(ISSUE_TYPE) 필수
 * 3. StatCards: 금일 출고건수/수량, WIP/FG 출고 건수
 * 4. API: POST /inventory/wip/issue 또는 POST /inventory/fg/issue
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  PackageX, RefreshCw, Search, Hash, Package, ClipboardPlus,
} from "lucide-react";
import { Card, CardContent, Button, Input, StatCard, Modal, Select } from "@/components/ui";
import ComCodeBadge from "@/components/ui/ComCodeBadge";
import DataGrid from "@/components/data-grid/DataGrid";
import { ColumnDef } from "@tanstack/react-table";
import api from "@/services/api";
import { useComCodeOptions } from "@/hooks/useComCode";
import { useWarehouseOptions, usePartOptions } from "@/hooks/useMasterOptions";

interface ProductIssueTx {
  id: string;
  transNo: string;
  transType: string;
  transDate: string;
  itemCode: string;
  itemType: string | null;
  qty: number;
  status: string;
  issueType: string | null;
  remark: string | null;
  cancelRefId: string | null;
  part?: { itemCode: string; itemName: string; unit: string } | null;
  fromWarehouse?: { warehouseName: string } | null;
}

interface ProductStockItem {
  id: string;
  itemCode: string;
  itemName: string | null;
  warehouseCode: string;
  warehouseName: string | null;
  availableQty: number;
  unit: string | null;
}

const statusColors: Record<string, string> = {
  DONE: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
  CANCELED: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
};

const INITIAL_FORM = {
  itemCode: "",
  warehouseCode: "",
  qty: 1,
  issueType: "",
  remark: "",
};

export default function ProductIssuePage() {
  const { t } = useTranslation();

  const [data, setData] = useState<ProductIssueTx[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState(() => new Date().toISOString().slice(0, 10));

  /* 출고 모달 */
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalPartType, setModalPartType] = useState<"WIP" | "FG">("WIP");
  const [form, setForm] = useState(INITIAL_FORM);
  const [saving, setSaving] = useState(false);
  const [stocks, setStocks] = useState<ProductStockItem[]>([]);

  const issueTypeOptions = useComCodeOptions("ISSUE_TYPE");
  const { options: warehouseOptions } = useWarehouseOptions(modalPartType);
  const { options: partOptions } = usePartOptions(modalPartType);

  /** 출고 이력 조회 */
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {
        transType: "WIP_OUT,FG_OUT,WIP_OUT_CANCEL,FG_OUT_CANCEL",
        limit: "5000",
      };
      if (startDate) params.dateFrom = startDate;
      if (endDate) params.dateTo = endDate;
      const res = await api.get("/inventory/product/transactions", { params });
      const list = res.data?.data ?? res.data;
      setData(Array.isArray(list) ? list : []);
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => { fetchData(); }, [fetchData]);

  /** 가용재고 조회 (모달용) */
  const fetchStocks = useCallback(async (partType: string) => {
    try {
      const res = await api.get("/inventory/product/stock", {
        params: { itemType: partType, includeZero: false },
      });
      const list = res.data?.data ?? res.data;
      setStocks(Array.isArray(list) ? list.filter((s: ProductStockItem) => s.availableQty > 0) : []);
    } catch {
      setStocks([]);
    }
  }, []);

  /** 모달 열기 */
  const openModal = useCallback(() => {
    setForm(INITIAL_FORM);
    setModalPartType("WIP");
    fetchStocks("WIP");
    setIsModalOpen(true);
  }, [fetchStocks]);

  /** 품목유형 전환 */
  const handlePartTypeChange = useCallback((type: "WIP" | "FG") => {
    setModalPartType(type);
    setForm((prev) => ({ ...prev, itemCode: "", warehouseCode: "" }));
    fetchStocks(type);
  }, [fetchStocks]);

  /** 품목 선택 시 해당 창고 자동 설정 */
  const handlePartChange = useCallback((itemCode: string) => {
    const stock = stocks.find((s) => s.itemCode === itemCode);
    setForm((prev) => ({
      ...prev,
      itemCode,
      warehouseCode: stock?.warehouseCode || "",
      qty: Math.min(prev.qty, stock?.availableQty || 1),
    }));
  }, [stocks]);

  /** 선택된 품목의 가용수량 */
  const selectedStock = useMemo(
    () => stocks.find((s) => s.itemCode === form.itemCode && s.warehouseCode === form.warehouseCode),
    [stocks, form.itemCode, form.warehouseCode],
  );

  /** 재고 기반 품목 옵션 */
  const stockPartOptions = useMemo(() => {
    const seen = new Set<string>();
    return stocks
      .filter((s) => { if (seen.has(s.itemCode)) return false; seen.add(s.itemCode); return true; })
      .map((s) => ({ value: s.itemCode, label: `${s.itemCode} - ${s.itemName || ""}` }));
  }, [stocks]);

  /** 선택된 품목의 창고 옵션 */
  const stockWarehouseOptions = useMemo(
    () => stocks
      .filter((s) => s.itemCode === form.itemCode)
      .map((s) => ({
        value: s.warehouseCode,
        label: `${s.warehouseName || s.warehouseCode} (${t("common.available")}: ${s.availableQty})`,
      })),
    [stocks, form.itemCode, t],
  );

  /** 출고 처리 */
  const handleSubmit = useCallback(async () => {
    if (!form.itemCode || !form.warehouseCode || !form.issueType || form.qty < 1) return;
    setSaving(true);
    try {
      const endpoint = modalPartType === "WIP" ? "/inventory/wip/issue" : "/inventory/fg/issue";
      await api.post(endpoint, {
        itemCode: form.itemCode,
        warehouseCode: form.warehouseCode,
        qty: form.qty,
        itemType: modalPartType,
        transType: modalPartType === "WIP" ? "WIP_OUT" : "FG_OUT",
        issueType: form.issueType,
        remark: form.remark || undefined,
      });
      setForm(INITIAL_FORM);
      setIsModalOpen(false);
      fetchData();
    } catch (e) {
      console.error("Issue failed:", e);
    } finally {
      setSaving(false);
    }
  }, [form, modalPartType, fetchData]);

  /** 통계 */
  const stats = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const todayDone = data.filter(
      (d) => (d.transType === "WIP_OUT" || d.transType === "FG_OUT") &&
        d.status === "DONE" && String(d.transDate).slice(0, 10) === today,
    );
    return {
      todayCount: todayDone.length,
      todayQty: todayDone.reduce((sum, d) => sum + Math.abs(d.qty), 0),
      wipCount: data.filter((d) => d.transType === "WIP_OUT" && d.status === "DONE").length,
      fgCount: data.filter((d) => d.transType === "FG_OUT" && d.status === "DONE").length,
    };
  }, [data]);

  const tabs = [
    { key: "WIP" as const, label: t("productMgmt.receive.tabWip") },
    { key: "FG" as const, label: t("productMgmt.receive.tabFg") },
  ];

  const columns = useMemo<ColumnDef<ProductIssueTx>[]>(() => [
    {
      accessorKey: "transDate", header: t("productMgmt.issue.col.transDate"), size: 100,
      meta: { filterType: "text" as const },
      cell: ({ getValue }) => String(getValue() ?? "").slice(0, 10),
    },
    {
      accessorKey: "transNo", header: t("productMgmt.issue.col.transNo"), size: 160,
      meta: { filterType: "text" as const },
      cell: ({ getValue }) => <span className="font-mono text-sm">{getValue() as string}</span>,
    },
    {
      accessorKey: "transType", header: t("common.type"), size: 110,
      cell: ({ getValue }) => {
        const v = getValue() as string;
        const isCancelType = v.includes("CANCEL");
        return (
          <span className={`px-2 py-0.5 rounded text-xs ${isCancelType ? "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300" : "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300"}`}>
            {v}
          </span>
        );
      },
    },
    {
      id: "partCode", header: t("common.partCode"), size: 120,
      meta: { filterType: "text" as const },
      cell: ({ row }) => <span className="font-mono text-sm">{row.original.part?.itemCode || "-"}</span>,
    },
    {
      id: "partName", header: t("common.partName"), size: 150,
      meta: { filterType: "text" as const },
      cell: ({ row }) => row.original.part?.itemName || "-",
    },
    {
      id: "warehouse", header: t("productMgmt.issue.col.warehouse"), size: 110,
      cell: ({ row }) => row.original.fromWarehouse?.warehouseName || "-",
    },
    {
      accessorKey: "issueType", header: t("productMgmt.issue.col.issueType"), size: 110,
      cell: ({ getValue }) => {
        const v = getValue() as string | null;
        return v ? <ComCodeBadge groupCode="ISSUE_TYPE" code={v} /> : <span className="text-text-muted">-</span>;
      },
    },
    {
      accessorKey: "qty", header: t("common.quantity"), size: 100,
      meta: { align: "right" as const },
      cell: ({ row }) => {
        const q = row.original.qty;
        const color = q > 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400";
        return (
          <span className={`font-medium ${color}`}>
            {q > 0 ? "+" : ""}{q.toLocaleString()} {row.original.part?.unit || ""}
          </span>
        );
      },
    },
    {
      accessorKey: "status", header: t("common.status"), size: 80,
      cell: ({ getValue }) => {
        const s = getValue() as string;
        return <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusColors[s] || ""}`}>{s}</span>;
      },
    },
  ], [t]);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* 헤더 */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2">
            <PackageX className="w-7 h-7 text-primary" />
            {t("productMgmt.issue.title")}
          </h1>
          <p className="text-text-muted mt-1">{t("productMgmt.issue.subtitle")}</p>
        </div>
        <Button onClick={openModal}>
          <ClipboardPlus className="w-4 h-4 mr-1" />
          {t("productMgmt.issue.registerIssue")}
        </Button>
      </div>

      {/* StatCards */}
      <div className="grid grid-cols-4 gap-3">
        <StatCard label={t("productMgmt.issue.stats.todayCount")} value={stats.todayCount} icon={Hash} color="blue" />
        <StatCard label={t("productMgmt.issue.stats.todayQty")} value={stats.todayQty} icon={Package} color="green" />
        <StatCard label={t("productMgmt.issue.stats.wipCount")} value={stats.wipCount} icon={PackageX} color="yellow" />
        <StatCard label={t("productMgmt.issue.stats.fgCount")} value={stats.fgCount} icon={PackageX} color="purple" />
      </div>

      {/* DataGrid */}
      <Card><CardContent>
        <DataGrid data={data} columns={columns} isLoading={loading} enableColumnFilter enableExport
          exportFileName={t("productMgmt.issue.title")}
          toolbarLeft={
            <div className="flex gap-3 flex-1 min-w-0">
              <div className="flex-1 min-w-0">
                <Input placeholder={t("productMgmt.issueCancel.searchPlaceholder")}
                  value={searchText} onChange={(e) => setSearchText(e.target.value)}
                  leftIcon={<Search className="w-4 h-4" />} fullWidth />
              </div>
              <div className="w-36 flex-shrink-0">
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} fullWidth />
              </div>
              <div className="w-36 flex-shrink-0">
                <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} fullWidth />
              </div>
              <Button variant="secondary" onClick={fetchData}>
                <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              </Button>
            </div>
          } />
      </CardContent></Card>

      {/* 출고등록 모달 */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)}
        title={t("productMgmt.issue.modal.title")} size="lg">
        <div className="space-y-4">
          {/* 품목유형 */}
          <div>
            <label className="block text-sm font-medium text-text mb-1">
              {t("productMgmt.issue.modal.partType")}
            </label>
            <div className="flex gap-2">
              {tabs.map((tab) => (
                <button key={tab.key} onClick={() => handlePartTypeChange(tab.key)}
                  className={`flex-1 px-3 py-2 text-sm rounded-md border transition-colors ${
                    modalPartType === tab.key
                      ? "bg-primary text-white border-primary"
                      : "bg-surface border-border text-text hover:bg-muted"
                  }`}>
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Select label={t("productMgmt.issue.modal.partId")}
              options={stockPartOptions} value={form.itemCode}
              onChange={handlePartChange} />
            <Select label={t("productMgmt.issue.modal.warehouseId")}
              options={stockWarehouseOptions} value={form.warehouseCode}
              onChange={(v) => setForm({ ...form, warehouseCode: v })} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input label={t("productMgmt.issue.modal.qty")} type="number" min={1}
              max={selectedStock?.availableQty || 99999}
              value={String(form.qty)}
              onChange={(e) => setForm({ ...form, qty: Number(e.target.value) })} fullWidth />
            <Select label={`${t("productMgmt.issue.modal.issueType")} *`}
              options={issueTypeOptions} value={form.issueType}
              onChange={(v) => setForm({ ...form, issueType: v })} required />
          </div>

          {selectedStock && (
            <div className="text-sm text-text-muted">
              {t("common.available")}: <span className="font-bold text-text">{selectedStock.availableQty.toLocaleString()}</span> {selectedStock.unit || ""}
            </div>
          )}

          <Input label={t("productMgmt.issue.modal.remark")} value={form.remark}
            onChange={(e) => setForm({ ...form, remark: e.target.value })} fullWidth />

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="secondary" onClick={() => setIsModalOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button onClick={handleSubmit}
              disabled={saving || !form.itemCode || !form.warehouseCode || !form.issueType}>
              {saving ? t("common.saving") : t("productMgmt.issue.modal.confirm")}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
