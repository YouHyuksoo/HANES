"use client";

/**
 * @file src/app/(authenticated)/quality/rework-history/page.tsx
 * @description 재작업 현황 페이지 - 전체 재작업 이력 조회, 통계, CSV 내보내기
 *
 * 초보자 가이드:
 * 1. **재작업 이력**: 모든 상태의 재작업 건을 DataGrid로 조회
 * 2. **필터**: 기간(DateRange), 상태(Select), 라인(LineSelect), 불량유형(ComCodeSelect), 검색어
 * 3. **StatCard**: 전체건수, 합격건수, 불합격건수, 폐기건수
 * 4. **상태 배지**: ComCodeBadge (REWORK_STATUS)
 * 5. **내보내기**: DataGrid의 enableExport로 CSV 내보내기
 * 6. API: GET /quality/reworks (전체 조회)
 */
import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { ColumnDef } from "@tanstack/react-table";
import {
  RefreshCw,
  ClipboardList,
  CheckCircle,
  XCircle,
  Trash2,
  Calendar,
  Search,
} from "lucide-react";
import {
  Card,
  CardContent,
  Button,
  Input,
  Select,
  ComCodeBadge,
  StatCard,
} from "@/components/ui";
import DataGrid from "@/components/data-grid/DataGrid";
import { LineSelect, ComCodeSelect } from "@/components/shared";
import { useComCodeOptions } from "@/hooks/useComCode";
import api from "@/services/api";

/** 재작업 지시 레코드 타입 */
interface ReworkOrder {
  id: number;
  reworkNo: string;
  itemCode: string;
  itemName: string;
  reworkQty: number;
  passQty: number;
  failQty: number;
  status: string;
  defectType: string;
  lineCode: string;
  qcApproverCode: string;
  prodApproverCode: string;
  createdAt: string;
}

export default function ReworkHistoryPage() {
  const { t } = useTranslation();
  const [data, setData] = useState<ReworkOrder[]>([]);
  const [loading, setLoading] = useState(false);

  /* --- 필터 상태 --- */
  const [searchText, setSearchText] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [lineFilter, setLineFilter] = useState("");
  const [defectTypeFilter, setDefectTypeFilter] = useState("");

  /* --- 상태 Select 옵션 --- */
  const comStatusOptions = useComCodeOptions("REWORK_STATUS");
  const statusOptions = useMemo(
    () => [{ value: "", label: t("common.allStatus") }, ...comStatusOptions],
    [t, comStatusOptions],
  );

  /* --- 데이터 조회 --- */
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { limit: "5000" };
      if (searchText) params.search = searchText;
      if (statusFilter) params.status = statusFilter;
      if (lineFilter) params.lineCode = lineFilter;
      if (defectTypeFilter) params.defectType = defectTypeFilter;
      if (dateFrom) params.startDate = dateFrom;
      if (dateTo) params.endDate = dateTo;
      const res = await api.get("/quality/reworks", { params });
      setData(res.data?.data ?? []);
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [searchText, statusFilter, lineFilter, defectTypeFilter, dateFrom, dateTo]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  /* --- 통계 계산 --- */
  const stats = useMemo(() => {
    const total = data.length;
    const pass = data.filter((d) => d.status === "PASS").length;
    const fail = data.filter((d) => d.status === "FAIL").length;
    const scrap = data.filter((d) => d.status === "SCRAP").length;
    return { total, pass, fail, scrap };
  }, [data]);

  /* --- 컬럼 정의 --- */
  const columns = useMemo<ColumnDef<ReworkOrder>[]>(
    () => [
      {
        accessorKey: "reworkNo",
        header: t("quality.rework.reworkNo"),
        size: 170,
        meta: { filterType: "text" as const },
        cell: ({ getValue }) => (
          <span className="text-primary font-medium">
            {getValue() as string}
          </span>
        ),
      },
      {
        accessorKey: "itemCode",
        header: t("quality.rework.itemCode"),
        size: 120,
        meta: { filterType: "text" as const },
      },
      {
        accessorKey: "itemName",
        header: t("quality.rework.itemName"),
        size: 160,
        meta: { filterType: "text" as const },
      },
      {
        accessorKey: "reworkQty",
        header: t("quality.rework.reworkQty"),
        size: 100,
        meta: { filterType: "number" as const },
        cell: ({ getValue }) => (
          <span className="font-mono text-right block">
            {(getValue() as number).toLocaleString()}
          </span>
        ),
      },
      {
        accessorKey: "passQty",
        header: t("quality.rework.passQty"),
        size: 100,
        meta: { filterType: "number" as const },
        cell: ({ getValue }) => (
          <span className="font-mono text-right block text-green-600 dark:text-green-400">
            {(getValue() as number).toLocaleString()}
          </span>
        ),
      },
      {
        accessorKey: "failQty",
        header: t("quality.rework.failQty"),
        size: 100,
        meta: { filterType: "number" as const },
        cell: ({ getValue }) => (
          <span className="font-mono text-right block text-red-600 dark:text-red-400">
            {(getValue() as number).toLocaleString()}
          </span>
        ),
      },
      {
        accessorKey: "status",
        header: t("common.status"),
        size: 130,
        meta: { filterType: "multi" as const },
        cell: ({ getValue }) => (
          <ComCodeBadge groupCode="REWORK_STATUS" code={getValue() as string} />
        ),
      },
      {
        accessorKey: "qcApproverCode",
        header: t("quality.rework.qcApprove"),
        size: 110,
        meta: { filterType: "text" as const },
      },
      {
        accessorKey: "prodApproverCode",
        header: t("quality.rework.prodApprove"),
        size: 110,
        meta: { filterType: "text" as const },
      },
      {
        accessorKey: "createdAt",
        header: t("common.createdAt"),
        size: 150,
        meta: { filterType: "date" as const },
        cell: ({ getValue }) => {
          const val = getValue() as string;
          return val ? new Date(val).toLocaleString() : "-";
        },
      },
    ],
    [t],
  );

  return (
    <div className="space-y-6 animate-fade-in">
      {/* 헤더 */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2">
            <ClipboardList className="w-7 h-7 text-primary" />
            {t("quality.rework.historyTitle")}
          </h1>
          <p className="text-text-muted mt-1">
            {t("quality.rework.historySubtitle")}
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={fetchData}>
          <RefreshCw className="w-4 h-4 mr-1" />
          {t("common.refresh")}
        </Button>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          label={t("quality.rework.statsTotal")}
          value={stats.total}
          icon={ClipboardList}
          color="blue"
        />
        <StatCard
          label={t("quality.rework.statusPASS")}
          value={stats.pass}
          icon={CheckCircle}
          color="green"
        />
        <StatCard
          label={t("quality.rework.statusFAIL")}
          value={stats.fail}
          icon={XCircle}
          color="red"
        />
        <StatCard
          label={t("quality.rework.statusSCRAP")}
          value={stats.scrap}
          icon={Trash2}
          color="yellow"
        />
      </div>

      {/* DataGrid */}
      <Card>
        <CardContent>
          <DataGrid
            data={data}
            columns={columns}
            isLoading={loading}
            enableColumnFilter
            enableExport
            exportFileName={t("quality.rework.historyTitle")}
            toolbarLeft={
              <div className="flex gap-3 items-center flex-1 min-w-0 flex-wrap">
                {/* 검색어 */}
                <div className="flex-1 min-w-[200px]">
                  <Input
                    placeholder={t("common.searchPlaceholder")}
                    value={searchText}
                    onChange={(e) => setSearchText(e.target.value)}
                    leftIcon={<Search className="w-4 h-4" />}
                    fullWidth
                  />
                </div>
                {/* 기간 */}
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-text-muted" />
                  <Input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="w-36"
                  />
                  <span className="text-text-muted">~</span>
                  <Input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="w-36"
                  />
                </div>
                {/* 상태 */}
                <Select
                  options={statusOptions}
                  value={statusFilter}
                  onChange={setStatusFilter}
                  placeholder={t("common.status")}
                />
                {/* 라인 */}
                <LineSelect
                  value={lineFilter}
                  onChange={setLineFilter}
                  placeholder={t("quality.rework.line")}
                />
                {/* 불량유형 */}
                <ComCodeSelect
                  groupCode="DEFECT_TYPE"
                  value={defectTypeFilter}
                  onChange={setDefectTypeFilter}
                  placeholder={t("quality.rework.defectType")}
                />
              </div>
            }
          />
        </CardContent>
      </Card>
    </div>
  );
}
