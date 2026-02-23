"use client";

/**
 * @file src/app/(authenticated)/product/receive/page.tsx
 * @description 제품입고관리 페이지 - 반제품(WIP)/완제품(FG) 입고 등록 및 이력 조회
 *
 * 초보자 가이드:
 * 1. WIP/FG 탭 전환으로 품목유형 선택
 * 2. 입고등록 모달에서 품목, 창고, 수량, 작업지시번호 입력
 * 3. 입고 이력은 PRODUCT_TRANSACTIONS 테이블에서 조회
 * 4. StatCard로 금일 입고 통계 표시
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { PackageCheck, Plus, RefreshCw, Search, Hash, Package } from "lucide-react";
import { Card, CardContent, Button, Input, StatCard, Modal, Select } from "@/components/ui";
import DataGrid from "@/components/data-grid/DataGrid";
import { ColumnDef } from "@tanstack/react-table";
import { usePartOptions, useWarehouseOptions } from "@/hooks/useMasterOptions";
import api from "@/services/api";

interface ProductTransaction {
  id: string;
  transNo: string;
  transType: string;
  transDate: string;
  partId: string;
  partType: string;
  lotId: string | null;
  jobOrderId: string | null;
  processCode: string | null;
  qty: number;
  status: string;
  remark: string | null;
  part?: { partCode: string; partName: string; unit: string } | null;
  toWarehouse?: { warehouseName: string } | null;
}

const statusColors: Record<string, string> = {
  DONE: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
  CANCELED: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
};

export default function ProductReceivePage() {
  const { t } = useTranslation();

  const [activeTab, setActiveTab] = useState<"WIP" | "FG">("WIP");
  const [data, setData] = useState<ProductTransaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);

  // 모달 폼
  const [form, setForm] = useState({
    partId: "",
    warehouseId: "",
    qty: 1,
    jobOrderId: "",
    processCode: "",
    remark: "",
  });

  const { options: partOptions } = usePartOptions(activeTab);
  const { options: warehouseOptions } = useWarehouseOptions(activeTab);

  /** 입고 이력 조회 */
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const transType = activeTab === "WIP" ? "WIP_IN,WIP_IN_CANCEL" : "FG_IN,FG_IN_CANCEL";
      const res = await api.get("/inventory/product/transactions", {
        params: { transType, limit: 500 },
      });
      setData(res.data ?? []);
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => { fetchData(); }, [fetchData]);

  /** 통계 계산 */
  const stats = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const todayDone = data.filter(
      (d) => d.status === "DONE" && d.qty > 0 && String(d.transDate).slice(0, 10) === today
    );
    const wipCount = data.filter((d) => d.transType === "WIP_IN" && d.status === "DONE").length;
    const fgCount = data.filter((d) => d.transType === "FG_IN" && d.status === "DONE").length;
    return {
      todayCount: todayDone.length,
      todayQty: todayDone.reduce((sum, d) => sum + d.qty, 0),
      wipCount,
      fgCount,
    };
  }, [data]);

  /** 입고 처리 */
  const handleSubmit = useCallback(async () => {
    if (!form.partId || !form.warehouseId || form.qty < 1) return;
    setSaving(true);
    try {
      const endpoint = activeTab === "WIP" ? "/inventory/wip/receive" : "/inventory/fg/receive";
      await api.post(endpoint, {
        partId: form.partId,
        warehouseId: form.warehouseId,
        qty: form.qty,
        partType: activeTab,
        transType: activeTab === "WIP" ? "WIP_IN" : "FG_IN",
        jobOrderId: form.jobOrderId || undefined,
        processCode: form.processCode || undefined,
        remark: form.remark || undefined,
      });
      setIsModalOpen(false);
      setForm({ partId: "", warehouseId: "", qty: 1, jobOrderId: "", processCode: "", remark: "" });
      fetchData();
    } catch (e) {
      console.error("Receive failed:", e);
    } finally {
      setSaving(false);
    }
  }, [form, activeTab, fetchData]);

  const columns = useMemo<ColumnDef<ProductTransaction>[]>(() => [
    {
      accessorKey: "transDate", header: t("productMgmt.receive.col.transDate"), size: 100,
      cell: ({ getValue }) => String(getValue() ?? "").slice(0, 10),
    },
    {
      accessorKey: "transNo", header: t("productMgmt.receive.col.transNo"), size: 160,
      meta: { filterType: "text" as const },
      cell: ({ getValue }) => <span className="font-mono text-sm">{getValue() as string}</span>,
    },
    {
      accessorKey: "transType", header: t("common.type"), size: 90,
      cell: ({ getValue }) => {
        const v = getValue() as string;
        const isCancelType = v.includes("CANCEL");
        return (
          <span className={`px-2 py-0.5 rounded text-xs ${isCancelType ? "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300" : "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300"}`}>
            {v}
          </span>
        );
      },
    },
    {
      id: "partCode", header: t("common.partCode"), size: 120,
      meta: { filterType: "text" as const },
      cell: ({ row }) => <span className="font-mono text-sm">{row.original.part?.partCode || "-"}</span>,
    },
    {
      id: "partName", header: t("common.partName"), size: 150,
      meta: { filterType: "text" as const },
      cell: ({ row }) => row.original.part?.partName || "-",
    },
    {
      id: "warehouse", header: t("productMgmt.receive.col.warehouse"), size: 110,
      cell: ({ row }) => row.original.toWarehouse?.warehouseName || "-",
    },
    {
      accessorKey: "qty", header: t("common.quantity"), size: 90,
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
      accessorKey: "jobOrderId", header: t("productMgmt.receive.col.jobOrderId"), size: 130,
      meta: { filterType: "text" as const },
      cell: ({ getValue }) => <span className="font-mono text-sm">{(getValue() as string) || "-"}</span>,
    },
    {
      accessorKey: "status", header: t("common.status"), size: 80,
      cell: ({ getValue }) => {
        const s = getValue() as string;
        return <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusColors[s] || ""}`}>{s}</span>;
      },
    },
  ], [t]);

  const tabs = [
    { key: "WIP" as const, label: t("productMgmt.receive.tabWip") },
    { key: "FG" as const, label: t("productMgmt.receive.tabFg") },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* 헤더 */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2">
            <PackageCheck className="w-7 h-7 text-primary" />
            {t("productMgmt.receive.title")}
          </h1>
          <p className="text-text-muted mt-1">{t("productMgmt.receive.subtitle")}</p>
        </div>
        <Button onClick={() => setIsModalOpen(true)}>
          <Plus className="w-4 h-4 mr-1" />{t("productMgmt.receive.registerReceive")}
        </Button>
      </div>

      {/* StatCards */}
      <div className="grid grid-cols-4 gap-3">
        <StatCard label={t("productMgmt.receive.stats.todayCount")} value={stats.todayCount} icon={Hash} color="blue" />
        <StatCard label={t("productMgmt.receive.stats.todayQty")} value={stats.todayQty} icon={Package} color="green" />
        <StatCard label={t("productMgmt.receive.stats.wipCount")} value={stats.wipCount} icon={PackageCheck} color="yellow" />
        <StatCard label={t("productMgmt.receive.stats.fgCount")} value={stats.fgCount} icon={PackageCheck} color="purple" />
      </div>

      {/* 탭 */}
      <div className="flex gap-1 border-b border-border">
        {tabs.map((tab) => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.key
                ? "border-primary text-primary"
                : "border-transparent text-text-muted hover:text-text hover:border-border"
            }`}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* DataGrid */}
      <Card><CardContent>
        <DataGrid data={data} columns={columns} isLoading={loading} enableColumnFilter enableExport
          exportFileName={t("productMgmt.receive.title")}
          toolbarLeft={
            <div className="flex gap-3 flex-1 min-w-0">
              <div className="flex-1 min-w-0">
                <Input placeholder={t("common.search")} value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  leftIcon={<Search className="w-4 h-4" />} fullWidth />
              </div>
              <Button variant="secondary" onClick={fetchData}>
                <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              </Button>
            </div>
          } />
      </CardContent></Card>

      {/* 입고등록 모달 */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)}
        title={t("productMgmt.receive.modal.title")} size="lg">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-text mb-1">{t("productMgmt.receive.modal.partType")}</label>
              <div className="flex gap-2">
                {tabs.map((tab) => (
                  <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                    className={`flex-1 px-3 py-2 text-sm rounded-md border transition-colors ${
                      activeTab === tab.key
                        ? "bg-primary text-white border-primary"
                        : "bg-surface border-border text-text hover:bg-muted"
                    }`}>
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>
            <Select label={t("productMgmt.receive.modal.partId")} options={partOptions}
              value={form.partId} onChange={(v) => setForm({ ...form, partId: v })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Select label={t("productMgmt.receive.modal.warehouseId")} options={warehouseOptions}
              value={form.warehouseId} onChange={(v) => setForm({ ...form, warehouseId: v })} />
            <Input label={t("productMgmt.receive.modal.qty")} type="number" min={1}
              value={String(form.qty)} onChange={(e) => setForm({ ...form, qty: Number(e.target.value) })} fullWidth />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label={t("productMgmt.receive.modal.jobOrderId")}
              value={form.jobOrderId} onChange={(e) => setForm({ ...form, jobOrderId: e.target.value })} fullWidth />
            <Input label={t("productMgmt.receive.modal.processCode")}
              value={form.processCode} onChange={(e) => setForm({ ...form, processCode: e.target.value })} fullWidth />
          </div>
          <Input label={t("productMgmt.receive.modal.remark")}
            value={form.remark} onChange={(e) => setForm({ ...form, remark: e.target.value })} fullWidth />
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="secondary" onClick={() => setIsModalOpen(false)}>{t("common.cancel")}</Button>
            <Button onClick={handleSubmit} disabled={saving || !form.partId || !form.warehouseId}>
              {saving ? t("common.saving") : t("productMgmt.receive.modal.confirm")}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
