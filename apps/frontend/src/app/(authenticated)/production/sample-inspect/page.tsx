"use client";

/**
 * @file src/app/(authenticated)/production/sample-inspect/page.tsx
 * @description 반제품 샘플검사 페이지 - 이력 조회 + 신규 입력 기능
 *
 * 초보자 가이드:
 * 1. **이력 조회**: API 연동 샘플검사 이력 (날짜, 합불, 검색 필터)
 * 2. **신규 입력**: 모달에서 작업지시 선택 → 샘플별 측정값 입력
 * 3. **통계**: 총검사/합격/불합격/합격률 StatCard
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Search, RefreshCw, FlaskConical, CheckCircle, XCircle, BarChart3, Plus } from "lucide-react";
import { Card, CardContent, Button, Input, Select, StatCard, ComCodeBadge } from "@/components/ui";
import DataGrid from "@/components/data-grid/DataGrid";
import { ColumnDef } from "@tanstack/react-table";
import { useComCodeOptions } from "@/hooks/useComCode";
import api from "@/services/api";
import SampleInspectInputModal from "./components/SampleInspectInputModal";

interface SampleInspectRow {
  id: string;
  jobOrderId: string;
  orderNo: string;
  partCode: string;
  partName: string;
  inspectDate: string;
  inspectorName: string;
  inspectType: string;
  sampleNo: number;
  measuredValue: string;
  specUpper: string;
  specLower: string;
  passYn: string;
  remark: string;
}

export default function SampleInspectPage() {
  const { t } = useTranslation();
  const comCodeJudgeOptions = useComCodeOptions("JUDGE_YN");

  const [data, setData] = useState<SampleInspectRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [passFilter, setPassFilter] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [showInput, setShowInput] = useState(false);

  const passOptions = useMemo(() => [
    { value: "", label: t("production.sampleInspect.allJudgment") }, ...comCodeJudgeOptions,
  ], [t, comCodeJudgeOptions]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (searchText) params.search = searchText;
      if (passFilter) params.passYn = passFilter;
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;
      const res = await api.get("/production/sample-inspect-input", { params });
      setData(res.data?.data ?? []);
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [searchText, passFilter, startDate, endDate]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const stats = useMemo(() => {
    const total = data.length;
    const pass = data.filter(d => d.passYn === "Y").length;
    const fail = data.filter(d => d.passYn === "N").length;
    const passRate = total > 0 ? Math.round((pass / total) * 100) : 0;
    return { total, pass, fail, passRate };
  }, [data]);

  const columns = useMemo<ColumnDef<SampleInspectRow>[]>(() => [
    {
      accessorKey: "inspectDate", header: t("production.sampleInspect.inspectDate"), size: 100,
      meta: { filterType: "text" as const },
      cell: ({ getValue }) => String(getValue() ?? "").slice(0, 10),
    },
    {
      accessorKey: "orderNo", header: t("production.sampleInspect.orderNo"), size: 160,
      meta: { filterType: "text" as const },
      cell: ({ getValue }) => <span className="font-mono text-sm">{getValue() as string}</span>,
    },
    {
      accessorKey: "partCode", header: t("common.partCode"), size: 110,
      meta: { filterType: "text" as const },
      cell: ({ getValue }) => <span className="font-mono text-sm">{(getValue() as string) || "-"}</span>,
    },
    {
      accessorKey: "partName", header: t("common.partName"), size: 140,
      meta: { filterType: "text" as const },
    },
    {
      accessorKey: "inspectType", header: t("production.sampleInspect.inspectType"), size: 90,
      meta: { filterType: "text" as const },
    },
    {
      accessorKey: "sampleNo", header: t("production.sampleInspect.sampleNo"), size: 60,
      meta: { filterType: "number" as const, align: "center" as const },
      cell: ({ getValue }) => <span className="font-mono">{getValue() as number}</span>,
    },
    {
      accessorKey: "measuredValue", header: t("production.sampleInspect.measuredValue"), size: 90,
      meta: { filterType: "text" as const, align: "right" as const },
      cell: ({ getValue }) => <span className="font-mono">{(getValue() as string) || "-"}</span>,
    },
    {
      accessorKey: "specLower", header: t("production.sampleInspect.specLower"), size: 70,
      meta: { filterType: "number" as const, align: "right" as const },
      cell: ({ getValue }) => <span className="text-text-muted">{(getValue() as string) || "-"}</span>,
    },
    {
      accessorKey: "specUpper", header: t("production.sampleInspect.specUpper"), size: 70,
      meta: { filterType: "number" as const, align: "right" as const },
      cell: ({ getValue }) => <span className="text-text-muted">{(getValue() as string) || "-"}</span>,
    },
    {
      accessorKey: "passYn", header: t("production.sampleInspect.judgment"), size: 80,
      meta: { filterType: "multi" as const },
      cell: ({ getValue }) => <ComCodeBadge groupCode="JUDGE_YN" code={getValue() as string} />,
    },
    {
      accessorKey: "inspectorName", header: t("production.sampleInspect.inspector"), size: 80,
      meta: { filterType: "text" as const },
    },
    {
      accessorKey: "remark", header: t("production.sampleInspect.remark"), size: 120,
      meta: { filterType: "text" as const },
    },
  ], [t]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2">
            <FlaskConical className="w-7 h-7 text-primary" />
            {t("production.sampleInspect.title")}
          </h1>
          <p className="text-text-muted mt-1">{t("production.sampleInspect.description")}</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" onClick={() => setShowInput(true)}>
            <Plus className="w-4 h-4 mr-1" /> {t("production.sampleInspect.inputBtn")}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label={t("production.sampleInspect.totalInspect")} value={stats.total} icon={FlaskConical} color="blue" />
        <StatCard label={t("production.sampleInspect.pass")} value={stats.pass} icon={CheckCircle} color="green" />
        <StatCard label={t("production.sampleInspect.fail")} value={stats.fail} icon={XCircle} color="red" />
        <StatCard label={t("production.sampleInspect.passRate")} value={`${stats.passRate}%`} icon={BarChart3} color="purple" />
      </div>

      <Card><CardContent>
        <DataGrid data={data} columns={columns} isLoading={loading} enableColumnFilter enableExport exportFileName="샘플검사"
          toolbarLeft={
            <div className="flex gap-3 flex-1 min-w-0">
              <div className="flex-1 min-w-0">
                <Input placeholder={t("production.sampleInspect.searchPlaceholder")}
                  value={searchText} onChange={e => setSearchText(e.target.value)}
                  leftIcon={<Search className="w-4 h-4" />} fullWidth />
              </div>
              <div className="w-36 flex-shrink-0">
                <Select options={passOptions}
                  value={passFilter} onChange={setPassFilter} fullWidth />
              </div>
              <div className="w-36 flex-shrink-0">
                <Input type="date"
                  value={startDate} onChange={e => setStartDate(e.target.value)} fullWidth />
              </div>
              <div className="w-36 flex-shrink-0">
                <Input type="date"
                  value={endDate} onChange={e => setEndDate(e.target.value)} fullWidth />
              </div>
              <Button variant="secondary" onClick={fetchData}>
                <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              </Button>
            </div>
          } />
      </CardContent></Card>

      <SampleInspectInputModal isOpen={showInput} onClose={() => setShowInput(false)} onCreated={fetchData} />
    </div>
  );
}
