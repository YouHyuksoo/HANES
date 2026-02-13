"use client";

/**
 * @file src/app/(authenticated)/shipping/history/page.tsx
 * @description 출하이력조회 페이지 - 출하 이력 필터링 조회 (조회 전용)
 *
 * 초보자 가이드:
 * 1. **조회 전용**: 출하지시 이력을 다양한 필터로 검색
 * 2. **필터**: 상태, 날짜 범위, 고객명 등으로 필터링
 * 3. **통계**: 상태별 건수 표시
 */
import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { ColumnDef } from "@tanstack/react-table";
import {
  History, Search, RefreshCw, Download, Calendar,
  FileText, CheckCircle, Truck, Archive,
} from "lucide-react";
import { Card, CardContent, Button, Input, Select, StatCard } from "@/components/ui";
import DataGrid from "@/components/data-grid/DataGrid";

interface ShipHistory {
  id: string;
  shipOrderNo: string;
  customerName: string;
  dueDate: string;
  shipDate: string;
  status: string;
  itemCount: number;
  totalQty: number;
  createdAt: string;
}

const statusKeys: Record<string, string> = {
  DRAFT: "shipping.history.statusDraft", CONFIRMED: "shipping.history.statusConfirmed", SHIPPING: "shipping.history.statusShipping", SHIPPED: "shipping.history.statusShipped",
};
const statusColors: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300",
  CONFIRMED: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  SHIPPING: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
  SHIPPED: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
};

const mockData: ShipHistory[] = [
  { id: "1", shipOrderNo: "SO-20250201-001", customerName: "현대자동차", dueDate: "2025-02-05", shipDate: "2025-02-03", status: "SHIPPED", itemCount: 3, totalQty: 1500, createdAt: "2025-02-01" },
  { id: "2", shipOrderNo: "SO-20250130-001", customerName: "기아자동차", dueDate: "2025-02-03", shipDate: "2025-02-02", status: "SHIPPED", itemCount: 2, totalQty: 800, createdAt: "2025-01-30" },
  { id: "3", shipOrderNo: "SO-20250128-001", customerName: "GM코리아", dueDate: "2025-01-31", shipDate: "2025-01-30", status: "SHIPPED", itemCount: 4, totalQty: 2000, createdAt: "2025-01-28" },
  { id: "4", shipOrderNo: "SO-20250125-001", customerName: "현대자동차", dueDate: "2025-01-28", shipDate: "2025-01-27", status: "CONFIRMED", itemCount: 2, totalQty: 1200, createdAt: "2025-01-25" },
  { id: "5", shipOrderNo: "SO-20250120-001", customerName: "기아자동차", dueDate: "2025-01-24", shipDate: "2025-01-23", status: "SHIPPING", itemCount: 5, totalQty: 3000, createdAt: "2025-01-20" },
];

function ShipHistoryPage() {
  const { t } = useTranslation();
  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const statusOptions = [
    { value: "", label: t("common.allStatus") },
    { value: "DRAFT", label: t("shipping.history.statusDraft") }, { value: "CONFIRMED", label: t("shipping.history.statusConfirmed") },
    { value: "SHIPPING", label: t("shipping.history.statusShipping") }, { value: "SHIPPED", label: t("shipping.history.statusShipped") },
  ];

  const filteredData = useMemo(() => mockData.filter((item) => {
    const matchSearch = !searchText || item.shipOrderNo.toLowerCase().includes(searchText.toLowerCase()) || item.customerName.toLowerCase().includes(searchText.toLowerCase());
    const matchStatus = !statusFilter || item.status === statusFilter;
    const matchDateFrom = !dateFrom || item.shipDate >= dateFrom;
    const matchDateTo = !dateTo || item.shipDate <= dateTo;
    return matchSearch && matchStatus && matchDateFrom && matchDateTo;
  }), [searchText, statusFilter, dateFrom, dateTo]);

  const stats = useMemo(() => ({
    total: mockData.length,
    shipped: mockData.filter((d) => d.status === "SHIPPED").length,
    confirmed: mockData.filter((d) => d.status === "CONFIRMED").length,
    totalQty: mockData.reduce((sum, d) => sum + d.totalQty, 0),
  }), []);

  const columns = useMemo<ColumnDef<ShipHistory>[]>(() => [
    { accessorKey: "shipOrderNo", header: t("shipping.history.shipOrderNo"), size: 160 },
    { accessorKey: "customerName", header: t("shipping.history.customer"), size: 120 },
    { accessorKey: "dueDate", header: t("shipping.history.dueDate"), size: 100 },
    { accessorKey: "shipDate", header: t("shipping.history.shipDateCol"), size: 100 },
    { accessorKey: "itemCount", header: t("shipping.history.itemCount"), size: 70 },
    { accessorKey: "totalQty", header: t("common.totalQty"), size: 100, cell: ({ getValue }) => <span className="font-medium">{(getValue() as number).toLocaleString()}</span> },
    { accessorKey: "status", header: t("common.status"), size: 90, cell: ({ getValue }) => { const s = getValue() as string; return <span className={`px-2 py-0.5 text-xs rounded-full ${statusColors[s] || ""}`}>{t(statusKeys[s])}</span>; } },
    { accessorKey: "createdAt", header: t("common.createdAt"), size: 100 },
  ], [t]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2"><History className="w-7 h-7 text-primary" />{t("shipping.history.title")}</h1>
          <p className="text-text-muted mt-1">{t("shipping.history.subtitle")}</p>
        </div>
        <Button variant="secondary" size="sm"><Download className="w-4 h-4 mr-1" />{t("shipping.history.excelDownload")}</Button>
      </div>
      <div className="grid grid-cols-4 gap-3">
        <StatCard label={t("shipping.history.statTotal")} value={stats.total} icon={FileText} color="blue" />
        <StatCard label={t("shipping.history.statusShipped")} value={stats.shipped} icon={Truck} color="green" />
        <StatCard label={t("shipping.history.statConfirmedWait")} value={stats.confirmed} icon={CheckCircle} color="yellow" />
        <StatCard label={t("shipping.history.statTotalQty")} value={stats.totalQty.toLocaleString()} icon={Archive} color="purple" />
      </div>
      <Card><CardContent>
        <div className="flex flex-wrap gap-4 mb-4">
          <div className="flex-1 min-w-[200px]"><Input placeholder={t("shipping.history.searchPlaceholder")} value={searchText} onChange={(e) => setSearchText(e.target.value)} leftIcon={<Search className="w-4 h-4" />} fullWidth /></div>
          <div className="w-36"><Select options={statusOptions} value={statusFilter} onChange={setStatusFilter} fullWidth /></div>
          <div className="flex items-center gap-1"><Calendar className="w-4 h-4 text-text-muted" /><Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-36" /></div>
          <span className="text-text-muted self-center">~</span>
          <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-36" />
          <Button variant="secondary"><RefreshCw className="w-4 h-4" /></Button>
        </div>
        <DataGrid data={filteredData} columns={columns} pageSize={10} />
      </CardContent></Card>
    </div>
  );
}

export default ShipHistoryPage;
