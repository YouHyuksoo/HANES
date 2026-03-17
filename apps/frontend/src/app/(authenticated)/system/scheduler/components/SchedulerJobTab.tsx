"use client";

/**
 * @file system/scheduler/components/SchedulerJobTab.tsx
 * @description 스케줄러 작업 관리 탭 - DataGrid + 필터 + CRUD 버튼
 *
 * 초보자 가이드:
 * 1. **DataGrid**: 작업목록 (jobCode, cronExpr, isActive 토글 등)
 * 2. **ADMIN 전용**: 등록/즉시실행/삭제 버튼 (role 체크)
 * 3. **필터**: jobGroup, execType ComCodeSelect
 * 4. **토글**: PATCH /scheduler/jobs/:jobCode/toggle
 * 5. **행 클릭**: SchedulerJobModal 수정 모드
 */
import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { ColumnDef } from "@tanstack/react-table";
import { Plus, RefreshCw, Play, Trash2, Search as SearchIcon } from "lucide-react";
import {
  Card, CardContent, Button, Input, ComCodeBadge, ConfirmModal,
} from "@/components/ui";
import DataGrid from "@/components/data-grid/DataGrid";
import { ComCodeSelect } from "@/components/shared";
import api from "@/services/api";
import { useAuthStore } from "@/stores/authStore";
import SchedulerJobModal from "./SchedulerJobModal";

/** 스케줄러 작업 행 타입 */
interface SchedulerJob {
  jobCode: string;
  jobName: string;
  jobGroup: string;
  execType: string;
  cronExpr: string;
  isActive: boolean;
  lastRunAt: string | null;
  nextRunAt: string | null;
  lastStatus: string | null;
  execTarget: string | null;
  execParams: string | null;
  maxRetry: number;
  timeoutSec: number;
  description: string | null;
}

export default function SchedulerJobTab() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === "ADMIN";

  const [data, setData] = useState<SchedulerJob[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedRow, setSelectedRow] = useState<SchedulerJob | null>(null);

  /* 필터 */
  const [searchText, setSearchText] = useState("");
  const [groupFilter, setGroupFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");

  /* 모달 */
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<SchedulerJob | null>(null);
  const [confirmAction, setConfirmAction] = useState<{
    title: string; message: string; action: () => Promise<void>;
  } | null>(null);

  /* 데이터 조회 */
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (searchText) params.search = searchText;
      if (groupFilter) params.jobGroup = groupFilter;
      if (typeFilter) params.execType = typeFilter;
      const res = await api.get("/scheduler/jobs", { params });
      setData(res.data?.data ?? res.data ?? []);
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [searchText, groupFilter, typeFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  /* 활성 토글 */
  const handleToggle = useCallback(async (job: SchedulerJob) => {
    try {
      await api.patch(`/scheduler/jobs/${job.jobCode}/toggle`);
      fetchData();
    } catch { /* api 인터셉터에서 처리 */ }
  }, [fetchData]);

  /* 즉시 실행 */
  const handleRunNow = useCallback(() => {
    if (!selectedRow) return;
    setConfirmAction({
      title: t("scheduler.runNow"),
      message: t("scheduler.confirmRun"),
      action: async () => {
        await api.post(`/scheduler/jobs/${selectedRow.jobCode}/run`);
        fetchData();
      },
    });
  }, [selectedRow, t, fetchData]);

  /* 삭제 */
  const handleDelete = useCallback(() => {
    if (!selectedRow) return;
    setConfirmAction({
      title: t("common.delete"),
      message: t("scheduler.confirmDelete"),
      action: async () => {
        await api.delete(`/scheduler/jobs/${selectedRow.jobCode}`);
        setSelectedRow(null);
        fetchData();
      },
    });
  }, [selectedRow, t, fetchData]);

  /* 날짜 포맷 */
  const fmtDt = (v: string | null) => v ? v.replace("T", " ").slice(0, 19) : "-";

  /* 컬럼 정의 */
  const columns = useMemo<ColumnDef<SchedulerJob>[]>(() => [
    {
      accessorKey: "jobCode", header: t("scheduler.jobCode"), size: 150,
      meta: { filterType: "text" as const },
      cell: ({ getValue }) => (
        <span className="text-primary font-medium">{getValue() as string}</span>
      ),
    },
    { accessorKey: "jobName", header: t("scheduler.jobName"), size: 180,
      meta: { filterType: "text" as const } },
    { accessorKey: "jobGroup", header: t("scheduler.jobGroup"), size: 120,
      meta: { filterType: "multi" as const },
      cell: ({ getValue }) => <ComCodeBadge groupCode="SCHED_GROUP" code={getValue() as string} /> },
    { accessorKey: "execType", header: t("scheduler.execType"), size: 120,
      meta: { filterType: "multi" as const },
      cell: ({ getValue }) => <ComCodeBadge groupCode="SCHED_EXEC_TYPE" code={getValue() as string} /> },
    { accessorKey: "cronExpr", header: t("scheduler.cronExpr"), size: 140,
      cell: ({ getValue }) => (
        <code className="font-mono text-xs bg-surface px-1.5 py-0.5 rounded">
          {getValue() as string}
        </code>
      ) },
    {
      accessorKey: "isActive", header: t("scheduler.isActive"), size: 80,
      meta: { align: "center" as const, filterType: "none" as const },
      cell: ({ row }) => (
        <button
          onClick={(e) => { e.stopPropagation(); if (isAdmin) handleToggle(row.original); }}
          className={`w-10 h-5 rounded-full relative transition-colors ${
            row.original.isActive
              ? "bg-green-500 dark:bg-green-600"
              : "bg-gray-300 dark:bg-gray-600"
          } ${isAdmin ? "cursor-pointer" : "cursor-not-allowed opacity-60"}`}
        >
          <span className={`block w-4 h-4 bg-white rounded-full absolute top-0.5 transition-transform ${
            row.original.isActive ? "translate-x-5" : "translate-x-0.5"
          }`} />
        </button>
      ),
    },
    { accessorKey: "lastRunAt", header: t("scheduler.lastRunAt"), size: 160,
      cell: ({ getValue }) => fmtDt(getValue() as string | null) },
    { accessorKey: "nextRunAt", header: t("scheduler.nextRunAt"), size: 160,
      cell: ({ getValue }) => fmtDt(getValue() as string | null) },
    { accessorKey: "lastStatus", header: t("common.status"), size: 100,
      meta: { filterType: "multi" as const },
      cell: ({ getValue }) => {
        const v = getValue() as string | null;
        return v ? <ComCodeBadge groupCode="SCHED_STATUS" code={v} /> : "-";
      } },
  ], [t, isAdmin, handleToggle]);

  return (
    <div className="flex flex-col h-full gap-3">
      {/* ADMIN 액션 */}
      {isAdmin && (
        <div className="flex gap-2 flex-shrink-0">
          <Button size="sm" onClick={() => { setEditTarget(null); setModalOpen(true); }}>
            <Plus className="w-4 h-4 mr-1" />{t("scheduler.addJob")}
          </Button>
          {selectedRow && (
            <>
              <Button size="sm" variant="secondary" onClick={handleRunNow}>
                <Play className="w-4 h-4 mr-1" />{t("scheduler.runNow")}
              </Button>
              <Button size="sm" variant="danger" onClick={handleDelete}>
                <Trash2 className="w-4 h-4 mr-1" />{t("common.delete")}
              </Button>
            </>
          )}
          <div className="flex-1" />
          <Button size="sm" variant="secondary" onClick={fetchData}>
            <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} />
            {t("common.refresh")}
          </Button>
        </div>
      )}

      {/* DataGrid */}
      <Card className="flex-1 min-h-0 overflow-hidden" padding="none">
        <CardContent className="h-full p-4">
          <DataGrid
            data={data} columns={columns} isLoading={loading}
            enableColumnFilter enableExport
            exportFileName={t("scheduler.jobs")}
            getRowId={(row) => (row as SchedulerJob).jobCode}
            selectedRowId={selectedRow?.jobCode}
            onRowClick={(row) => {
              const r = row as SchedulerJob;
              setSelectedRow(r);
              if (isAdmin) { setEditTarget(r); setModalOpen(true); }
            }}
            toolbarLeft={
              <div className="flex gap-3 items-center flex-1 min-w-0 flex-wrap">
                <div className="flex-1 min-w-[180px]">
                  <Input placeholder={t("common.search")} value={searchText}
                    onChange={(e) => setSearchText(e.target.value)}
                    leftIcon={<SearchIcon className="w-4 h-4" />} fullWidth />
                </div>
                <ComCodeSelect groupCode="SCHED_GROUP" value={groupFilter}
                  onChange={setGroupFilter} labelPrefix={t("scheduler.jobGroup")} />
                <ComCodeSelect groupCode="SCHED_EXEC_TYPE" value={typeFilter}
                  onChange={setTypeFilter} labelPrefix={t("scheduler.execType")} />
              </div>
            }
          />
        </CardContent>
      </Card>

      {/* 작업 등록/수정 모달 */}
      {modalOpen && (
        <SchedulerJobModal
          editData={editTarget}
          onClose={() => { setModalOpen(false); setEditTarget(null); }}
          onSave={fetchData}
        />
      )}

      {/* 확인 모달 */}
      <ConfirmModal
        isOpen={!!confirmAction}
        onClose={() => setConfirmAction(null)}
        onConfirm={async () => { await confirmAction?.action(); setConfirmAction(null); }}
        title={confirmAction?.title ?? ""}
        message={confirmAction?.message ?? ""}
      />
    </div>
  );
}
