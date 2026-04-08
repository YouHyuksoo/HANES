"use client";

/**
 * @file src/app/(authenticated)/equipment/calibration-history/page.tsx
 * @description 계측기 교정이력 조회 페이지 - 전체 교정 로그 통합 조회
 *
 * 초보자 가이드:
 * 1. 모든 계측기의 교정 이력을 통합 조회
 * 2. 교정결과(PASS/FAIL), 교정기관, 교정일 등 필터
 * 3. API: GET /quality/msa/calibrations (전체 조회)
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { ColumnDef } from "@tanstack/react-table";
import { History, Search, RefreshCw, CheckCircle, XCircle, AlertTriangle } from "lucide-react";
import { Card, CardContent, Button, Input, Select, StatCard, ComCodeBadge } from "@/components/ui";
import ComCodeSelect from "@/components/shared/ComCodeSelect";
import DataGrid from "@/components/data-grid/DataGrid";
import api from "@/services/api";

interface CalibrationRow {
  calibrationNo: string;
  gaugeCode: string;
  gaugeName: string;
  calibrationDate: string;
  calibrationType: string;
  calibrator: string;
  calibrationOrg: string;
  result: string;
  measuredValue: string | null;
  referenceValue: string | null;
  deviation: string | null;
  uncertainty: string | null;
  certificateNo: string | null;
}

const resultColors: Record<string, string> = {
  PASS: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  FAIL: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
  CONDITIONAL: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
};

export default function CalibrationHistoryPage() {
  const { t } = useTranslation();
  const [data, setData] = useState<CalibrationRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [resultFilter, setResultFilter] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { limit: "5000" };
      if (searchText) params.search = searchText;
      if (resultFilter) params.result = resultFilter;
      const res = await api.get("/quality/msa/calibrations", { params });
      const items = res.data?.data ?? [];
      setData(Array.isArray(items) ? items : []);
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [searchText, resultFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const stats = useMemo(() => ({
    total: data.length,
    pass: data.filter(d => d.result === "PASS").length,
    fail: data.filter(d => d.result === "FAIL").length,
  }), [data]);

  const columns = useMemo<ColumnDef<CalibrationRow>[]>(() => [
    {
      accessorKey: "calibrationDate", header: t("equipment.calibrationHistory.date", "교정일"), size: 100,
      meta: { filterType: "date" as const },
    },
    {
      accessorKey: "calibrationNo", header: t("equipment.calibrationHistory.calNo", "교정번호"), size: 130,
      meta: { filterType: "text" as const },
      cell: ({ getValue }) => <span className="font-mono text-sm">{getValue() as string}</span>,
    },
    {
      accessorKey: "gaugeCode", header: t("equipment.calibrationHistory.gaugeCode", "계측기코드"), size: 120,
      meta: { filterType: "text" as const },
      cell: ({ getValue }) => <span className="font-mono text-sm">{getValue() as string}</span>,
    },
    {
      accessorKey: "gaugeName", header: t("equipment.calibrationHistory.gaugeName", "계측기명"), size: 150,
      meta: { filterType: "text" as const },
    },
    {
      accessorKey: "result", header: t("equipment.calibrationHistory.result", "결과"), size: 80,
      meta: { filterType: "multi" as const },
      cell: ({ getValue }) => {
        const r = getValue() as string;
        return <span className={`px-2 py-0.5 text-xs rounded font-medium ${resultColors[r] || ""}`}>{r}</span>;
      },
    },
    {
      accessorKey: "calibrationOrg", header: t("equipment.calibrationHistory.org", "교정기관"), size: 120,
      meta: { filterType: "text" as const },
    },
    {
      accessorKey: "calibrator", header: t("equipment.calibrationHistory.calibrator", "교정자"), size: 90,
      meta: { filterType: "text" as const },
    },
    {
      accessorKey: "certificateNo", header: t("equipment.calibrationHistory.certNo", "성적서번호"), size: 120,
      meta: { filterType: "text" as const },
      cell: ({ getValue }) => (getValue() as string) || "-",
    },
    {
      accessorKey: "measuredValue", header: t("equipment.calibrationHistory.measured", "측정값"), size: 80,
      cell: ({ getValue }) => (getValue() as string) || "-",
    },
    {
      accessorKey: "referenceValue", header: t("equipment.calibrationHistory.reference", "기준값"), size: 80,
      cell: ({ getValue }) => (getValue() as string) || "-",
    },
  ], [t]);

  return (
    <div className="h-full flex flex-col overflow-hidden p-6 gap-4 animate-fade-in">
      <div className="flex justify-between items-center flex-shrink-0">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2">
            <History className="w-7 h-7 text-primary" />
            {t("equipment.calibrationHistory.title", "계측기 교정이력")}
          </h1>
          <p className="text-text-muted mt-1">{t("equipment.calibrationHistory.subtitle", "전체 계측기의 교정 이력을 조회합니다.")}</p>
        </div>
        <Button variant="secondary" size="sm" onClick={fetchData}>
          <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} />{t("common.refresh")}
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-3 flex-shrink-0">
        <StatCard label={t("equipment.calibrationHistory.statTotal", "전체 교정")} value={stats.total} icon={History} color="blue" />
        <StatCard label="PASS" value={stats.pass} icon={CheckCircle} color="green" />
        <StatCard label="FAIL" value={stats.fail} icon={XCircle} color="red" />
      </div>

      <Card className="flex-1 min-h-0 overflow-hidden" padding="none"><CardContent className="h-full p-4">
        <DataGrid data={data} columns={columns} isLoading={loading} enableColumnFilter
          enableExport exportFileName={t("equipment.calibrationHistory.title", "계측기교정이력")}
          toolbarLeft={
            <div className="flex gap-3 flex-1 min-w-0">
              <div className="flex-1 min-w-0">
                <Input placeholder={t("equipment.calibrationHistory.searchPlaceholder", "교정번호, 계측기코드 검색...")}
                  value={searchText} onChange={e => setSearchText(e.target.value)}
                  leftIcon={<Search className="w-4 h-4" />} fullWidth />
              </div>
              <div className="w-36 flex-shrink-0">
                <ComCodeSelect groupCode="INSPECT_RESULT" labelPrefix={t("common.result", "결과")}
                  value={resultFilter} onChange={setResultFilter} fullWidth />
              </div>
            </div>
          } />
      </CardContent></Card>
    </div>
  );
}
