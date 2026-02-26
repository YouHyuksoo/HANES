"use client";

/**
 * @file src/app/(authenticated)/outsourcing/order/page.tsx
 * @description 외주발주 관리 페이지
 *
 * 초보자 가이드:
 * 1. **외주발주**: 외주처에 가공/제조를 의뢰하는 발주서 관리
 * 2. **상태 흐름**: ORDERED -> DELIVERED -> PARTIAL_RECV -> RECEIVED -> CLOSED
 * 3. API: GET/POST/PUT /outsourcing/orders
 */
import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Plus, Eye, RefreshCw, Search, FileText, Truck, Package, CheckCircle } from "lucide-react";
import { Card, CardContent, Button, Input, Modal, Select, StatCard } from "@/components/ui";
import DataGrid from "@/components/data-grid/DataGrid";
import { ColumnDef } from "@tanstack/react-table";
import api from "@/services/api";

interface SubconOrder {
  id: string;
  orderNo: string;
  vendorName: string;
  itemCode: string;
  itemName: string;
  orderQty: number;
  deliveredQty: number;
  receivedQty: number;
  defectQty: number;
  orderDate: string;
  dueDate: string;
  status: string;
}

const statusColors: Record<string, string> = {
  ORDERED: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  DELIVERED: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
  PARTIAL_RECV: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
  RECEIVED: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  CLOSED: "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300",
  CANCELED: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
};

export default function SubconOrderPage() {
  const { t } = useTranslation();
  const [data, setData] = useState<SubconOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const statusLabels: Record<string, string> = useMemo(() => ({
    ORDERED: t("outsourcing.order.statusOrdered"),
    DELIVERED: t("outsourcing.order.statusDelivered"),
    PARTIAL_RECV: t("outsourcing.order.statusPartialRecv"),
    RECEIVED: t("outsourcing.order.statusReceived"),
    CLOSED: t("outsourcing.order.statusClosed"),
    CANCELED: t("common.cancel"),
  }), [t]);

  const statusOptions = useMemo(() => [
    { value: "", label: t("common.allStatus") },
    { value: "ORDERED", label: t("outsourcing.order.statusOrdered") },
    { value: "DELIVERED", label: t("outsourcing.order.statusDelivered") },
    { value: "PARTIAL_RECV", label: t("outsourcing.order.statusPartialRecv") },
    { value: "RECEIVED", label: t("outsourcing.order.statusReceived") },
  ], [t]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<SubconOrder | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [form, setForm] = useState({ vendorId: "", itemCode: "", itemName: "", orderQty: "", dueDate: "", remark: "" });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { limit: "5000" };
      if (searchTerm) params.search = searchTerm;
      if (statusFilter) params.status = statusFilter;
      const res = await api.get("/outsourcing/orders", { params });
      setData(res.data?.data ?? []);
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [searchTerm, statusFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await api.post("/outsourcing/orders", form);
      setIsModalOpen(false);
      setForm({ vendorId: "", itemCode: "", itemName: "", orderQty: "", dueDate: "", remark: "" });
      fetchData();
    } catch (e) {
      console.error("Save failed:", e);
    } finally {
      setSaving(false);
    }
  }, [form, fetchData]);

  const columns = useMemo<ColumnDef<SubconOrder>[]>(() => [
    { accessorKey: "orderNo", header: t("outsourcing.order.orderNo"), size: 130, meta: { filterType: "text" as const } },
    { accessorKey: "vendorName", header: t("outsourcing.order.vendor"), size: 130, meta: { filterType: "text" as const } },
    { accessorKey: "itemCode", header: t("common.partCode"), size: 100, meta: { filterType: "text" as const } },
    { accessorKey: "itemName", header: t("common.partName"), size: 130, meta: { filterType: "text" as const } },
    { accessorKey: "orderQty", header: t("outsourcing.order.orderQty"), size: 80, cell: ({ getValue }) => (getValue() as number).toLocaleString() },
    { accessorKey: "deliveredQty", header: t("outsourcing.order.deliveredQty"), size: 80, cell: ({ getValue }) => (getValue() as number).toLocaleString() },
    { accessorKey: "receivedQty", header: t("outsourcing.order.receivedQty"), size: 80, cell: ({ getValue }) => (getValue() as number).toLocaleString() },
    { accessorKey: "orderDate", header: t("outsourcing.order.orderDate"), size: 100 },
    { accessorKey: "dueDate", header: t("outsourcing.order.dueDate"), size: 100 },
    {
      accessorKey: "status", header: t("common.status"), size: 90,
      cell: ({ getValue }) => {
        const status = getValue() as string;
        return <span className={`px-2 py-1 text-xs rounded-full ${statusColors[status]}`}>{statusLabels[status]}</span>;
      },
    },
    {
      id: "actions", header: t("common.manage"), size: 70,
      cell: ({ row }) => (
        <button onClick={() => { setSelectedOrder(row.original); setIsDetailModalOpen(true); }} className="p-1 hover:bg-surface rounded">
          <Eye className="w-4 h-4 text-primary" />
        </button>
      ),
    },
  ], [t, statusLabels]);

  const stats = useMemo(() => ({
    ordered: data.filter((d) => d.status === "ORDERED").length,
    delivered: data.filter((d) => d.status === "DELIVERED").length,
    pending: data.filter((d) => ["DELIVERED", "PARTIAL_RECV"].includes(d.status)).length,
    received: data.filter((d) => d.status === "RECEIVED").length,
  }), [data]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2"><FileText className="w-7 h-7 text-primary" />{t("outsourcing.order.title")}</h1>
          <p className="text-text-muted mt-1">{t("outsourcing.order.description")}</p>
        </div>
        <Button size="sm" onClick={() => setIsModalOpen(true)}>
          <Plus className="w-4 h-4 mr-1" /> {t("outsourcing.order.register")}
        </Button>
      </div>

      <div className="grid grid-cols-4 gap-3">
        <StatCard label={t("outsourcing.order.statusOrdered")} value={stats.ordered} icon={FileText} color="blue" />
        <StatCard label={t("outsourcing.order.statusDelivered")} value={stats.delivered} icon={Truck} color="purple" />
        <StatCard label={t("outsourcing.order.pendingReceive")} value={stats.pending} icon={Package} color="yellow" />
        <StatCard label={t("outsourcing.order.statusReceived")} value={stats.received} icon={CheckCircle} color="green" />
      </div>

      <Card><CardContent>
        <DataGrid
          data={data}
          columns={columns}
          isLoading={loading}
          enableColumnFilter
          enableExport
          exportFileName={t("outsourcing.order.title")}
          toolbarLeft={
            <div className="flex gap-3 flex-1 min-w-0">
              <div className="flex-1 min-w-0">
                <Input placeholder={t("outsourcing.order.searchPlaceholder")} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} leftIcon={<Search className="w-4 h-4" />} fullWidth />
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

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={t("outsourcing.order.register")} size="lg">
        <div className="space-y-4">
          <Input label={t("common.partCode")} placeholder="WH-001" value={form.itemCode} onChange={(e) => setForm((p) => ({ ...p, itemCode: e.target.value }))} fullWidth />
          <Input label={t("common.partName")} placeholder="" value={form.itemName} onChange={(e) => setForm((p) => ({ ...p, itemName: e.target.value }))} fullWidth />
          <Input label={t("outsourcing.order.orderQty")} type="number" placeholder="1000" value={form.orderQty} onChange={(e) => setForm((p) => ({ ...p, orderQty: e.target.value }))} fullWidth />
          <Input label={t("outsourcing.order.dueDate")} type="date" value={form.dueDate} onChange={(e) => setForm((p) => ({ ...p, dueDate: e.target.value }))} fullWidth />
          <Input label={t("common.remark")} placeholder={t("common.remarkPlaceholder")} value={form.remark} onChange={(e) => setForm((p) => ({ ...p, remark: e.target.value }))} fullWidth />
        </div>
        <div className="flex justify-end gap-2 pt-4 mt-4 border-t border-border">
          <Button variant="secondary" onClick={() => setIsModalOpen(false)}>{t("common.cancel")}</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? t("common.saving") : t("common.register")}</Button>
        </div>
      </Modal>

      <Modal isOpen={isDetailModalOpen} onClose={() => setIsDetailModalOpen(false)} title={`${t("outsourcing.order.detail")} - ${selectedOrder?.orderNo}`} size="lg">
        {selectedOrder && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div><p className="text-sm text-text-muted">{t("outsourcing.order.vendor")}</p><p className="font-medium text-text">{selectedOrder.vendorName}</p></div>
              <div><p className="text-sm text-text-muted">{t("common.part")}</p><p className="font-medium text-text">{selectedOrder.itemCode} - {selectedOrder.itemName}</p></div>
              <div><p className="text-sm text-text-muted">{t("outsourcing.order.orderDate")}</p><p className="font-medium text-text">{selectedOrder.orderDate}</p></div>
              <div><p className="text-sm text-text-muted">{t("outsourcing.order.dueDate")}</p><p className="font-medium text-text">{selectedOrder.dueDate}</p></div>
            </div>
            <div className="grid grid-cols-4 gap-4 p-4 bg-surface rounded-lg">
              <div className="text-center"><p className="text-sm text-text-muted">{t("outsourcing.order.orderQty")}</p><p className="text-lg font-bold leading-tight text-text">{selectedOrder.orderQty.toLocaleString()}</p></div>
              <div className="text-center"><p className="text-sm text-text-muted">{t("outsourcing.order.deliveredQty")}</p><p className="text-lg font-bold leading-tight text-purple-600 dark:text-purple-400">{selectedOrder.deliveredQty.toLocaleString()}</p></div>
              <div className="text-center"><p className="text-sm text-text-muted">{t("outsourcing.order.receivedQty")}</p><p className="text-lg font-bold leading-tight text-green-600 dark:text-green-400">{selectedOrder.receivedQty.toLocaleString()}</p></div>
              <div className="text-center"><p className="text-sm text-text-muted">{t("outsourcing.order.defectQty")}</p><p className="text-lg font-bold leading-tight text-red-600 dark:text-red-400">{selectedOrder.defectQty.toLocaleString()}</p></div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
