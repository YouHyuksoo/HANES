"use client";

/**
 * @file src/app/(authenticated)/shipping/customer-po-status/page.tsx
 * @description 고객발주현황 페이지 - 수주 대비 출하 진행률 조회
 *
 * 초보자 가이드:
 * 1. **목적**: 고객발주 대비 출하 진행 현황을 모니터링
 * 2. **출하율**: (출하수량 / 수주수량) × 100
 * 3. **잔량**: 수주수량 - 출하수량
 */
import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { ColumnDef } from "@tanstack/react-table";
import {
  BarChart3, Search, RefreshCw,
  FileText, Loader, TruckIcon, CheckCircle,
} from "lucide-react";
import { Card, CardContent, Button, Input, Select, StatCard } from "@/components/ui";
import DataGrid from "@/components/data-grid/DataGrid";

interface CustomerPoStatus {
  id: string;
  orderNo: string;
  customerName: string;
  orderDate: string;
  dueDate: string;
  orderQty: number;
  shippedQty: number;
  shipRate: number;
  remainQty: number;
  status: string;
}

const statusKeys: Record<string, string> = {
  IN_PROGRESS: "shipping.customerPoStatus.statusInProgress",
  PARTIAL_SHIP: "shipping.customerPoStatus.statusPartialShip",
  COMPLETED: "shipping.customerPoStatus.statusCompleted",
  OVERDUE: "shipping.customerPoStatus.statusOverdue",
};

const statusColors: Record<string, string> = {
  IN_PROGRESS: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  PARTIAL_SHIP: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
  COMPLETED: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  OVERDUE: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
};

const mockData: CustomerPoStatus[] = [
  { id: "1", orderNo: "CO-20250201-001", customerName: "현대자동차", orderDate: "2025-02-01", dueDate: "2025-02-15", orderQty: 1500, shippedQty: 0, shipRate: 0, remainQty: 1500, status: "IN_PROGRESS" },
  { id: "2", orderNo: "CO-20250201-002", customerName: "기아자동차", orderDate: "2025-02-01", dueDate: "2025-02-20", orderQty: 800, shippedQty: 300, shipRate: 37.5, remainQty: 500, status: "PARTIAL_SHIP" },
  { id: "3", orderNo: "CO-20250130-001", customerName: "GM코리아", orderDate: "2025-01-30", dueDate: "2025-02-10", orderQty: 2000, shippedQty: 1200, shipRate: 60, remainQty: 800, status: "PARTIAL_SHIP" },
  { id: "4", orderNo: "CO-20250128-001", customerName: "현대자동차", orderDate: "2025-01-28", dueDate: "2025-02-05", orderQty: 1200, shippedQty: 1200, shipRate: 100, remainQty: 0, status: "COMPLETED" },
  { id: "5", orderNo: "CO-20250120-001", customerName: "르노코리아", orderDate: "2025-01-20", dueDate: "2025-01-30", orderQty: 500, shippedQty: 200, shipRate: 40, remainQty: 300, status: "OVERDUE" },
];

function CustomerPoStatusPage() {
  const { t } = useTranslation();
  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const statusOptions = [
    { value: "", label: t("common.allStatus") },
    { value: "IN_PROGRESS", label: t("shipping.customerPoStatus.statusInProgress") },
    { value: "PARTIAL_SHIP", label: t("shipping.customerPoStatus.statusPartialShip") },
    { value: "COMPLETED", label: t("shipping.customerPoStatus.statusCompleted") },
    { value: "OVERDUE", label: t("shipping.customerPoStatus.statusOverdue") },
  ];

  const filteredData = useMemo(() => mockData.filter((item) => {
    const matchSearch = !searchText || item.orderNo.toLowerCase().includes(searchText.toLowerCase()) || item.customerName.toLowerCase().includes(searchText.toLowerCase());
    return matchSearch && (!statusFilter || item.status === statusFilter);
  }), [searchText, statusFilter]);

  const stats = useMemo(() => ({
    total: mockData.length,
    inProgress: mockData.filter((d) => d.status === "IN_PROGRESS").length,
    partialShip: mockData.filter((d) => d.status === "PARTIAL_SHIP").length,
    completed: mockData.filter((d) => d.status === "COMPLETED").length,
  }), []);

  const columns = useMemo<ColumnDef<CustomerPoStatus>[]>(() => [
    { accessorKey: "orderNo", header: t("shipping.customerPoStatus.orderNo"), size: 160 },
    { accessorKey: "customerName", header: t("shipping.customerPoStatus.customer"), size: 120 },
    { accessorKey: "dueDate", header: t("shipping.customerPoStatus.dueDate"), size: 100 },
    { accessorKey: "orderQty", header: t("shipping.customerPoStatus.orderQty"), size: 90, cell: ({ getValue }) => <span className="font-medium">{(getValue() as number).toLocaleString()}</span> },
    { accessorKey: "shippedQty", header: t("shipping.customerPoStatus.shippedQty"), size: 90, cell: ({ getValue }) => <span className="font-medium">{(getValue() as number).toLocaleString()}</span> },
    { accessorKey: "shipRate", header: t("shipping.customerPoStatus.shipRate"), size: 100, cell: ({ getValue }) => {
      const rate = getValue() as number;
      const barColor = rate >= 100 ? "bg-green-500" : rate >= 50 ? "bg-blue-500" : rate > 0 ? "bg-orange-500" : "bg-gray-300 dark:bg-gray-600";
      return (
        <div className="flex items-center gap-2">
          <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div className={`h-full rounded-full ${barColor}`} style={{ width: `${Math.min(rate, 100)}%` }} />
          </div>
          <span className="text-xs font-medium w-10 text-right">{rate}%</span>
        </div>
      );
    } },
    { accessorKey: "remainQty", header: t("shipping.customerPoStatus.remainQty"), size: 90, cell: ({ getValue }) => {
      const qty = getValue() as number;
      return <span className={`font-medium ${qty > 0 ? "text-red-500" : "text-green-600 dark:text-green-400"}`}>{qty.toLocaleString()}</span>;
    } },
    { accessorKey: "status", header: t("common.status"), size: 90, cell: ({ getValue }) => { const s = getValue() as string; return <span className={`px-2 py-0.5 text-xs rounded-full ${statusColors[s] || ""}`}>{t(statusKeys[s])}</span>; } },
  ], [t]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2"><BarChart3 className="w-7 h-7 text-primary" />{t("shipping.customerPoStatus.title")}</h1>
          <p className="text-text-muted mt-1">{t("shipping.customerPoStatus.subtitle")}</p>
        </div>
      </div>
      <div className="grid grid-cols-4 gap-3">
        <StatCard label={t("shipping.customerPoStatus.statTotal")} value={stats.total} icon={FileText} color="blue" />
        <StatCard label={t("shipping.customerPoStatus.statusInProgress")} value={stats.inProgress} icon={Loader} color="yellow" />
        <StatCard label={t("shipping.customerPoStatus.statusPartialShip")} value={stats.partialShip} icon={TruckIcon} color="orange" />
        <StatCard label={t("shipping.customerPoStatus.statusCompleted")} value={stats.completed} icon={CheckCircle} color="green" />
      </div>
      <Card><CardContent>
        <div className="flex flex-wrap gap-4 mb-4">
          <div className="flex-1 min-w-[200px]"><Input placeholder={t("shipping.customerPoStatus.searchPlaceholder")} value={searchText} onChange={(e) => setSearchText(e.target.value)} leftIcon={<Search className="w-4 h-4" />} fullWidth /></div>
          <div className="w-40"><Select options={statusOptions} value={statusFilter} onChange={setStatusFilter} fullWidth /></div>
          <Button variant="secondary"><RefreshCw className="w-4 h-4" /></Button>
        </div>
        <DataGrid data={filteredData} columns={columns} pageSize={10} />
      </CardContent></Card>
    </div>
  );
}

export default CustomerPoStatusPage;
