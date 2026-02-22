"use client";

/**
 * @file src/app/(authenticated)/outsourcing/receive/page.tsx
 * @description 외주 입고 관리 페이지
 *
 * 초보자 가이드:
 * 1. **외주입고**: 외주처에서 가공 완료된 품목을 입고/검수하는 과정
 * 2. **검사결과**: PASS(합격), PARTIAL(부분불량), FAIL(불합격)
 * 3. API: GET/POST /outsourcing/receives
 */
import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Plus, RefreshCw, Search, Package, CheckCircle, XCircle, Layers } from "lucide-react";
import { Card, CardContent, Button, Input, Modal, Select, StatCard } from "@/components/ui";
import DataGrid from "@/components/data-grid/DataGrid";
import { ColumnDef } from "@tanstack/react-table";
import api from "@/services/api";

interface SubconReceive {
  id: string;
  receiveNo: string;
  orderNo: string;
  vendorName: string;
  partCode: string;
  partName: string;
  qty: number;
  goodQty: number;
  defectQty: number;
  inspectResult: string;
  receivedAt: string;
  workerName: string;
}

const inspectColors: Record<string, string> = {
  PASS: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  PARTIAL: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
  FAIL: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
};

export default function SubconReceivePage() {
  const { t } = useTranslation();
  const [data, setData] = useState<SubconReceive[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const inspectLabels: Record<string, string> = useMemo(() => ({
    PASS: t("outsourcing.receive.inspectPass"),
    PARTIAL: t("outsourcing.receive.inspectPartial"),
    FAIL: t("outsourcing.receive.inspectFail"),
  }), [t]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [form, setForm] = useState({ orderNo: "", qty: "", goodQty: "", defectQty: "", inspectResult: "PASS", remark: "" });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { limit: "5000" };
      if (searchTerm) params.search = searchTerm;
      const res = await api.get("/outsourcing/receives", { params });
      setData(res.data?.data ?? []);
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [searchTerm]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await api.post("/outsourcing/receives", form);
      setIsModalOpen(false);
      setForm({ orderNo: "", qty: "", goodQty: "", defectQty: "", inspectResult: "PASS", remark: "" });
      fetchData();
    } catch (e) {
      console.error("Save failed:", e);
    } finally {
      setSaving(false);
    }
  }, [form, fetchData]);

  const columns = useMemo<ColumnDef<SubconReceive>[]>(() => [
    { accessorKey: "receiveNo", header: t("outsourcing.receive.receiveNo"), size: 130, meta: { filterType: "text" as const } },
    { accessorKey: "orderNo", header: t("outsourcing.order.orderNo"), size: 130, meta: { filterType: "text" as const } },
    { accessorKey: "vendorName", header: t("outsourcing.order.vendor"), size: 130, meta: { filterType: "text" as const } },
    { accessorKey: "partCode", header: t("common.partCode"), size: 100, meta: { filterType: "text" as const } },
    { accessorKey: "partName", header: t("common.partName"), size: 130, meta: { filterType: "text" as const } },
    { accessorKey: "qty", header: t("outsourcing.receive.receiveQty"), size: 80, cell: ({ getValue }) => (getValue() as number).toLocaleString() },
    { accessorKey: "goodQty", header: t("outsourcing.receive.goodQty"), size: 80, cell: ({ getValue }) => <span className="text-green-600 dark:text-green-400">{(getValue() as number).toLocaleString()}</span> },
    {
      accessorKey: "defectQty", header: t("outsourcing.receive.defectQty"), size: 80,
      cell: ({ getValue }) => { const val = getValue() as number; return val > 0 ? <span className="text-red-600 dark:text-red-400">{val.toLocaleString()}</span> : "-"; },
    },
    {
      accessorKey: "inspectResult", header: t("outsourcing.receive.inspectResult"), size: 90,
      cell: ({ getValue }) => { const r = getValue() as string; return <span className={`px-2 py-1 text-xs rounded-full ${inspectColors[r]}`}>{inspectLabels[r]}</span>; },
    },
    { accessorKey: "receivedAt", header: t("outsourcing.receive.receiveDate"), size: 130 },
    { accessorKey: "workerName", header: t("outsourcing.receive.worker"), size: 80 },
  ], [t, inspectLabels]);

  const stats = useMemo(() => {
    const totalQty = data.reduce((sum, d) => sum + d.qty, 0);
    const totalGood = data.reduce((sum, d) => sum + d.goodQty, 0);
    const totalDefect = data.reduce((sum, d) => sum + d.defectQty, 0);
    return {
      count: data.length,
      totalQty,
      totalGood,
      totalDefect,
      defectRate: totalQty > 0 ? ((totalDefect / totalQty) * 100).toFixed(1) : "0.0",
    };
  }, [data]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2"><Package className="w-7 h-7 text-primary" />{t("outsourcing.receive.title")}</h1>
          <p className="text-text-muted mt-1">{t("outsourcing.receive.description")}</p>
        </div>
        <Button size="sm" onClick={() => setIsModalOpen(true)}>
          <Plus className="w-4 h-4 mr-1" /> {t("outsourcing.receive.register")}
        </Button>
      </div>

      <div className="grid grid-cols-4 gap-3">
        <StatCard label={t("outsourcing.receive.receiveCount")} value={stats.count} icon={Package} color="blue" />
        <StatCard label={t("outsourcing.receive.totalReceiveQty")} value={stats.totalQty.toLocaleString()} icon={Layers} color="purple" />
        <StatCard label={t("outsourcing.receive.goodQty")} value={stats.totalGood.toLocaleString()} icon={CheckCircle} color="green" />
        <StatCard label={t("outsourcing.receive.defectRate")} value={`${stats.defectRate}%`} icon={XCircle} color="red" />
      </div>

      <Card><CardContent>
        <DataGrid
          data={data}
          columns={columns}
          isLoading={loading}
          enableColumnFilter
          enableExport
          exportFileName={t("outsourcing.receive.title")}
          toolbarLeft={
            <div className="flex gap-3 flex-1 min-w-0">
              <div className="flex-1 min-w-0">
                <Input placeholder={t("outsourcing.receive.searchPlaceholder")} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} leftIcon={<Search className="w-4 h-4" />} fullWidth />
              </div>
              <Button variant="secondary" onClick={fetchData}>
                <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              </Button>
            </div>
          }
        />
      </CardContent></Card>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={t("outsourcing.receive.register")} size="lg">
        <div className="space-y-4">
          <Input label={t("outsourcing.order.orderNo")} placeholder="SCO20250127001" value={form.orderNo} onChange={(e) => setForm((p) => ({ ...p, orderNo: e.target.value }))} fullWidth />
          <Input label={t("outsourcing.receive.receiveQty")} type="number" placeholder="50" value={form.qty} onChange={(e) => setForm((p) => ({ ...p, qty: e.target.value }))} fullWidth />
          <div className="grid grid-cols-2 gap-4">
            <Input label={t("outsourcing.receive.goodQty")} type="number" placeholder="48" value={form.goodQty} onChange={(e) => setForm((p) => ({ ...p, goodQty: e.target.value }))} fullWidth />
            <Input label={t("outsourcing.receive.defectQty")} type="number" placeholder="2" value={form.defectQty} onChange={(e) => setForm((p) => ({ ...p, defectQty: e.target.value }))} fullWidth />
          </div>
          <Select label={t("outsourcing.receive.inspectResult")} options={[{ value: "PASS", label: t("outsourcing.receive.inspectPass") }, { value: "PARTIAL", label: t("outsourcing.receive.inspectPartial") }, { value: "FAIL", label: t("outsourcing.receive.inspectFail") }]} value={form.inspectResult} onChange={(v) => setForm((p) => ({ ...p, inspectResult: v }))} fullWidth />
          <Input label={t("common.remark")} placeholder={t("common.remarkPlaceholder")} value={form.remark} onChange={(e) => setForm((p) => ({ ...p, remark: e.target.value }))} fullWidth />
        </div>
        <div className="flex justify-end gap-2 pt-4 mt-4 border-t border-border">
          <Button variant="secondary" onClick={() => setIsModalOpen(false)}>{t("common.cancel")}</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? t("common.saving") : t("common.register")}</Button>
        </div>
      </Modal>
    </div>
  );
}
