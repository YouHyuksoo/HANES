"use client";

/**
 * @file system/scheduler/components/SchedulerLogTab.tsx
 * @description 스케줄러 실행 이력 탭 - 필터 + DataGrid + 상세 모달
 *
 * 초보자 가이드:
 * 1. **필터**: 날짜범위, 작업 셀렉트, 상태 셀렉트
 * 2. **DataGrid**: logId, jobCode, startTime, endTime, duration, status 등
 * 3. **행 클릭** (FAIL/TIMEOUT): LogDetailModal로 에러 상세 표시
 * 4. API: GET /scheduler/logs
 */
import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { ColumnDef } from "@tanstack/react-table";
import { RefreshCw } from "lucide-react";
import {
  Card, CardContent, Button, Input, ComCodeBadge, Select,
} from "@/components/ui";
import DataGrid from "@/components/data-grid/DataGrid";
import { ComCodeSelect } from "@/components/shared";
import api from "@/services/api";
import LogDetailModal from "./LogDetailModal";

/** 로그 행 타입 */
interface SchedulerLog {
  logId: number;
  jobCode: string;
  jobName?: string;
  startTime: string;
  endTime: string | null;
  durationMs: number | null;
  status: string;
  affectedRows: number | null;
  retryCount: number;
  resultMsg: string | null;
  errorMsg: string | null;
}

/** 작업 목록(필터용) */
interface JobOption { value: string; label: string }

export default function SchedulerLogTab() {
  const { t } = useTranslation();
  const [data, setData] = useState<SchedulerLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [detailTarget, setDetailTarget] = useState<SchedulerLog | null>(null);

  /* 필터 */
  const today = new Date().toISOString().slice(0, 10);
  const weekAgo = new Date(Date.now() - 7 * 86400_000).toISOString().slice(0, 10);
  const [startDate, setStartDate] = useState(weekAgo);
  const [endDate, setEndDate] = useState(today);
  const [jobFilter, setJobFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [jobOptions, setJobOptions] = useState<JobOption[]>([]);

  /* 작업 목록 로드 (필터 셀렉트용) */
  useEffect(() => {
    api.get("/scheduler/jobs").then((res) => {
      const jobs = res.data?.data ?? res.data ?? [];
      setJobOptions(jobs.map((j: { jobCode: string; jobName: string }) => ({
        value: j.jobCode, label: `${j.jobCode} - ${j.jobName}`,
      })));
    }).catch(() => { /* ignore */ });
  }, []);

  /* 데이터 조회 */
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;
      if (jobFilter) params.jobCode = jobFilter;
      if (statusFilter) params.status = statusFilter;
      const res = await api.get("/scheduler/logs", { params });
      setData(res.data?.data ?? res.data ?? []);
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, jobFilter, statusFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  /* duration 포맷 */
  const fmtDuration = (ms: number | null) => {
    if (ms == null) return "-";
    return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`;
  };

  const fmtDt = (v: string | null) => v ? v.replace("T", " ").slice(0, 19) : "-";

  /* 컬럼 정의 */
  const columns = useMemo<ColumnDef<SchedulerLog>[]>(() => [
    { accessorKey: "logId", header: "ID", size: 70 },
    {
      accessorKey: "jobCode", header: t("scheduler.jobCode"), size: 150,
      meta: { filterType: "text" as const },
      cell: ({ row }) => (
        <span className="text-primary font-medium">
          {row.original.jobName ?? row.original.jobCode}
        </span>
      ),
    },
    { accessorKey: "startTime", header: t("scheduler.startTime"), size: 160,
      cell: ({ getValue }) => fmtDt(getValue() as string) },
    { accessorKey: "endTime", header: t("scheduler.endTime"), size: 160,
      cell: ({ getValue }) => fmtDt(getValue() as string | null) },
    { accessorKey: "durationMs", header: t("scheduler.duration"), size: 100,
      cell: ({ getValue }) => (
        <span className="font-mono text-xs">{fmtDuration(getValue() as number | null)}</span>
      ) },
    { accessorKey: "status", header: t("common.status"), size: 100,
      meta: { filterType: "multi" as const },
      cell: ({ getValue }) => <ComCodeBadge groupCode="SCHED_STATUS" code={getValue() as string} /> },
    { accessorKey: "affectedRows", header: t("scheduler.affectedRows"), size: 90,
      cell: ({ getValue }) => {
        const v = getValue() as number | null;
        return v != null ? v.toLocaleString() : "-";
      } },
    { accessorKey: "retryCount", header: t("scheduler.retryCount"), size: 80,
      cell: ({ getValue }) => getValue() as number },
  ], [t]);

  return (
    <div className="flex flex-col h-full gap-3">
      {/* 필터 영역 */}
      <Card className="flex-shrink-0">
        <CardContent>
          <div className="flex gap-3 items-end flex-wrap">
            <Input label={t("common.from", "시작일")} type="date" value={startDate}
              onChange={(e) => setStartDate(e.target.value)} />
            <Input label={t("common.to", "종료일")} type="date" value={endDate}
              onChange={(e) => setEndDate(e.target.value)} />
            <Select label={t("scheduler.jobCode")} options={[{ value: "", label: t("common.all", "전체") }, ...jobOptions]}
              value={jobFilter} onChange={setJobFilter} />
            <ComCodeSelect groupCode="SCHED_STATUS" value={statusFilter}
              onChange={setStatusFilter} labelPrefix={t("common.status")} />
            <Button size="sm" variant="secondary" onClick={fetchData}>
              <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} />
              {t("common.refresh")}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* DataGrid */}
      <Card className="flex-1 min-h-0 overflow-hidden" padding="none">
        <CardContent className="h-full p-4">
          <DataGrid
            data={data} columns={columns} isLoading={loading}
            enableColumnFilter enableExport
            exportFileName={t("scheduler.logs")}
            getRowId={(row) => String((row as SchedulerLog).logId)}
            onRowClick={(row) => {
              const r = row as SchedulerLog;
              if (r.status === "FAIL" || r.status === "TIMEOUT") {
                setDetailTarget(r);
              }
            }}
          />
        </CardContent>
      </Card>

      {/* 로그 상세 모달 */}
      {detailTarget && (
        <LogDetailModal log={detailTarget} onClose={() => setDetailTarget(null)} />
      )}
    </div>
  );
}
