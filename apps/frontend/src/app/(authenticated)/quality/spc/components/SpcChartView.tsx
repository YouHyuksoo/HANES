"use client";

/**
 * @file quality/spc/components/SpcChartView.tsx
 * @description SPC 측정 데이터 조회 우측 슬라이드 패널 (테이블 기반)
 *
 * 초보자 가이드:
 * 1. 선택된 관리도의 측정 데이터를 테이블로 표시
 * 2. Cpk/Ppk 값 상단에 표시, 이탈 여부(outOfControl) 강조
 * 3. 새 측정 데이터 추가 버튼 제공
 * 4. API: GET /quality/spc/charts/chart-data/:id, GET cpk/:id, POST spc-data
 */
import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { X, Plus, RefreshCw, AlertTriangle } from "lucide-react";
import { ColumnDef } from "@tanstack/react-table";
import { Button, Input, Card, CardContent } from "@/components/ui";
import DataGrid from "@/components/data-grid/DataGrid";
import api from "@/services/api";

/** 측정 데이터 행 */
interface SpcDataRow {
  id: number;
  sampleDate: string;
  subgroupNo: number;
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
  chart: { id: number; chartNo: string; characteristicName: string };
  onClose: () => void;
}

export default function SpcChartView({ chart, onClose }: Props) {
  const { t } = useTranslation();
  const [data, setData] = useState<SpcDataRow[]>([]);
  const [cpkResult, setCpkResult] = useState<CpkResult | null>(null);
  const [loading, setLoading] = useState(false);

  /* -- 측정값 입력 상태 -- */
  const [showAddForm, setShowAddForm] = useState(false);
  const [newValues, setNewValues] = useState("");
  const [addingSaving, setAddingSaving] = useState(false);

  /* -- 데이터 조회 -- */
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [dataRes, cpkRes] = await Promise.all([
        api.get(`/quality/spc/charts/chart-data/${chart.id}`),
        api.get(`/quality/spc/charts/cpk/${chart.id}`),
      ]);
      setData(dataRes.data?.data ?? dataRes.data ?? []);
      setCpkResult(cpkRes.data ?? null);
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [chart.id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  /* -- 측정 데이터 추가 -- */
  const handleAddData = useCallback(async () => {
    if (!newValues.trim()) return;
    setAddingSaving(true);
    try {
      const values = newValues.split(",").map(v => Number(v.trim())).filter(v => !isNaN(v));
      await api.post("/quality/spc/spc-data", { chartId: chart.id, values });
      setNewValues("");
      setShowAddForm(false);
      fetchData();
    } catch {
      // api 인터셉터에서 처리
    } finally {
      setAddingSaving(false);
    }
  }, [newValues, chart.id, fetchData]);

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

  const fmtNum = (v: number | null | undefined) => v != null ? v.toFixed(4) : "-";

  return (
    <div className="w-[600px] border-l border-border bg-background flex flex-col h-full overflow-hidden shadow-2xl text-xs animate-slide-in-right">
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

      {/* 데이터 추가 폼 */}
      {showAddForm && (
        <div className="px-5 py-3 border-b border-border bg-white dark:bg-slate-900">
          <label className="block text-xs font-medium text-text mb-1">{t("quality.spc.addData")}</label>
          <div className="flex gap-2">
            <Input placeholder="1.23, 1.25, 1.22, 1.24, 1.23" value={newValues}
              onChange={e => setNewValues(e.target.value)} fullWidth />
            <Button size="sm" onClick={handleAddData} disabled={addingSaving || !newValues.trim()}>
              {addingSaving ? t("common.saving") : t("common.add")}
            </Button>
          </div>
        </div>
      )}

      {/* 데이터 테이블 */}
      <div className="flex-1 min-h-0 overflow-hidden p-4">
        <DataGrid data={data} columns={columns} isLoading={loading}
          getRowId={row => String((row as SpcDataRow).id)} />
      </div>
    </div>
  );
}
