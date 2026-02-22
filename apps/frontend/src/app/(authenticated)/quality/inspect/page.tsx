"use client";

/**
 * @file src/app/(authenticated)/quality/inspect/page.tsx
 * @description 검사실적 페이지 - 검사 결과 조회, 합격률 통계
 *
 * 초보자 가이드:
 * 1. **검사 결과 목록**: 시간, 시리얼, 검사유형, 합격여부, 에러코드
 * 2. **합격률 통계**: 일별/유형별 합격률 표시
 * 3. **필터**: 날짜, 합격/불합격 필터링
 * 4. API: GET /quality/inspections
 */
import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { ColumnDef } from "@tanstack/react-table";
import { RefreshCw, Calendar, CheckCircle, XCircle, TrendingUp, Activity, Clock, Search } from "lucide-react";
import { Card, CardContent, Button, Input, Select, ComCodeBadge, StatCard } from "@/components/ui";
import DataGrid from "@/components/data-grid/DataGrid";
import { useComCodeOptions } from "@/hooks/useComCode";
import api from "@/services/api";

type InspectType = "CONTINUITY" | "INSULATION" | "HI_POT" | "VISUAL";

interface InspectRecord {
  id: string;
  inspectedAt: string;
  serialNo: string;
  inspectType: InspectType;
  result: string;
  errorCode?: string;
  errorDesc?: string;
  workOrderNo: string;
  equipmentNo: string;
  inspectTime: number;
}

export default function InspectPage() {
  const { t } = useTranslation();
  const [data, setData] = useState<InspectRecord[]>([]);
  const [loading, setLoading] = useState(false);

  const comCodeResultOptions = useComCodeOptions("INSPECT_RESULT");
  const resultOptions = useMemo(() => [{ value: "", label: t("quality.inspect.allResults") }, ...comCodeResultOptions], [t, comCodeResultOptions]);
  const comCodeTypeOptions = useComCodeOptions("INSPECT_TYPE");
  const inspectTypeOptions = useMemo(() => [{ value: "", label: t("quality.inspect.allTypes") }, ...comCodeTypeOptions], [t, comCodeTypeOptions]);

  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [inspectType, setInspectType] = useState("");
  const [resultFilter, setResultFilter] = useState("");
  const [searchSerial, setSearchSerial] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { limit: "5000" };
      if (searchSerial) params.search = searchSerial;
      if (inspectType) params.inspectType = inspectType;
      if (resultFilter) params.result = resultFilter;
      if (dateFrom) params.dateFrom = dateFrom;
      if (dateTo) params.dateTo = dateTo;
      const res = await api.get("/quality/inspections", { params });
      setData(res.data?.data ?? []);
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [searchSerial, inspectType, resultFilter, dateFrom, dateTo]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const stats = useMemo(() => {
    const total = data.length;
    const passed = data.filter((r) => r.result === "PASS").length;
    const failed = data.filter((r) => r.result === "FAIL").length;
    const passRate = total > 0 ? ((passed / total) * 100).toFixed(1) : "0.0";
    const avgTime = total > 0 ? (data.reduce((sum, r) => sum + r.inspectTime, 0) / total).toFixed(1) : "0.0";

    const byType: Record<InspectType, { total: number; passed: number }> = {
      CONTINUITY: { total: 0, passed: 0 },
      INSULATION: { total: 0, passed: 0 },
      HI_POT: { total: 0, passed: 0 },
      VISUAL: { total: 0, passed: 0 },
    };
    data.forEach((r) => {
      if (byType[r.inspectType]) {
        byType[r.inspectType].total += 1;
        if (r.result === "PASS") byType[r.inspectType].passed += 1;
      }
    });

    return { total, passed, failed, passRate, avgTime, byType };
  }, [data]);

  const columns = useMemo<ColumnDef<InspectRecord>[]>(() => [
    { accessorKey: "inspectedAt", header: t("quality.inspect.inspectedAt"), size: 150 },
    { accessorKey: "serialNo", header: t("quality.inspect.serialNo"), size: 170, meta: { filterType: "text" as const }, cell: ({ getValue }) => <span className="font-mono text-sm">{getValue() as string}</span> },
    { accessorKey: "inspectType", header: t("quality.inspect.inspectType"), size: 100, cell: ({ getValue }) => <ComCodeBadge groupCode="INSPECT_TYPE" code={getValue() as string} /> },
    { accessorKey: "result", header: t("quality.inspect.resultCol"), size: 80, cell: ({ getValue }) => <ComCodeBadge groupCode="INSPECT_RESULT" code={getValue() as string} /> },
    { accessorKey: "errorCode", header: t("quality.inspect.errorCode"), size: 80, cell: ({ getValue }) => { const code = getValue() as string | undefined; return code ? <span className="text-red-500 font-mono">{code}</span> : <span className="text-text-muted">-</span>; } },
    { accessorKey: "errorDesc", header: t("quality.inspect.errorDesc"), size: 150, cell: ({ getValue }) => { const desc = getValue() as string | undefined; return desc || <span className="text-text-muted">-</span>; } },
    { accessorKey: "inspectTime", header: t("quality.inspect.inspectTime"), size: 80, cell: ({ getValue }) => <span className="font-mono">{getValue() as number}{t("common.seconds")}</span> },
    { accessorKey: "equipmentNo", header: t("quality.inspect.equipment"), size: 80, meta: { filterType: "text" as const } },
  ], [t]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2"><Activity className="w-7 h-7 text-primary" />{t("quality.inspect.title")}</h1>
          <p className="text-text-muted mt-1">{t("quality.inspect.description")}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={fetchData}>
            <RefreshCw className="w-4 h-4 mr-1" />{t('common.refresh')}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatCard label={t("quality.inspect.totalInspections")} value={`${stats.total}${t("common.count")}`} icon={Activity} color="blue" />
        <StatCard label={t("quality.inspect.passRate")} value={`${stats.passRate}%`} icon={TrendingUp} color="green" />
        <StatCard label={t("quality.inspect.pass")} value={`${stats.passed}${t("common.count")}`} icon={CheckCircle} color="green" />
        <StatCard label={t("quality.inspect.fail")} value={`${stats.failed}${t("common.count")}`} icon={XCircle} color="red" />
        <StatCard label={t("quality.inspect.avgTime")} value={`${stats.avgTime}${t("common.seconds")}`} icon={Clock} color="yellow" />
      </div>

      <Card><CardContent>
        <div className="text-sm font-medium text-text mb-3">{t("quality.inspect.passRateByType")}</div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {(Object.entries(stats.byType) as [InspectType, { total: number; passed: number }][]).map(([type, d]) => {
            const rate = d.total > 0 ? ((d.passed / d.total) * 100).toFixed(1) : "0.0";
            return (
              <div key={type} className="p-4 bg-background rounded-lg">
                <div className="mb-2"><ComCodeBadge groupCode="INSPECT_TYPE" code={type} /></div>
                <div className="text-lg font-bold leading-tight text-text">{rate}%</div>
                <div className="text-sm text-text-muted">{d.passed}/{d.total}{t("common.count")}</div>
                <div className="mt-2 h-2 bg-surface rounded-full overflow-hidden">
                  <div className="h-full bg-primary transition-all duration-500" style={{ width: `${rate}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </CardContent></Card>

      <Card><CardContent>
        <DataGrid
          data={data}
          columns={columns}
          isLoading={loading}
          enableColumnFilter
          enableExport
          exportFileName={t("quality.inspect.title")}
          toolbarLeft={
            <div className="flex gap-2 items-center flex-1 min-w-0 flex-wrap">
              <div className="flex-1 min-w-[200px]">
                <Input placeholder={t("quality.inspect.searchPlaceholder")} value={searchSerial} onChange={(e) => setSearchSerial(e.target.value)} leftIcon={<Search className="w-4 h-4" />} fullWidth />
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-text-muted" />
                <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-36" />
                <span className="text-text-muted">~</span>
                <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-36" />
              </div>
              <Select options={inspectTypeOptions} value={inspectType} onChange={setInspectType} placeholder={t("quality.inspect.inspectType")} />
              <Select options={resultOptions} value={resultFilter} onChange={setResultFilter} placeholder={t("quality.inspect.resultCol")} />
            </div>
          }
        />
      </CardContent></Card>
    </div>
  );
}
