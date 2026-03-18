"use client";

/**
 * @file quality/spc/components/SpcChartView.tsx
 * @description SPC 측정 데이터 조회 우측 슬라이드 패널 (테이블 기반)
 *
 * 초보자 가이드:
 * 1. 선택된 관리도의 측정 데이터를 테이블로 표시
 * 2. Cpk/Ppk 값 상단에 표시, 이탈 여부(outOfControl) 강조
 * 3. 새 측정 데이터 추가 버튼 제공
 * 4. API: GET /quality/spc/charts/chart-data/:id, GET cpk/:id, POST data
 */
import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { X, Plus, RefreshCw, AlertTriangle, Download } from "lucide-react";
import { ColumnDef } from "@tanstack/react-table";
import { Button, Input, Card, CardContent } from "@/components/ui";
import DataGrid from "@/components/data-grid/DataGrid";
import api from "@/services/api";
import SpcControlCharts from "./SpcControlCharts";
import SpcHistogram from "./SpcHistogram";

/** 측정 데이터 행 */
interface SpcDataRow {
  id: number;
  sampleDate: string;
  subgroupNo: number;
  values?: string;
  mean: number | null;
  range: number | null;
  stdDev: number | null;
  outOfControl: boolean;
}

/** Cpk 응답 */
interface CpkResult {
  cpk: number | null;
  ppk: number | null;
  cp: number | null;
}

interface Props {
  chart: {
    id: number; chartNo: string; characteristicName: string;
    ucl?: number | null; lcl?: number | null; cl?: number | null;
    usl?: number | null; lsl?: number | null; target?: number | null;
    dataSource?: string;
  };
  onClose: () => void;
}

export default function SpcChartView({ chart, onClose }: Props) {
  const { t } = useTranslation();
  const [data, setData] = useState<SpcDataRow[]>([]);
  const [cpkResult, setCpkResult] = useState<CpkResult | null>(null);
  const [loading, setLoading] = useState(false);
  /** API 응답에서 받은 최신 관리한계 (prop보다 우선) */
  const [chartLimits, setChartLimits] = useState<{ ucl?: number | null; lcl?: number | null; cl?: number | null }>({
    ucl: chart.ucl, lcl: chart.lcl, cl: chart.cl,
  });

  /* -- MES 데이터 가져오기 상태 -- */
  const [showImport, setShowImport] = useState(false);
  const [importFrom, setImportFrom] = useState(() => {
    const d = new Date(); d.setMonth(d.getMonth() - 1);
    return d.toISOString().slice(0, 10);
  });
  const [importTo, setImportTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [importData, setImportData] = useState<{ source: string; date: string; values: number[] }[]>([]);
  const [importLoading, setImportLoading] = useState(false);

  /* -- 측정값 입력 상태 -- */
  const [showAddForm, setShowAddForm] = useState(false);
  const [newValues, setNewValues] = useState("");
  const [newSampleDate, setNewSampleDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [newSubgroupNo, setNewSubgroupNo] = useState(1);
  const [addingSaving, setAddingSaving] = useState(false);

  /* -- MES 데이터 조회 -- */
  const handleFetchMes = useCallback(async () => {
    setImportLoading(true);
    try {
      const res = await api.get(`/quality/spc/fetch-measurements/${chart.chartNo}`, {
        params: { from: importFrom, to: importTo },
      });
      setImportData(res.data?.data?.measurements ?? []);
    } catch { /* 에러 모달에서 처리 */ }
    finally { setImportLoading(false); }
  }, [chart.chartNo, importFrom, importTo]);

  /* -- 데이터 조회 -- */
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const dataRes = await api.get(`/quality/spc/charts/chart-data/${chart.chartNo}`);
      const chartDataRes = dataRes.data?.data ?? dataRes.data ?? {};
      const rows = Array.isArray(chartDataRes) ? chartDataRes : (chartDataRes.data ?? []);
      setData(rows);
      /* API 응답에서 최신 관리한계 갱신 */
      if (chartDataRes.chart) {
        setChartLimits({ ucl: chartDataRes.chart.ucl, lcl: chartDataRes.chart.lcl, cl: chartDataRes.chart.cl });
      }
      /* 다음 서브그룹 번호 자동 세팅 */
      if (Array.isArray(rows) && rows.length > 0) {
        const maxNo = Math.max(...rows.map((r: SpcDataRow) => r.subgroupNo ?? 0));
        setNewSubgroupNo(maxNo + 1);
      } else {
        setNewSubgroupNo(1);
      }
      /* Cpk: 데이터 2건 이상일 때만 조회 */
      if (rows.length >= 2) {
        const cpkRes = await api.get(`/quality/spc/charts/cpk/${chart.chartNo}`);
        setCpkResult(cpkRes.data?.data ?? cpkRes.data ?? null);
      } else {
        setCpkResult(null);
      }
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [chart.chartNo]);

  useEffect(() => { fetchData(); }, [fetchData]);

  /* -- MES 데이터 일괄 등록 -- */
  const handleImportConfirm = useCallback(async () => {
    if (importData.length === 0) return;
    setImportLoading(true);
    try {
      const baseNo = data.length > 0 ? Math.max(...data.map(d => d.subgroupNo ?? 0)) + 1 : 1;
      for (let i = 0; i < importData.length; i++) {
        const m = importData[i];
        await api.post("/quality/spc/data", {
          chartId: chart.id,
          sampleDate: m.date,
          subgroupNo: baseNo + i,
          values: m.values,
        });
      }
      setShowImport(false);
      setImportData([]);
      fetchData();
    } catch { /* 에러 모달에서 처리 */ }
    finally { setImportLoading(false); }
  }, [importData, data, chart.id, fetchData]);

  /* -- 측정 데이터 추가 -- */
  const handleAddData = useCallback(async () => {
    if (!newValues.trim()) return;
    setAddingSaving(true);
    try {
      const values: number[] = newValues.split(",").map(v => Number(v.trim())).filter(v => !isNaN(v));
      await api.post("/quality/spc/data", {
        chartId: chart.id,
        sampleDate: newSampleDate,
        subgroupNo: newSubgroupNo,
        values,
      });
      setNewValues("");
      setShowAddForm(false);
      fetchData();
    } catch {
      // api 인터셉터에서 처리
    } finally {
      setAddingSaving(false);
    }
  }, [newValues, newSampleDate, newSubgroupNo, chart.id, fetchData]);

  /* -- 컬럼 정의 -- */
  const columns = useMemo<ColumnDef<SpcDataRow>[]>(() => [
    { accessorKey: "sampleDate", header: t("quality.spc.sampleDate"), size: 120,
      cell: ({ getValue }) => (getValue() as string)?.slice(0, 10) },
    { accessorKey: "subgroupNo", header: "#", size: 60 },
    { accessorKey: "mean", header: t("quality.spc.mean"), size: 100,
      cell: ({ getValue }) => (getValue() as number)?.toFixed(4) ?? "-" },
    { accessorKey: "range", header: t("quality.spc.range"), size: 100,
      cell: ({ getValue }) => (getValue() as number)?.toFixed(4) ?? "-" },
    { accessorKey: "stdDev", header: t("quality.spc.stdDev"), size: 100,
      cell: ({ getValue }) => (getValue() as number)?.toFixed(4) ?? "-" },
    { accessorKey: "outOfControl", header: t("quality.spc.outOfControl"), size: 90,
      cell: ({ getValue }) => getValue() ? (
        <span className="flex items-center gap-1 text-red-600 dark:text-red-400 font-bold">
          <AlertTriangle className="w-3.5 h-3.5" />OOC
        </span>
      ) : <span className="text-green-600 dark:text-green-400">OK</span> },
  ], [t]);

  /** 전체 개별 측정값 추출 (히스토그램용) */
  const allValues = useMemo(() => {
    const vals: number[] = [];
    data.forEach((row) => {
      if (!row.values) return;
      try {
        const parsed = JSON.parse(row.values);
        if (Array.isArray(parsed)) parsed.forEach((v: number) => { if (typeof v === "number") vals.push(v); });
      } catch { /* ignore */ }
    });
    return vals;
  }, [data]);

  const fmtNum = (v: number | null | undefined) => v != null ? v.toFixed(4) : "-";

  return (
    <div className="w-[700px] border-l border-border bg-background flex flex-col h-full overflow-hidden shadow-2xl text-xs animate-slide-in-right relative z-10">
      {/* 헤더 */}
      <div className="px-5 py-3 border-b border-border flex items-center justify-between flex-shrink-0">
        <div>
          <h2 className="text-sm font-bold text-text">{chart.chartNo}</h2>
          <p className="text-text-muted">{chart.characteristicName}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="secondary" onClick={() => setShowAddForm(!showAddForm)}>
            <Plus className="w-4 h-4 mr-1" />{t("quality.spc.addData")}
          </Button>
          <Button size="sm"
            disabled={chart.dataSource === "MANUAL"}
            title={chart.dataSource === "MANUAL" ? "수동입력 모드 — 관리도 설정에서 데이터 소스를 변경하세요" : undefined}
            onClick={() => { setShowImport(!showImport); if (!showImport) handleFetchMes(); }}>
            <Download className="w-4 h-4 mr-1" />{t("quality.spc.importData", "데이터 가져오기")}
          </Button>
          <Button size="sm" variant="secondary" onClick={fetchData}>
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
          <button onClick={onClose} className="p-1 hover:bg-muted rounded">
            <X className="w-5 h-5 text-text-muted" />
          </button>
        </div>
      </div>

      {/* Cpk/Ppk 요약 */}
      {cpkResult && (
        <div className="px-5 py-2 border-b border-border flex gap-4 bg-white dark:bg-slate-900">
          <div className="flex items-center gap-1.5">
            <span className="text-text-muted">Cpk:</span>
            <span className="font-bold text-text">{fmtNum(cpkResult.cpk)}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-text-muted">Ppk:</span>
            <span className="font-bold text-text">{fmtNum(cpkResult.ppk)}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-text-muted">Cp:</span>
            <span className="font-bold text-text">{fmtNum(cpkResult.cp)}</span>
          </div>
        </div>
      )}

      {/* 스크롤 가능 본문 */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {/* Xbar-R 관리도 차트 */}
        {data.length > 0 && (
          <div className="px-4 py-2 border-b border-border">
            <SpcControlCharts
              data={data.map(d => ({ subgroupNo: d.subgroupNo, mean: d.mean, range: d.range, outOfControl: d.outOfControl }))}
              limits={chartLimits}
            />
          </div>
        )}

        {/* 히스토그램 */}
        {allValues.length > 0 && (
          <div className="px-4 py-2 border-b border-border">
            <SpcHistogram allValues={allValues} usl={chart.usl} lsl={chart.lsl} target={chart.target} />
          </div>
        )}

        {/* MES 데이터 가져오기 패널 */}
        {showImport && (
          <div className="px-5 py-3 border-b border-border bg-blue-50 dark:bg-blue-950/30">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-semibold text-blue-700 dark:text-blue-400">
                {t("quality.spc.importData", "데이터 가져오기")}
              </span>
              <span className="text-[11px] text-text-muted">수입검사 · 공정검사 · 초물검사 통합</span>
            </div>
            <div className="flex gap-2 mb-2 items-end">
              <Input label={t("common.from", "시작일")} type="date" value={importFrom}
                onChange={e => setImportFrom(e.target.value)} />
              <Input label={t("common.to", "종료일")} type="date" value={importTo}
                onChange={e => setImportTo(e.target.value)} />
              <Button size="sm" variant="secondary" onClick={handleFetchMes} disabled={importLoading}>
                <RefreshCw className={`w-3.5 h-3.5 mr-1 ${importLoading ? "animate-spin" : ""}`} />
                {t("common.search", "조회")}
              </Button>
            </div>
            {importData.length === 0 ? (
              <p className="text-xs text-text-muted py-2">
                {importLoading ? t("common.loading", "조회 중...") : t("quality.spc.noMesData", "해당 기간에 가져올 측정 데이터가 없습니다.")}
              </p>
            ) : (
              <div>
                <div className="max-h-[120px] overflow-y-auto border border-border rounded mb-2 bg-white dark:bg-slate-900">
                  <table className="w-full text-[11px]">
                    <thead className="sticky top-0 bg-surface">
                      <tr className="border-b border-border text-text-muted">
                        <th className="px-2 py-1 text-left">#</th>
                        <th className="px-2 py-1 text-left">{t("common.source", "소스")}</th>
                        <th className="px-2 py-1 text-left">{t("quality.spc.sampleDate")}</th>
                        <th className="px-2 py-1 text-left">{t("quality.spc.measuredValues", "측정값")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {importData.map((m, i) => (
                        <tr key={i} className="border-b border-border/50">
                          <td className="px-2 py-1 text-text-muted">{i + 1}</td>
                          <td className="px-2 py-1">
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                              m.source === 'IQC' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                              : m.source === 'PROCESS' ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                              : 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300'
                            }`}>{m.source === 'IQC' ? '수입검사' : m.source === 'PROCESS' ? '공정검사' : '초물검사'}</span>
                          </td>
                          <td className="px-2 py-1">{m.date}</td>
                          <td className="px-2 py-1 font-mono">{(m.values ?? []).map(v => Number(v).toFixed(3)).join(", ")}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-text-muted">{importData.length}건 발견</span>
                  <div className="flex gap-2">
                    <Button size="sm" variant="ghost" onClick={() => setImportData([])}>
                      {t("common.reset", "초기화")}
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => { setShowImport(false); setImportData([]); }}>
                      {t("common.cancel")}
                    </Button>
                    <Button size="sm" onClick={handleImportConfirm} disabled={importLoading}>
                      {importLoading ? t("common.saving") : `${importData.length}건 등록`}
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 데이터 추가 폼 */}
        {showAddForm && (
          <div className="px-5 py-3 border-b border-border bg-white dark:bg-slate-900">
            <label className="block text-xs font-medium text-text mb-1">{t("quality.spc.addData")}</label>
            <div className="flex gap-2 mb-2">
              <Input label={t("quality.spc.sampleDate")} type="date" value={newSampleDate}
                onChange={e => setNewSampleDate(e.target.value)} />
              <Input label={t("quality.spc.subgroupNo")} type="number" value={String(newSubgroupNo)}
                onChange={e => setNewSubgroupNo(Number(e.target.value) || 1)} className="w-24" />
            </div>
            <div className="flex gap-2">
              <Input placeholder="1.23, 1.25, 1.22, 1.24, 1.23" value={newValues}
                onChange={e => setNewValues(e.target.value)} fullWidth />
              <Button size="sm" variant="secondary" onClick={() => { setShowAddForm(false); setNewValues(""); }}>
                {t("common.cancel")}
              </Button>
              <Button size="sm" onClick={handleAddData} disabled={addingSaving || !newValues.trim()}>
                {addingSaving ? t("common.saving") : t("common.add")}
              </Button>
            </div>
          </div>
        )}

        {/* 데이터 테이블 */}
        <div className="p-4">
          <DataGrid data={data} columns={columns} isLoading={loading}
            getRowId={row => String((row as SpcDataRow).id)} />
        </div>
      </div>
    </div>
  );
}
