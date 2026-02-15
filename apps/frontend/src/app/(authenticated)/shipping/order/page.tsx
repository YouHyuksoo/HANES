"use client";

/**
 * @file src/app/(authenticated)/shipping/order/page.tsx
 * @description 출하지시등록 페이지 - 출하지시 CRUD 및 품목 관리
 *
 * 초보자 가이드:
 * 1. **출하지시**: 고객사에 출하할 품목과 수량을 지정하는 지시서
 * 2. **상태 흐름**: DRAFT -> CONFIRMED -> SHIPPING -> SHIPPED
 * 3. **품목**: 하나의 출하지시에 여러 품목이 포함될 수 있음
 */
import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { ColumnDef } from "@tanstack/react-table";
import {
  ClipboardList, Plus, Search, RefreshCw, Edit2, Trash2,
  FileText, Clock, CheckCircle, Truck,
} from "lucide-react";
import { Card, CardContent, Button, Input, Modal, Select, StatCard, ComCodeBadge } from "@/components/ui";
import DataGrid from "@/components/data-grid/DataGrid";
import { useComCodeOptions } from "@/hooks/useComCode";
import { usePartnerOptions } from "@/hooks/useMasterOptions";

interface ShipOrder {
  id: string;
  shipOrderNo: string;
  customerName: string;
  dueDate: string;
  shipDate: string;
  status: string;
  itemCount: number;
  totalQty: number;
}


const mockData: ShipOrder[] = [
  { id: "1", shipOrderNo: "SO-20250201-001", customerName: "현대자동차", dueDate: "2025-02-05", shipDate: "2025-02-03", status: "DRAFT", itemCount: 3, totalQty: 1500 },
  { id: "2", shipOrderNo: "SO-20250201-002", customerName: "기아자동차", dueDate: "2025-02-07", shipDate: "2025-02-06", status: "CONFIRMED", itemCount: 2, totalQty: 800 },
  { id: "3", shipOrderNo: "SO-20250130-001", customerName: "GM코리아", dueDate: "2025-02-03", shipDate: "2025-02-02", status: "SHIPPING", itemCount: 4, totalQty: 2000 },
  { id: "4", shipOrderNo: "SO-20250128-001", customerName: "현대자동차", dueDate: "2025-01-31", shipDate: "2025-01-30", status: "SHIPPED", itemCount: 2, totalQty: 1200 },
];

function ShipOrderPage() {
  const { t } = useTranslation();
  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ShipOrder | null>(null);

  const comCodeStatusOptions = useComCodeOptions("SHIP_ORDER_STATUS");
  const { options: customerOptions } = usePartnerOptions("CUSTOMER");
  const statusOptions = [{ value: "", label: t("common.allStatus") }, ...comCodeStatusOptions];

  const filteredData = useMemo(() => mockData.filter((item) => {
    const matchSearch = !searchText || item.shipOrderNo.toLowerCase().includes(searchText.toLowerCase()) || item.customerName.toLowerCase().includes(searchText.toLowerCase());
    return matchSearch && (!statusFilter || item.status === statusFilter);
  }), [searchText, statusFilter]);

  const stats = useMemo(() => ({
    total: mockData.length, draft: mockData.filter((d) => d.status === "DRAFT").length,
    confirmed: mockData.filter((d) => d.status === "CONFIRMED").length,
    shipped: mockData.filter((d) => d.status === "SHIPPED" || d.status === "SHIPPING").length,
  }), []);

  const columns = useMemo<ColumnDef<ShipOrder>[]>(() => [
    { accessorKey: "shipOrderNo", header: t("shipping.shipOrder.shipOrderNo"), size: 160 },
    { accessorKey: "customerName", header: t("shipping.shipOrder.customer"), size: 120 },
    { accessorKey: "dueDate", header: t("shipping.shipOrder.dueDate"), size: 100 },
    { accessorKey: "shipDate", header: t("shipping.shipOrder.shipDate"), size: 100 },
    { accessorKey: "itemCount", header: t("shipping.shipOrder.itemCount"), size: 70, cell: ({ getValue }) => <span className="font-medium">{getValue() as number}</span> },
    { accessorKey: "totalQty", header: t("common.totalQty"), size: 90, cell: ({ getValue }) => <span className="font-medium">{(getValue() as number).toLocaleString()}</span> },
    { accessorKey: "status", header: t("common.status"), size: 90, cell: ({ getValue }) => <ComCodeBadge groupCode="SHIP_ORDER_STATUS" code={getValue() as string} /> },
    { id: "actions", header: t("common.actions"), size: 80, cell: ({ row }) => (
      <div className="flex gap-1">
        <button onClick={() => { setEditingItem(row.original); setIsModalOpen(true); }} className="p-1 hover:bg-surface rounded"><Edit2 className="w-4 h-4 text-primary" /></button>
        <button className="p-1 hover:bg-surface rounded"><Trash2 className="w-4 h-4 text-red-500" /></button>
      </div>
    ) },
  ], [t]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2"><ClipboardList className="w-7 h-7 text-primary" />{t("shipping.shipOrder.title")}</h1>
          <p className="text-text-muted mt-1">{t("shipping.shipOrder.subtitle")}</p>
        </div>
        <Button size="sm" onClick={() => { setEditingItem(null); setIsModalOpen(true); }}><Plus className="w-4 h-4 mr-1" />{t("common.register")}</Button>
      </div>
      <div className="grid grid-cols-4 gap-3">
        <StatCard label={t("shipping.shipOrder.statTotal")} value={stats.total} icon={FileText} color="blue" />
        <StatCard label={t("shipping.shipOrder.statusDraft")} value={stats.draft} icon={Clock} color="yellow" />
        <StatCard label={t("shipping.shipOrder.statusConfirmed")} value={stats.confirmed} icon={CheckCircle} color="green" />
        <StatCard label={t("shipping.shipOrder.statusShipped")} value={stats.shipped} icon={Truck} color="purple" />
      </div>
      <Card><CardContent>
        <div className="flex flex-wrap gap-4 mb-4">
          <div className="flex-1 min-w-[200px]"><Input placeholder={t("shipping.shipOrder.searchPlaceholder")} value={searchText} onChange={(e) => setSearchText(e.target.value)} leftIcon={<Search className="w-4 h-4" />} fullWidth /></div>
          <div className="w-40"><Select options={statusOptions} value={statusFilter} onChange={setStatusFilter} fullWidth /></div>
          <Button variant="secondary"><RefreshCw className="w-4 h-4" /></Button>
        </div>
        <DataGrid data={filteredData} columns={columns} pageSize={10} />
      </CardContent></Card>
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingItem ? t("shipping.shipOrder.editTitle") : t("shipping.shipOrder.addTitle")} size="lg">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label={t("shipping.shipOrder.shipOrderNo")} placeholder="SO-YYYYMMDD-NNN" defaultValue={editingItem?.shipOrderNo} fullWidth />
            <Select label={t("shipping.shipOrder.customer")} options={customerOptions} value={editingItem?.customerName ?? ""} onChange={() => {}} fullWidth />
            <Input label={t("shipping.shipOrder.dueDate")} type="date" defaultValue={editingItem?.dueDate} fullWidth />
            <Input label={t("shipping.shipOrder.shipDate")} type="date" defaultValue={editingItem?.shipDate} fullWidth />
          </div>
          <Input label={t("common.remark")} placeholder={t("common.remarkPlaceholder")} fullWidth />
          <div className="flex justify-end gap-2 pt-4 border-t border-border">
            <Button variant="secondary" onClick={() => setIsModalOpen(false)}>{t("common.cancel")}</Button>
            <Button onClick={() => setIsModalOpen(false)}>{editingItem ? t("common.edit") : t("common.register")}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default ShipOrderPage;
