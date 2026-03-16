"use client";

/**
 * @file src/app/(authenticated)/system/training/page.tsx
 * @description 교육훈련 관리 페이지 - IATF 16949 7.2 역량/교육 관리
 *
 * 초보자 가이드:
 * 1. **DataGrid**: 교육 계획 목록 표시 (검색, 필터, 엑셀 내보내기)
 * 2. **우측 패널**: TrainingFormPanel (등록/수정 슬라이드 패널)
 * 3. **하단 패널**: TrainingResultList (교육 결과/참석자 목록)
 * 4. **ComCodeBadge**: 교육유형(TRAINING_TYPE), 상태(TRAINING_STATUS) 코드값 표시
 * 5. API: GET/POST /system/training/plans, PATCH/DELETE /system/training/plans/:id
 */
import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { ColumnDef } from "@tanstack/react-table";
import {
  Plus, RefreshCw, GraduationCap,
  CheckCircle, RotateCcw, Pencil, Trash2, FileSearch, X,
} from "lucide-react";
import { Card, CardContent, Button, ComCodeBadge, ConfirmModal } from "@/components/ui";
import DataGrid from "@/components/data-grid/DataGrid";
import { ComCodeSelect } from "@/components/shared";
import api from "@/services/api";
import TrainingFormPanel from "./components/TrainingFormPanel";
import TrainingResultList from "./components/TrainingResultList";

/** 교육 계획 데이터 타입 */
interface TrainingPlan {
  planNo: string;
  title: string;
  trainingType: string;
  instructor: string;
  scheduledDate: string;
  duration: number;
  maxParticipants: number;
  status: string;
  description: string;
  targetRole: string;
  createdAt: string;
}

export default function TrainingPage() {
  const { t } = useTranslation();
  const [data, setData] = useState<TrainingPlan[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedRow, setSelectedRow] = useState<TrainingPlan | null>(null);

  /* -- 필터 상태 -- */
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  /* -- 패널 상태 -- */
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<TrainingPlan | null>(null);
  const [confirmAction, setConfirmAction] = useState<{
    label: string; action: () => Promise<void>;
  } | null>(null);

  /* -- 데이터 조회 -- */
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { limit: "5000" };
      if (typeFilter) params.trainingType = typeFilter;
      if (statusFilter) params.status = statusFilter;
      const res = await api.get("/system/trainings", { params });
      setData(res.data?.data ?? []);
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [typeFilter, statusFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  /* -- 교육완료 처리 -- */
  const handleComplete = useCallback(() => {
    if (!selectedRow) return;
    setConfirmAction({
      label: t("system.training.complete"),
      action: async () => {
        await api.patch(`/system/trainings/${selectedRow.planNo}/complete`);
        fetchData();
        setSelectedRow(null);
      },
    });
  }, [selectedRow, fetchData, t]);

  /* -- 완료 취소 -- */
  const handleCancelComplete = useCallback(() => {
    if (!selectedRow) return;
    setConfirmAction({
      label: t("system.training.cancelComplete"),
      action: async () => {
        await api.patch(`/system/trainings/${selectedRow.planNo}/cancel-complete`);
        fetchData();
        setSelectedRow(null);
      },
    });
  }, [selectedRow, fetchData, t]);

  /* -- 삭제 -- */
  const handleDelete = useCallback(() => {
    if (!selectedRow) return;
    setConfirmAction({
      label: t("common.delete"),
      action: async () => {
        await api.delete(`/system/trainings/${selectedRow.planNo}`);
        fetchData();
        setSelectedRow(null);
      },
    });
  }, [selectedRow, fetchData, t]);

  /* -- 컬럼 정의 -- */
  const columns = useMemo<ColumnDef<TrainingPlan>[]>(() => [
    {
      id: "actions", header: "", size: 60,
      meta: { align: "center" as const, filterType: "none" as const },
      cell: ({ row }) => (
        <button
          onClick={(e) => { e.stopPropagation(); setSelectedRow(row.original); }}
          className="p-1 hover:bg-surface rounded transition-colors" title={t("common.detail", "상세")}
        >
          <FileSearch className="w-4 h-4 text-primary" />
        </button>
      ),
    },
    {
      accessorKey: "planNo", header: t("system.training.planNo"), size: 150,
      meta: { filterType: "text" as const },
      cell: ({ getValue }) => (
        <span className="text-primary font-medium">{getValue() as string}</span>
      ),
    },
    {
      accessorKey: "title", header: t("system.training.planTitle"), size: 200,
      meta: { filterType: "text" as const },
    },
    {
      accessorKey: "trainingType", header: t("system.training.trainingType"), size: 120,
      meta: { filterType: "multi" as const },
      cell: ({ getValue }) => (
        <ComCodeBadge groupCode="TRAINING_TYPE" code={getValue() as string} />
      ),
    },
    {
      accessorKey: "instructor", header: t("system.training.instructor"), size: 120,
      meta: { filterType: "text" as const },
    },
    {
      accessorKey: "scheduledDate", header: t("system.training.scheduledDate"), size: 120,
      meta: { filterType: "date" as const },
      cell: ({ getValue }) => (getValue() as string)?.slice(0, 10),
    },
    {
      accessorKey: "duration", header: t("system.training.duration"), size: 80,
      meta: { filterType: "number" as const },
      cell: ({ getValue }) => (
        <span className="font-mono text-right block">
          {getValue() as number}{t("system.training.hours")}
        </span>
      ),
    },
    {
      accessorKey: "status", header: t("common.status"), size: 120,
      meta: { filterType: "multi" as const },
      cell: ({ getValue }) => (
        <ComCodeBadge groupCode="TRAINING_STATUS" code={getValue() as string} />
      ),
    },
    {
      accessorKey: "createdAt", header: t("common.createdAt"), size: 120,
      meta: { filterType: "date" as const },
      cell: ({ getValue }) => (getValue() as string)?.slice(0, 10),
    },
  ], [t]);

  /* -- 행 선택 시 액션 버튼 -- */
  const actionButtons = useMemo(() => {
    if (!selectedRow) return null;
    const s = selectedRow.status;
    return (
      <div className="flex gap-2 flex-wrap">
        {s !== "COMPLETED" && (
          <Button size="sm" variant="secondary" onClick={() => {
            setEditTarget(selectedRow);
            setIsPanelOpen(true);
          }}>
            <Pencil className="w-4 h-4 mr-1" />
            {t("common.edit")}
          </Button>
        )}
        {(s === "PLANNED" || s === "IN_PROGRESS") && (
          <Button size="sm" onClick={handleComplete}>
            <CheckCircle className="w-4 h-4 mr-1" />
            {t("system.training.complete")}
          </Button>
        )}
        {s === "COMPLETED" && (
          <Button size="sm" variant="secondary" onClick={handleCancelComplete}>
            <RotateCcw className="w-4 h-4 mr-1" />
            {t("system.training.cancelComplete")}
          </Button>
        )}
        {s === "PLANNED" && (
          <Button size="sm" variant="danger" onClick={handleDelete}>
            <Trash2 className="w-4 h-4 mr-1" />
            {t("common.delete")}
          </Button>
        )}
      </div>
    );
  }, [selectedRow, t, handleComplete, handleCancelComplete, handleDelete]);

  return (
    <div className="flex h-full">
      {/* 메인 영역 */}
      <div className="flex-1 flex flex-col overflow-hidden p-6 gap-4 animate-fade-in">
        {/* 헤더 */}
        <div className="flex justify-between items-center flex-shrink-0">
          <div>
            <h1 className="text-xl font-bold text-text flex items-center gap-2">
              <GraduationCap className="w-7 h-7 text-primary" />
              {t("system.training.title")}
            </h1>
            <p className="text-text-muted mt-1">{t("system.training.subtitle")}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={fetchData}>
              <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} />
              {t("common.refresh")}
            </Button>
            <Button size="sm" onClick={() => { setEditTarget(null); setIsPanelOpen(true); }}>
              <Plus className="w-4 h-4 mr-1" />{t("system.training.create")}
            </Button>
          </div>
        </div>

        {/* 액션 버튼 */}
        {actionButtons && (
          <div className="flex items-center gap-3 flex-shrink-0 px-1">
            <span className="text-xs text-text-muted font-medium">
              {selectedRow?.planNo} - {selectedRow?.title}
            </span>
            {actionButtons}
          </div>
        )}

        {/* 좌우 배치: 교육 계획(좌) + 교육 결과(우) */}
        <div className="flex-1 min-h-0 flex gap-4">
          {/* 좌측: 교육 계획 그리드 */}
          <Card className={`min-h-0 overflow-hidden ${selectedRow ? "w-1/2" : "flex-1"}`} padding="none">
            <CardContent className="h-full p-4">
              <DataGrid data={data} columns={columns} isLoading={loading}
                enableColumnFilter enableExport
                exportFileName={t("system.training.title")}
                getRowId={row => (row as TrainingPlan).planNo}
                selectedRowId={selectedRow ? String(selectedRow.planNo) : undefined}
                toolbarLeft={
                  <div className="flex gap-3 items-center flex-1 min-w-0 flex-wrap">
                    <ComCodeSelect groupCode="TRAINING_TYPE" value={typeFilter}
                      onChange={setTypeFilter} labelPrefix={t("system.training.trainingType")} />
                    <ComCodeSelect groupCode="TRAINING_STATUS" value={statusFilter}
                      onChange={setStatusFilter} labelPrefix={t("common.status")} />
                  </div>
                }
              />
            </CardContent>
          </Card>

          {/* 우측: 교육 결과 목록 */}
          {selectedRow && (
            <div className="w-1/2 min-h-0 overflow-auto">
              <div className="flex justify-end mb-2">
                <button onClick={() => setSelectedRow(null)}
                  className="p-1 hover:bg-surface rounded transition-colors" title={t("common.close", "닫기")}>
                  <X className="w-4 h-4 text-text-muted" />
                </button>
              </div>
              <TrainingResultList planId={selectedRow.planNo} planNo={selectedRow.planNo}
                status={selectedRow.status} onRefresh={fetchData} />
            </div>
          )}
        </div>

        {/* 확인 모달 */}
        <ConfirmModal isOpen={!!confirmAction} onClose={() => setConfirmAction(null)}
          onConfirm={async () => { await confirmAction?.action(); setConfirmAction(null); }}
          title={confirmAction?.label ?? ""}
          message={`${confirmAction?.label ?? ""} ${t("common.confirm")}?`} />
      </div>

      {/* 등록/수정 모달 */}
      <TrainingFormPanel isOpen={isPanelOpen} editData={editTarget}
        onClose={() => { setIsPanelOpen(false); setEditTarget(null); }}
        onSave={fetchData} />
    </div>
  );
}
