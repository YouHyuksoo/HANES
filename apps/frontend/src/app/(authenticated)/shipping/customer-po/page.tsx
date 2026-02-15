"use client";

/**
 * @file src/app/(authenticated)/shipping/customer-po/page.tsx
 * @description 고객발주관리 페이지 - 고객 수주 CRUD 및 품목 관리
 *
 * 초보자 가이드:
 * 1. **고객발주**: 고객이 우리 회사에 발주한 주문서 관리
 * 2. **상태 흐름**: RECEIVED -> CONFIRMED -> IN_PRODUCTION -> PARTIAL_SHIP -> SHIPPED -> CLOSED
 * 3. **품목**: 하나의 고객발주에 여러 품목이 포함될 수 있음
 */
import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { ColumnDef } from "@tanstack/react-table";
import {
  ShoppingCart, Plus, Search, RefreshCw, Edit2, Trash2,
  FileText, Clock, CheckCircle, Factory, Truck,
} from "lucide-react";
import { Card, CardContent, Button, Input, Select, StatCard } from "@/components/ui";
import DataGrid from "@/components/data-grid/DataGrid";
import CustomerPoModal, { CustomerOrder } from "./components/CustomerPoModal";

const statusKeys: Record<string, string> = {
  RECEIVED: "shipping.customerPo.statusReceived",
  CONFIRMED: "shipping.customerPo.statusConfirmed",
  IN_PRODUCTION: "shipping.customerPo.statusInProduction",
  PARTIAL_SHIP: "shipping.customerPo.statusPartialShip",
  SHIPPED: "shipping.customerPo.statusShipped",
  CLOSED: "shipping.customerPo.statusClosed",
};

const statusColors: Record<string, string> = {
  RECEIVED: "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300",
  CONFIRMED: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  IN_PRODUCTION: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
  PARTIAL_SHIP: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
  SHIPPED: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  CLOSED: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
};

const mockData: CustomerOrder[] = [
  { id: "1", orderNo: "CO-20250201-001", customerName: "현대자동차", orderDate: "2025-02-01", dueDate: "2025-02-15", status: "RECEIVED", itemCount: 3, totalAmount: 15000000, currency: "KRW" },
  { id: "2", orderNo: "CO-20250201-002", customerName: "기아자동차", orderDate: "2025-02-01", dueDate: "2025-02-20", status: "CONFIRMED", itemCount: 2, totalAmount: 8500000, currency: "KRW" },
  { id: "3", orderNo: "CO-20250130-001", customerName: "GM코리아", orderDate: "2025-01-30", dueDate: "2025-02-10", status: "IN_PRODUCTION", itemCount: 4, totalAmount: 22000000, currency: "KRW" },
  { id: "4", orderNo: "CO-20250128-001", customerName: "현대자동차", orderDate: "2025-01-28", dueDate: "2025-02-05", status: "SHIPPED", itemCount: 2, totalAmount: 12000000, currency: "KRW" },
  { id: "5", orderNo: "CO-20250125-001", customerName: "르노코리아", orderDate: "2025-01-25", dueDate: "2025-02-03", status: "CLOSED", itemCount: 5, totalAmount: 35000000, currency: "KRW" },
];

function CustomerPoPage() {
  const { t } = useTranslation();
  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<CustomerOrder | null>(null);

  const statusOptions = [
    { value: "", label: t("common.allStatus") },
    { value: "RECEIVED", label: t("shipping.customerPo.statusReceived") },
    { value: "CONFIRMED", label: t("shipping.customerPo.statusConfirmed") },
    { value: "IN_PRODUCTION", label: t("shipping.customerPo.statusInProduction") },
    { value: "SHIPPED", label: t("shipping.customerPo.statusShipped") },
    { value: "CLOSED", label: t("shipping.customerPo.statusClosed") },
  ];

  const filteredData = useMemo(() => mockData.filter((item) => {
    const matchSearch = !searchText || item.orderNo.toLowerCase().includes(searchText.toLowerCase()) || item.customerName.toLowerCase().includes(searchText.toLowerCase());
    return matchSearch && (!statusFilter || item.status === statusFilter);
  }), [searchText, statusFilter]);

  const stats = useMemo(() => ({
    total: mockData.length,
    received: mockData.filter((d) => d.status === "RECEIVED").length,
    confirmed: mockData.filter((d) => d.status === "CONFIRMED").length,
    inProduction: mockData.filter((d) => d.status === "IN_PRODUCTION").length,
    shipped: mockData.filter((d) => d.status === "SHIPPED" || d.status === "CLOSED").length,
  }), []);

  const columns = useMemo<ColumnDef<CustomerOrder>[]>(() => [
    { accessorKey: "orderNo", header: t("shipping.customerPo.orderNo"), size: 160 },
    { accessorKey: "customerName", header: t("shipping.customerPo.customer"), size: 120 },
    { accessorKey: "orderDate", header: t("shipping.customerPo.orderDate"), size: 100 },
    { accessorKey: "dueDate", header: t("shipping.customerPo.dueDate"), size: 100 },
    { accessorKey: "itemCount", header: t("shipping.customerPo.itemCount"), size: 70, cell: ({ getValue }) => <span className="font-medium">{getValue() as number}</span> },
    { accessorKey: "totalAmount", header: t("shipping.customerPo.totalAmount"), size: 120, cell: ({ getValue }) => <span className="font-medium">{(getValue() as number).toLocaleString()}</span> },
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
          <h1 className="text-xl font-bold text-text flex items-center gap-2"><ShoppingCart className="w-7 h-7 text-primary" />{t("shipping.customerPo.title")}</h1>
          <p className="text-text-muted mt-1">{t("shipping.customerPo.subtitle")}</p>
        </div>
        <Button size="sm" onClick={() => { setEditingItem(null); setIsModalOpen(true); }}><Plus className="w-4 h-4 mr-1" />{t("common.register")}</Button>
      </div>
      <div className="grid grid-cols-5 gap-3">
        <StatCard label={t("shipping.customerPo.statTotal")} value={stats.total} icon={FileText} color="blue" />
        <StatCard label={t("shipping.customerPo.statusReceived")} value={stats.received} icon={Clock} color="gray" />
        <StatCard label={t("shipping.customerPo.statusConfirmed")} value={stats.confirmed} icon={CheckCircle} color="green" />
        <StatCard label={t("shipping.customerPo.statusInProduction")} value={stats.inProduction} icon={Factory} color="yellow" />
        <StatCard label={t("shipping.customerPo.statusShipped")} value={stats.shipped} icon={Truck} color="purple" />
      </div>
      <Card><CardContent>
        <div className="flex flex-wrap gap-4 mb-4">
          <div className="flex-1 min-w-[200px]"><Input placeholder={t("shipping.customerPo.searchPlaceholder")} value={searchText} onChange={(e) => setSearchText(e.target.value)} leftIcon={<Search className="w-4 h-4" />} fullWidth /></div>
          <div className="w-40"><Select options={statusOptions} value={statusFilter} onChange={setStatusFilter} fullWidth /></div>
          <Button variant="secondary"><RefreshCw className="w-4 h-4" /></Button>
        </div>
        <DataGrid data={filteredData} columns={columns} pageSize={10} />
      </CardContent></Card>
      <CustomerPoModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} editingItem={editingItem} />
    </div>
  );
}

export default CustomerPoPage;
