"use client";

/**
 * @file src/app/(authenticated)/shipping/return/page.tsx
 * @description 출하반품등록 페이지 - 출하반품 CRUD 및 품목 관리
 *
 * 초보자 가이드:
 * 1. **출하반품**: 출하 후 고객사에서 반품된 품목을 등록/관리
 * 2. **상태 흐름**: DRAFT -> CONFIRMED -> COMPLETED
 * 3. **처리유형**: RESTOCK(재입고), SCRAP(폐기), REPAIR(수리)
 */
import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { ColumnDef } from "@tanstack/react-table";
import {
  Undo2, Plus, Search, RefreshCw, Edit2, Trash2,
  FileText, Clock, CheckCircle, AlertTriangle,
} from "lucide-react";
import { Card, CardContent, Button, Input, Modal, Select, StatCard } from "@/components/ui";
import DataGrid from "@/components/data-grid/DataGrid";

interface ShipReturn {
  id: string;
  returnNo: string;
  shipOrderNo: string;
  customerName: string;
  returnDate: string;
  returnReason: string;
  status: string;
  itemCount: number;
  totalQty: number;
}

const statusKeys: Record<string, string> = {
  DRAFT: "shipping.return.statusDraft", CONFIRMED: "shipping.return.statusConfirmed", COMPLETED: "shipping.return.statusCompleted",
};
const statusColors: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300",
  CONFIRMED: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  COMPLETED: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
};

const mockData: ShipReturn[] = [
  { id: "1", returnNo: "RT-20250201-001", shipOrderNo: "SO-20250125-001", customerName: "현대자동차", returnDate: "2025-02-01", returnReason: "불량", status: "DRAFT", itemCount: 2, totalQty: 50 },
  { id: "2", returnNo: "RT-20250130-001", shipOrderNo: "SO-20250120-001", customerName: "기아자동차", returnDate: "2025-01-30", returnReason: "수량 초과", status: "CONFIRMED", itemCount: 1, totalQty: 100 },
  { id: "3", returnNo: "RT-20250128-001", shipOrderNo: "SO-20250115-001", customerName: "GM코리아", returnDate: "2025-01-28", returnReason: "규격 불일치", status: "COMPLETED", itemCount: 3, totalQty: 200 },
];

function ShipReturnPage() {
  const { t } = useTranslation();
  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ShipReturn | null>(null);

  const statusOptions = [
    { value: "", label: t("common.allStatus") },
    { value: "DRAFT", label: t("shipping.return.statusDraft") }, { value: "CONFIRMED", label: t("shipping.return.statusConfirmed") }, { value: "COMPLETED", label: t("shipping.return.statusCompleted") },
  ];

  const filteredData = useMemo(() => mockData.filter((item) => {
    const matchSearch = !searchText || item.returnNo.toLowerCase().includes(searchText.toLowerCase()) || item.customerName.toLowerCase().includes(searchText.toLowerCase());
    return matchSearch && (!statusFilter || item.status === statusFilter);
  }), [searchText, statusFilter]);

  const stats = useMemo(() => ({
    total: mockData.length, draft: mockData.filter((d) => d.status === "DRAFT").length,
    confirmed: mockData.filter((d) => d.status === "CONFIRMED").length,
    completed: mockData.filter((d) => d.status === "COMPLETED").length,
  }), []);

  const columns = useMemo<ColumnDef<ShipReturn>[]>(() => [
    { accessorKey: "returnNo", header: t("shipping.return.returnNo"), size: 160 },
    { accessorKey: "shipOrderNo", header: t("shipping.return.shipOrderNo"), size: 160 },
    { accessorKey: "customerName", header: t("shipping.return.customer"), size: 120 },
    { accessorKey: "returnDate", header: t("shipping.return.returnDate"), size: 100 },
    { accessorKey: "returnReason", header: t("shipping.return.returnReason"), size: 120 },
    { accessorKey: "totalQty", header: t("shipping.return.returnQty"), size: 80, cell: ({ getValue }) => <span className="font-medium">{(getValue() as number).toLocaleString()}</span> },
    { accessorKey: "status", header: t("common.status"), size: 90, cell: ({ getValue }) => { const s = getValue() as string; return <span className={`px-2 py-0.5 text-xs rounded-full ${statusColors[s] || ""}`}>{t(statusKeys[s])}</span>; } },
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
          <h1 className="text-xl font-bold text-text flex items-center gap-2"><Undo2 className="w-7 h-7 text-primary" />{t("shipping.return.title")}</h1>
          <p className="text-text-muted mt-1">{t("shipping.return.subtitle")}</p>
        </div>
        <Button size="sm" onClick={() => { setEditingItem(null); setIsModalOpen(true); }}><Plus className="w-4 h-4 mr-1" />{t("common.register")}</Button>
      </div>
      <div className="grid grid-cols-4 gap-3">
        <StatCard label={t("shipping.return.statTotal")} value={stats.total} icon={FileText} color="blue" />
        <StatCard label={t("shipping.return.statusDraft")} value={stats.draft} icon={Clock} color="yellow" />
        <StatCard label={t("shipping.return.statusConfirmed")} value={stats.confirmed} icon={AlertTriangle} color="red" />
        <StatCard label={t("shipping.return.statusCompleted")} value={stats.completed} icon={CheckCircle} color="green" />
      </div>
      <Card><CardContent>
        <div className="flex flex-wrap gap-4 mb-4">
          <div className="flex-1 min-w-[200px]"><Input placeholder={t("shipping.return.searchPlaceholder")} value={searchText} onChange={(e) => setSearchText(e.target.value)} leftIcon={<Search className="w-4 h-4" />} fullWidth /></div>
          <div className="w-40"><Select options={statusOptions} value={statusFilter} onChange={setStatusFilter} fullWidth /></div>
          <Button variant="secondary"><RefreshCw className="w-4 h-4" /></Button>
        </div>
        <DataGrid data={filteredData} columns={columns} pageSize={10} />
      </CardContent></Card>
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingItem ? t("shipping.return.editTitle") : t("shipping.return.addTitle")} size="lg">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label={t("shipping.return.returnNo")} placeholder="RT-YYYYMMDD-NNN" defaultValue={editingItem?.returnNo} fullWidth />
            <Input label={t("shipping.return.shipOrderNo")} placeholder="SO-YYYYMMDD-NNN" defaultValue={editingItem?.shipOrderNo} fullWidth />
            <Input label={t("shipping.return.returnDate")} type="date" defaultValue={editingItem?.returnDate} fullWidth />
            <Input label={t("shipping.return.customer")} placeholder={t("shipping.return.customerPlaceholder")} defaultValue={editingItem?.customerName} fullWidth />
          </div>
          <Input label={t("shipping.return.returnReason")} placeholder={t("shipping.return.returnReasonPlaceholder")} defaultValue={editingItem?.returnReason} fullWidth />
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

export default ShipReturnPage;
