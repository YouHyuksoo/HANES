"use client";

/**
 * @file src/app/(authenticated)/quality/oqc/page.tsx
 * @description OQC(출하검사) 관리 페이지 - 의뢰 생성, 검사 실행, 결과 조회
 *
 * 초보자 가이드:
 * 1. **StatCards**: 총의뢰/대기/합격/불합격 통계
 * 2. **DataGrid**: 의뢰 목록 (필터/검색/페이지네이션)
 * 3. **OqcRequestModal**: 새 OQC 의뢰 생성 (박스 선택)
 * 4. **OqcInspectModal**: 검사 실행 및 판정
 * 5. API: GET/POST /quality/oqc
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { ColumnDef } from "@tanstack/react-table";
import {
  ClipboardCheck, Search, RefreshCw, Plus, Clock, CheckCircle,
  XCircle, FileText, Calendar, FileSearch, X,
} from "lucide-react";
import { Card, CardContent, Button, Input, Select, StatCard, ComCodeBadge } from "@/components/ui";
import { ComCodeSelect } from "@/components/shared";
import DataGrid from "@/components/data-grid/DataGrid";
import api from "@/services/api";
import OqcRequestModal from "./components/OqcRequestModal";
import OqcInspectModal from "./components/OqcInspectModal";

interface OqcRequest {
  id: string;
  requestNo: string;
  itemCode: string;
  customer: string | null;
  requestDate: string;
  totalBoxCount: number;
  totalQty: number;
  sampleSize: number | null;
  status: string;
  result: string | null;
  inspectorName: string | null;
  inspectDate: string | null;
  remark: string | null;
  part?: { itemCode?: string; itemName?: string };
}

export default function OqcPage() {
  const { t } = useTranslation();
  const [data, setData] = useState<OqcRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [customerFilter, setCustomerFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [stats, setStats] = useState({ total: 0, pending: 0, pass: 0, fail: 0 });
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const [isInspectModalOpen, setIsInspectModalOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<OqcRequest | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { limit: "5000" };
      if (searchText) params.search = searchText;
      if (statusFilter) params.status = statusFilter;
      if (customerFilter) params.customer = customerFilter;
      if (dateFrom) params.fromDate = dateFrom;
      if (dateTo) params.toDate = dateTo;
      const [listRes, statsRes] = await Promise.all([
        api.get("/quality/oqc", { params }),
        api.get("/quality/oqc/stats"),
      ]);
      setData(listRes.data?.data ?? []);
      setStats(statsRes.data?.data ?? { total: 0, pending: 0, pass: 0, fail: 0 });
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [searchText, statusFilter, customerFilter, dateFrom, dateTo]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleRowClick = useCallback((row: OqcRequest) => {
    setSelectedRequest(row);
    setIsInspectModalOpen(true);
  }, []);

  const columns = useMemo<ColumnDef<OqcRequest>[]>(() => [
    {
      id: "actions", header: "", size: 60,
      meta: { align: "center" as const, filterType: "none" as const },
      cell: ({ row }) => (
        <button
          onClick={(e) => { e.stopPropagation(); handleRowClick(row.original); }}
          className="p-1 hover:bg-surface rounded transition-colors" title={t("common.detail", "상세")}
        >
          <FileSearch className="w-4 h-4 text-primary" />
        </button>
      ),
    },
    {
      accessorKey: "requestNo", header: t("quality.oqc.requestNo"), size: 160,
      meta: { filterType: "text" as const },
      cell: ({ getValue }) => <span className="text-primary font-medium">{getValue() as string}</span>,
    },
    {
      accessorKey: "requestDate", header: t("quality.oqc.requestDate"), size: 120,
      meta: { filterType: "date" as const },
      cell: ({ getValue }) => {
        const d = getValue() as string;
        return d ? new Date(d).toLocaleDateString() : "-";
      },
    },
    {
      accessorFn: (row) => row.part?.itemCode, id: "partCode",
      header: t("common.partCode"), size: 120,
      meta: { filterType: "text" as const },
      cell: ({ getValue }) => <span className="font-mono text-sm">{(getValue() as string) || "-"}</span>,
    },
    {
      accessorFn: (row) => row.part?.itemName, id: "partName",
      header: t("common.partName"), size: 140,
      meta: { filterType: "text" as const },
    },
    {
      accessorKey: "customer", header: t("quality.oqc.customer"), size: 120,
      meta: { filterType: "text" as const },
      cell: ({ getValue }) => (getValue() as string) || "-",
    },
    {
      accessorKey: "totalBoxCount", header: t("quality.oqc.boxCount"), size: 80,
      meta: { filterType: "number" as const },
      cell: ({ getValue }) => <span className="font-mono text-right block">{getValue() as number}</span>,
    },
    {
      accessorKey: "totalQty", header: t("quality.oqc.totalQty"), size: 90,
      meta: { filterType: "number" as const },
      cell: ({ getValue }) => <span className="font-mono text-right block">{(getValue() as number).toLocaleString()}</span>,
    },
    {
      accessorKey: "sampleSize", header: t("quality.oqc.sampleSize"), size: 80,
      meta: { filterType: "number" as const },
      cell: ({ getValue }) => {
        const v = getValue() as number | null;
        return <span className="font-mono text-right block">{v ?? "-"}</span>;
      },
    },
    {
      accessorKey: "status", header: t("common.status"), size: 90,
      meta: { filterType: "multi" as const },
      cell: ({ getValue }) => <ComCodeBadge groupCode="OQC_STATUS" code={getValue() as string} />,
    },
    {
      accessorKey: "inspectorName", header: t("quality.oqc.inspector"), size: 90,
      meta: { filterType: "text" as const },
      cell: ({ getValue }) => (getValue() as string) || "-",
    },
  ], [t, handleRowClick]);

  return (
    <div className="h-full flex flex-col overflow-hidden p-6 gap-4 animate-fade-in">
      <div className="flex justify-between items-center flex-shrink-0">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2">
            <ClipboardCheck className="w-7 h-7 text-primary" />
            {t("quality.oqc.title")}
          </h1>
          <p className="text-text-muted mt-1">{t("quality.oqc.description")}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={fetchData}>
            <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} />{t('common.refresh')}
          </Button>
          <Button size="sm" onClick={() => setIsRequestModalOpen(true)}>
            <Plus className="w-4 h-4 mr-1" /> {t("quality.oqc.createRequest")}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 flex-shrink-0">
        <StatCard label={t("quality.oqc.statTotal")} value={stats.total} icon={FileText} color="blue" />
        <StatCard label={t("quality.oqc.statPending")} value={stats.pending} icon={Clock} color="yellow" />
        <StatCard label={t("quality.oqc.statPass")} value={stats.pass} icon={CheckCircle} color="green" />
        <StatCard label={t("quality.oqc.statFail")} value={stats.fail} icon={XCircle} color="red" />
      </div>

      <Card className="flex-1 min-h-0 overflow-hidden" padding="none"><CardContent className="h-full p-4">
        <DataGrid
          data={data}
          columns={columns}
          isLoading={loading}
          enableColumnFilter
          enableExport
          exportFileName={t("quality.oqc.title")}
          toolbarLeft={
            <div className="flex gap-3 items-center flex-1 min-w-0 flex-wrap">
              <div className="flex-1 min-w-[200px]">
                <Input
                  placeholder={t("quality.oqc.searchPlaceholder")}
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  leftIcon={<Search className="w-4 h-4" />}
                  fullWidth
                />
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-text-muted" />
                <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-36" />
                <span className="text-text-muted">~</span>
                <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-36" />
              </div>
              <ComCodeSelect groupCode="OQC_STATUS" labelPrefix={t('common.status')} value={statusFilter} onChange={setStatusFilter} fullWidth />
            </div>
          }
        />
      </CardContent></Card>

      <OqcRequestModal
        isOpen={isRequestModalOpen}
        onClose={() => setIsRequestModalOpen(false)}
        onSuccess={fetchData}
      />

      {selectedRequest && (
        <OqcInspectModal
          isOpen={isInspectModalOpen}
          onClose={() => { setIsInspectModalOpen(false); setSelectedRequest(null); }}
          requestId={selectedRequest.id}
          onSuccess={fetchData}
        />
      )}
    </div>
  );
}
