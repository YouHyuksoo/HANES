"use client";

/**
 * @file src/app/(authenticated)/quality/msa/page.tsx
 * @description 계측기 교정관리 페이지 — IATF 16949 7.1.5 측정시스템분석(MSA)
 *
 * 초보자 가이드:
 * 1. **좌측 DataGrid**: 계측기 마스터 목록 (읽기 전용, 선택만 가능)
 * 2. **행 색상**: 교정만료(빨강), 30일 이내(노랑) 하이라이트
 * 3. **우측 패널**: 선택된 계측기의 교정 이력(CalibrationList) + 교정 추가
 * 4. 계측기 등록/수정은 설비관리 > 계측기 마스터(/master/gauge)에서 수행
 * 5. API: GET /quality/gauges, GET/POST /quality/calibrations
 */
import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { ColumnDef } from "@tanstack/react-table";
import { RefreshCw, AlertTriangle, Ruler } from "lucide-react";
import { Card, CardContent, Button, ComCodeBadge } from "@/components/ui";
import DataGrid from "@/components/data-grid/DataGrid";
import { ComCodeSelect } from "@/components/shared";
import api from "@/services/api";
import CalibrationList from "./components/CalibrationList";

/** 계측기 데이터 타입 */
interface Gauge {
  id: number;
  gaugeCode: string;
  gaugeName: string;
  gaugeType: string;
  serialNo: string;
  manufacturer: string;
  calibrationCycle: number;
  lastCalibrationDate: string;
  nextCalibrationDate: string;
  status: string;
  location: string;
}

/** 다음 교정일 기준 행 상태 계산 */
function getRowDateStatus(nextDate?: string): "overdue" | "warning" | "normal" {
  if (!nextDate) return "normal";
  const next = new Date(nextDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = (next.getTime() - today.getTime()) / (1000 * 60 * 60 * 24);
  if (diff < 0) return "overdue";
  if (diff <= 30) return "warning";
  return "normal";
}

export default function MsaPage() {
  const { t } = useTranslation();
  const [data, setData] = useState<Gauge[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedRow, setSelectedRow] = useState<Gauge | null>(null);

  /* -- 필터 -- */
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [expiringOnly, setExpiringOnly] = useState(false);

  /* -- 데이터 조회 -- */
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const url = expiringOnly ? "/quality/gauges/expiring-soon" : "/quality/gauges";
      const params: Record<string, string> = { limit: "5000" };
      if (typeFilter) params.gaugeType = typeFilter;
      if (statusFilter) params.status = statusFilter;
      if (expiringOnly) params.days = "30";
      const res = await api.get(url, { params });
      setData(res.data?.data ?? []);
    } catch { setData([]); } finally { setLoading(false); }
  }, [typeFilter, statusFilter, expiringOnly]);

  useEffect(() => { fetchData(); }, [fetchData]);

  /* -- 컬럼 정의 -- */
  const columns = useMemo<ColumnDef<Gauge>[]>(() => [
    { accessorKey: "gaugeCode", header: t("master.gauge.gaugeCode"), size: 130,
      meta: { filterType: "text" as const },
      cell: ({ getValue }) => (
        <span className="text-primary font-medium">{getValue() as string}</span>
      ),
    },
    { accessorKey: "gaugeName", header: t("master.gauge.gaugeName"), size: 180,
      meta: { filterType: "text" as const } },
    { accessorKey: "gaugeType", header: t("master.gauge.gaugeType"), size: 120,
      meta: { filterType: "multi" as const },
      cell: ({ getValue }) => (
        <ComCodeBadge groupCode="GAUGE_TYPE" code={getValue() as string} />
      ),
    },
    { accessorKey: "calibrationCycle", header: t("master.gauge.calibrationCycle"), size: 90,
      cell: ({ getValue }) => `${getValue()}${t("master.gauge.months")}` },
    { accessorKey: "lastCalibrationDate", header: t("quality.msa.lastCalibration"), size: 120,
      meta: { filterType: "date" as const },
      cell: ({ getValue }) => (getValue() as string)?.slice(0, 10) ?? "-" },
    { accessorKey: "nextCalibrationDate", header: t("quality.msa.nextCalibration"), size: 120,
      meta: { filterType: "date" as const },
      cell: ({ getValue }) => (getValue() as string)?.slice(0, 10) ?? "-" },
    { accessorKey: "status", header: t("common.status"), size: 100,
      meta: { filterType: "multi" as const },
      cell: ({ getValue }) => (
        <ComCodeBadge groupCode="GAUGE_STATUS" code={getValue() as string} />
      ),
    },
    { accessorKey: "location", header: t("master.gauge.location"), size: 110 },
  ], [t]);

  /* -- 행 클래스: 교정만료/임박 하이라이트 -- */
  const getRowClassName = useCallback((row: Gauge) => {
    const st = getRowDateStatus(row.nextCalibrationDate);
    if (st === "overdue") return "!bg-red-50 dark:!bg-red-950/30";
    if (st === "warning") return "!bg-yellow-50 dark:!bg-yellow-950/30";
    return "";
  }, []);

  return (
    <div className="flex-1 flex flex-col overflow-hidden p-6 gap-4 animate-fade-in">
      {/* 헤더 */}
      <div className="flex justify-between items-center flex-shrink-0">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2">
            <Ruler className="w-7 h-7 text-primary" />{t("quality.msa.title")}
          </h1>
          <p className="text-text-muted mt-1">{t("quality.msa.subtitle")}</p>
        </div>
        <div className="flex gap-2">
          <Button variant={expiringOnly ? "primary" : "secondary"} size="sm"
            onClick={() => setExpiringOnly(v => !v)}>
            <AlertTriangle className="w-4 h-4 mr-1" />{t("quality.msa.expiringSoon")}
          </Button>
          <Button variant="secondary" size="sm" onClick={fetchData}>
            <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} />
            {t("common.refresh")}
          </Button>
        </div>
      </div>

      {/* 좌우 배치: 계측기 목록(좌) + 교정이력(우) */}
      <div className="flex-1 min-h-0 flex gap-4">
        {/* 좌측: 계측기 목록 (읽기 전용) */}
        <Card className={`min-h-0 overflow-hidden ${selectedRow ? "w-1/2" : "flex-1"}`}
          padding="none">
          <CardContent className="h-full p-4">
            <DataGrid data={data} columns={columns} isLoading={loading}
              enableColumnFilter enableExport
              exportFileName={t("quality.msa.title")}
              onRowClick={row => setSelectedRow(row as Gauge)}
              getRowId={row => String((row as Gauge).id)}
              selectedRowId={selectedRow ? String(selectedRow.id) : undefined}
              rowClassName={row => getRowClassName(row as Gauge)}
              toolbarLeft={
                <div className="flex gap-3 items-center flex-1 min-w-0 flex-wrap">
                  <ComCodeSelect groupCode="GAUGE_TYPE" value={typeFilter}
                    onChange={setTypeFilter}
                    labelPrefix={t("master.gauge.gaugeType")} />
                  <ComCodeSelect groupCode="GAUGE_STATUS" value={statusFilter}
                    onChange={setStatusFilter}
                    labelPrefix={t("common.status")} />
                </div>
              }
            />
          </CardContent>
        </Card>

        {/* 우측: 교정 이력 */}
        {selectedRow && (
          <Card className="w-1/2 min-h-0 overflow-hidden" padding="none">
            <CardContent className="h-full p-4 flex flex-col">
              <div className="flex items-center gap-2 mb-3 flex-shrink-0">
                <span className="text-sm font-bold text-text">
                  {selectedRow.gaugeCode}
                </span>
                <span className="text-xs text-text-muted">
                  {selectedRow.gaugeName}
                </span>
              </div>
              <div className="flex-1 min-h-0">
                <CalibrationList gaugeId={selectedRow.id}
                  onCalibrationAdded={fetchData} />
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
