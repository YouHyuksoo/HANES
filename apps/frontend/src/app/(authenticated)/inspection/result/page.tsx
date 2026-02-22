"use client";

/**
 * @file src/app/(authenticated)/inspection/result/page.tsx
 * @description 통전검사 실적 페이지 - PASS/FAIL 검사 결과 조회, 시리얼별 검사 이력
 *
 * 초보자 가이드:
 * 1. **검사 결과 목록**: DataGrid로 시리얼, 결과, 에러코드 표시
 * 2. **통계 카드**: 합격률, 검사건수 실시간 통계
 * 3. **필터링**: 날짜, 결과, 검사기 필터
 * 4. API: GET /inspection/results
 */
import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { ColumnDef } from "@tanstack/react-table";
import { RefreshCw, Calendar, CheckCircle, XCircle, TrendingUp, Activity, Cpu, Search } from "lucide-react";
import { Card, CardContent, Button, Input, Select, StatCard, ComCodeBadge } from "@/components/ui";
import DataGrid from "@/components/data-grid/DataGrid";
import api from "@/services/api";

interface InspectRecord {
  id: string;
  inspectedAt: string;
  serialNo: string;
  result: string;
  errorCode?: string;
  errorDesc?: string;
  workOrderNo: string;
  equipmentNo: string;
  voltage: number;
  current: number;
}

export default function ResultPage() {
  const { t } = useTranslation();
  const [data, setData] = useState<InspectRecord[]>([]);
  const [loading, setLoading] = useState(false);

  const resultOptions = useMemo(() => [
    { value: "", label: t("inspection.result.allResults") },
    { value: "PASS", label: t("inspection.result.pass") },
    { value: "FAIL", label: t("inspection.result.fail") },
  ], [t]);

  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [resultFilter, setResultFilter] = useState("");
  const [searchSerial, setSearchSerial] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { limit: "5000" };
      if (searchSerial) params.search = searchSerial;
      if (resultFilter) params.result = resultFilter;
      if (dateFrom) params.dateFrom = dateFrom;
      if (dateTo) params.dateTo = dateTo;
      const res = await api.get("/inspection/results", { params });
      setData(res.data?.data ?? []);
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [searchSerial, resultFilter, dateFrom, dateTo]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const stats = useMemo(() => {
    const total = data.length;
    const passed = data.filter((r) => r.result === "PASS").length;
    const failed = total - passed;
    const passRate = total > 0 ? ((passed / total) * 100).toFixed(1) : "0.0";
    return { total, passed, failed, passRate };
  }, [data]);

  const columns = useMemo<ColumnDef<InspectRecord>[]>(() => [
    { accessorKey: "inspectedAt", header: t("inspection.result.inspectedAt"), size: 150 },
    { accessorKey: "serialNo", header: t("inspection.result.serialNo"), size: 170, meta: { filterType: "text" as const }, cell: ({ getValue }) => <span className="font-mono text-sm">{getValue() as string}</span> },
    { accessorKey: "result", header: t("inspection.result.resultCol"), size: 80, cell: ({ getValue }) => <ComCodeBadge groupCode="INSPECT_RESULT" code={getValue() as string} /> },
    { accessorKey: "errorCode", header: t("inspection.result.errorCode"), size: 80, cell: ({ getValue }) => (getValue() as string) || <span className="text-text-muted">-</span> },
    { accessorKey: "errorDesc", header: t("inspection.result.errorDesc"), size: 150, cell: ({ getValue }) => (getValue() as string) || <span className="text-text-muted">-</span> },
    { accessorKey: "voltage", header: t("inspection.result.voltage"), size: 80, cell: ({ getValue }) => <span className="font-mono">{(getValue() as number).toFixed(1)}</span> },
    { accessorKey: "current", header: t("inspection.result.current"), size: 80, cell: ({ getValue }) => <span className="font-mono">{(getValue() as number).toFixed(2)}</span> },
    { accessorKey: "equipmentNo", header: t("inspection.result.equipmentNo"), size: 90, meta: { filterType: "text" as const } },
  ], [t]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2"><Cpu className="w-7 h-7 text-primary" />{t("inspection.result.title")}</h1>
          <p className="text-text-muted mt-1">{t("inspection.result.description")}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label={t("inspection.result.totalInspections")} value={`${stats.total}${t("common.count")}`} icon={Activity} color="blue" />
        <StatCard label={t("inspection.result.passRate")} value={`${stats.passRate}%`} icon={TrendingUp} color="green" />
        <StatCard label={t("inspection.result.pass")} value={`${stats.passed}${t("common.count")}`} icon={CheckCircle} color="green" />
        <StatCard label={t("inspection.result.fail")} value={`${stats.failed}${t("common.count")}`} icon={XCircle} color="red" />
      </div>

      <Card><CardContent>
        <DataGrid
          data={data}
          columns={columns}
          isLoading={loading}
          enableColumnFilter
          enableExport
          exportFileName={t("inspection.result.title")}
          toolbarLeft={
            <div className="flex gap-3 items-center flex-1 min-w-0 flex-wrap">
              <div className="flex-1 min-w-[200px]">
                <Input placeholder={t("inspection.result.searchPlaceholder")} value={searchSerial} onChange={(e) => setSearchSerial(e.target.value)} leftIcon={<Search className="w-4 h-4" />} fullWidth />
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-text-muted" />
                <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-36" />
                <span className="text-text-muted">~</span>
                <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-36" />
              </div>
              <Select options={resultOptions} value={resultFilter} onChange={setResultFilter} placeholder={t("inspection.result.resultCol")} />
              <Button variant="secondary" onClick={fetchData}>
                <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              </Button>
            </div>
          }
        />
      </CardContent></Card>
    </div>
  );
}
