"use client";

/**
 * @file src/app/(authenticated)/production/order/page.tsx
 * @description 작업지시 관리 페이지 - API 연동, BOM 반제품 자동생성, 트리뷰
 *
 * 초보자 가이드:
 * 1. **작업지시**: 완제품/반제품 생산 명령 (WAITING → RUNNING → DONE)
 * 2. **트리뷰**: 완제품 기준 하위 반제품 작업지시를 계층형 표시
 * 3. **자동생성**: 완제품 작업지시 생성 시 BOM 기반 반제품 지시 동시 생성
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Search, RefreshCw, ClipboardList, Plus, ChevronRight, ChevronDown } from "lucide-react";
import { Card, CardContent, Button, Input, Select, ComCodeBadge, StatCard } from "@/components/ui";
import DataGrid from "@/components/data-grid/DataGrid";
import { ColumnDef } from "@tanstack/react-table";
import { useComCodeOptions } from "@/hooks/useComCode";
import api from "@/services/api";
import CreateJobOrderModal from "./components/CreateJobOrderModal";

interface JobOrderItem {
  id: string;
  orderNo: string;
  parentId?: string | null;
  itemCode: string;
  part?: { itemCode?: string; itemName?: string; itemType?: string };
  lineCode?: string;
  planQty: number;
  goodQty: number;
  defectQty: number;
  planDate?: string;
  priority: number;
  status: string;
  startAt?: string;
  endAt?: string;
  remark?: string;
  children?: JobOrderItem[];
}

/** 트리 데이터를 평탄화 (들여쓰기 depth 포함) */
function flattenTree(items: JobOrderItem[], depth = 0): (JobOrderItem & { _depth: number })[] {
  const result: (JobOrderItem & { _depth: number })[] = [];
  for (const item of items) {
    result.push({ ...item, _depth: depth });
    if (item.children?.length) {
      result.push(...flattenTree(item.children, depth + 1));
    }
  }
  return result;
}

export default function JobOrderPage() {
  const { t } = useTranslation();
  const comCodeStatusOptions = useComCodeOptions("JOB_ORDER_STATUS");

  const statusOptions = useMemo(() => [
    { value: "", label: t("common.allStatus") }, ...comCodeStatusOptions,
  ], [t, comCodeStatusOptions]);

  const [data, setData] = useState<JobOrderItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [showCreate, setShowCreate] = useState(false);
  const [viewMode, setViewMode] = useState<"list" | "tree">("list");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      if (viewMode === "tree") {
        const res = await api.get("/production/job-orders/tree");
        setData(res.data?.data ?? []);
      } else {
        const params: Record<string, string> = { limit: "5000" };
        if (searchText) params.search = searchText;
        if (statusFilter) params.status = statusFilter;
        if (startDate) params.planDateFrom = startDate;
        if (endDate) params.planDateTo = endDate;
        const res = await api.get("/production/job-orders", { params });
        setData(res.data?.data ?? []);
      }
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [viewMode, searchText, statusFilter, startDate, endDate]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const displayData = useMemo(() => {
    if (viewMode === "tree") return flattenTree(data);
    return data.map(d => ({ ...d, _depth: 0 }));
  }, [viewMode, data]);

  const stats = useMemo(() => ({
    total: displayData.length,
    waiting: displayData.filter(d => d.status === "WAITING").length,
    running: displayData.filter(d => d.status === "RUNNING").length,
    done: displayData.filter(d => d.status === "DONE").length,
  }), [displayData]);

  const getProgress = (row: JobOrderItem) => {
    if (row.planQty === 0) return 0;
    return Math.round((row.goodQty / row.planQty) * 100);
  };

  const columns = useMemo<ColumnDef<JobOrderItem & { _depth: number }>[]>(() => [
    {
      accessorKey: "orderNo", header: t("production.order.orderNo"), size: 180,
      meta: { filterType: "text" as const },
      cell: ({ row }) => {
        const depth = row.original._depth;
        return (
          <span className="flex items-center gap-1" style={{ paddingLeft: `${depth * 20}px` }}>
            {depth > 0 && <ChevronRight className="w-3 h-3 text-text-muted" />}
            {row.original.children?.length ? <ChevronDown className="w-3 h-3 text-primary" /> : null}
            <span className="font-mono text-sm">{row.original.orderNo}</span>
          </span>
        );
      },
    },
    {
      id: "partCode", header: t("common.partCode"), size: 110,
      meta: { filterType: "text" as const },
      accessorFn: (row) => row.part?.itemCode || "",
      cell: ({ getValue }) => <span className="font-mono text-sm">{(getValue() as string) || "-"}</span>,
    },
    {
      id: "partName", header: t("common.partName"), size: 140,
      meta: { filterType: "text" as const },
      accessorFn: (row) => row.part?.itemName || "",
    },
    {
      id: "partType", header: t("production.order.partType"), size: 70,
      meta: { filterType: "multi" as const },
      accessorFn: (row) => row.part?.itemType || "",
      cell: ({ getValue }) => {
        const v = getValue() as string;
        if (!v) return "-";
        const cls = v === "FG" ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
          : v === "WIP" ? "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300"
          : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400";
        return <span className={`px-2 py-0.5 text-xs rounded-full ${cls}`}>{v}</span>;
      },
    },
    {
      accessorKey: "planQty", header: t("production.order.planQty"), size: 80,
      cell: ({ getValue }) => <span className="font-medium">{(getValue() as number).toLocaleString()}</span>,
      meta: { filterType: "number" as const, align: "right" as const },
    },
    {
      accessorKey: "goodQty", header: t("production.order.prodQty"), size: 80,
      cell: ({ getValue }) => <span>{(getValue() as number).toLocaleString()}</span>,
      meta: { filterType: "number" as const, align: "right" as const },
    },
    {
      id: "progress", header: t("production.order.progress"), size: 120,
      meta: { filterType: "none" as const },
      cell: ({ row }) => {
        const p = getProgress(row.original);
        return (
          <div className="flex items-center gap-2">
            <div className="flex-1 h-2 bg-background rounded-full overflow-hidden">
              <div className="h-full bg-primary rounded-full" style={{ width: `${p}%` }} />
            </div>
            <span className="text-xs text-text-muted w-10">{p}%</span>
          </div>
        );
      },
    },
    {
      accessorKey: "status", header: t("common.status"), size: 80,
      meta: { filterType: "multi" as const },
      cell: ({ getValue }) => <ComCodeBadge groupCode="JOB_ORDER_STATUS" code={getValue() as string} />,
    },
    {
      accessorKey: "planDate", header: t("production.order.planDate"), size: 100,
      meta: { filterType: "date" as const },
      cell: ({ getValue }) => {
        const v = getValue() as string;
        return v ? String(v).slice(0, 10) : "-";
      },
    },
  ], [t]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2">
            <ClipboardList className="w-7 h-7 text-primary" />
            {t("production.order.title")}
          </h1>
          <p className="text-text-muted mt-1">{t("production.order.description")}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm"
            onClick={() => setViewMode(v => v === "list" ? "tree" : "list")}>
            {viewMode === "list" ? t("production.order.treeView") : t("production.order.listView")}
          </Button>
          <Button size="sm" onClick={() => setShowCreate(true)}>
            <Plus className="w-4 h-4 mr-1" /> {t("production.order.create")}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3">
        <StatCard label={t("production.order.stats.total")} value={stats.total} icon={ClipboardList} color="blue" />
        <StatCard label={t("production.order.stats.waiting")} value={stats.waiting} icon={ClipboardList} color="yellow" />
        <StatCard label={t("production.order.stats.running")} value={stats.running} icon={ClipboardList} color="green" />
        <StatCard label={t("production.order.stats.done")} value={stats.done} icon={ClipboardList} color="purple" />
      </div>

      <Card><CardContent>
        <DataGrid data={displayData} columns={columns} isLoading={loading} enableColumnFilter enableExport exportFileName="작업지시"
          toolbarLeft={
            <div className="flex gap-3 flex-1 min-w-0">
              <div className="flex-1 min-w-0">
                <Input placeholder={t("production.order.searchPlaceholder")}
                  value={searchText} onChange={e => setSearchText(e.target.value)}
                  leftIcon={<Search className="w-4 h-4" />} fullWidth />
              </div>
              <div className="w-36 flex-shrink-0">
                <Select options={statusOptions} value={statusFilter}
                  onChange={setStatusFilter} fullWidth />
              </div>
              <div className="w-36 flex-shrink-0">
                <Input type="date" value={startDate}
                  onChange={e => setStartDate(e.target.value)} fullWidth />
              </div>
              <div className="w-36 flex-shrink-0">
                <Input type="date" value={endDate}
                  onChange={e => setEndDate(e.target.value)} fullWidth />
              </div>
              <Button variant="secondary" onClick={fetchData}>
                <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              </Button>
            </div>
          } />
      </CardContent></Card>

      <CreateJobOrderModal isOpen={showCreate} onClose={() => setShowCreate(false)} onCreated={fetchData} />
    </div>
  );
}
