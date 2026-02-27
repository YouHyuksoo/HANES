"use client";

/**
 * @file src/app/(authenticated)/master/worker/page.tsx
 * @description 작업자관리 페이지 - API 연동 CRUD + Oracle TM_EHR 데이터
 *
 * 초보자 가이드:
 * 1. **작업자 목록**: DataGrid에 사진/아바타 + 유형 배지 표시
 * 2. **API 연동**: /master/workers 엔드포인트 사용
 * 3. **우측 패널**: 추가/수정 폼은 우측 슬라이드 패널에서 처리
 */

import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Plus, Edit2, Trash2, RefreshCw, Users, Search } from "lucide-react";
import { Card, CardContent, Button, Input, ConfirmModal } from "@/components/ui";
import { ComCodeSelect } from "@/components/shared";
import DataGrid from "@/components/data-grid/DataGrid";
import { ColumnDef } from "@tanstack/react-table";
import { WorkerAvatar } from "@/components/worker/WorkerSelector";
import { Worker } from "./types";
import { api } from "@/services/api";
import WorkerFormPanel from "./components/WorkerFormPanel";

export default function WorkerPage() {
  const { t } = useTranslation();
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [useYnFilter, setUseYnFilter] = useState("");

  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [editingWorker, setEditingWorker] = useState<Worker | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Worker | null>(null);
  const panelAnimateRef = useRef(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/master/workers", {
        params: { search: searchText || undefined, useYn: useYnFilter || undefined, limit: 200 },
      });
      const result = res.data?.data ?? res.data;
      setWorkers(Array.isArray(result) ? result : result?.data ?? []);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, [searchText, useYnFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteTarget) return;
    try {
      await api.delete(`/master/workers/${deleteTarget.id}`);
      fetchData();
    } catch { /* ignore */ }
    finally {
      setDeleteTarget(null);
    }
  }, [deleteTarget, fetchData]);

  const handlePanelClose = useCallback(() => {
    setIsPanelOpen(false);
    setEditingWorker(null);
    panelAnimateRef.current = true;
  }, []);

  const handlePanelSave = useCallback(() => {
    fetchData();
  }, [fetchData]);

  const columns = useMemo<ColumnDef<Worker>[]>(() => [
    {
      id: "actions", header: t("common.actions"), size: 80,
      meta: { align: "center" as const, filterType: "none" as const },
      cell: ({ row }) => (
        <div className="flex gap-1">
          <button onClick={(e) => { e.stopPropagation(); panelAnimateRef.current = !isPanelOpen; setEditingWorker(row.original); setIsPanelOpen(true); }} className="p-1 hover:bg-surface rounded">
            <Edit2 className="w-4 h-4 text-primary" />
          </button>
          <button onClick={(e) => { e.stopPropagation(); setDeleteTarget(row.original); }} className="p-1 hover:bg-surface rounded">
            <Trash2 className="w-4 h-4 text-red-500" />
          </button>
        </div>
      ),
    },
    {
      id: "photo", header: t("master.worker.photo", "사진"), size: 60,
      meta: { filterType: "none" as const },
      cell: ({ row }) => <WorkerAvatar name={row.original.workerName} dept={row.original.dept ?? ""} photoUrl={row.original.photoUrl} />,
    },
    { accessorKey: "workerCode", header: t("master.worker.workerCode", "작업자코드"), size: 100, meta: { filterType: "text" as const } },
    { accessorKey: "workerName", header: t("master.worker.workerName", "작업자명"), size: 100, meta: { filterType: "text" as const } },
    { accessorKey: "engName", header: t("master.worker.engName", "영문명"), size: 100, meta: { filterType: "text" as const }, cell: ({ getValue }) => getValue() || "-" },
    { accessorKey: "dept", header: t("master.worker.dept", "부서"), size: 90, meta: { filterType: "text" as const }, cell: ({ getValue }) => getValue() || "-" },
    { accessorKey: "position", header: t("master.worker.position", "직급"), size: 80, meta: { filterType: "text" as const }, cell: ({ getValue }) => getValue() || "-" },
    { accessorKey: "phone", header: t("master.worker.phone", "전화번호"), size: 120, meta: { filterType: "text" as const }, cell: ({ getValue }) => getValue() || "-" },
    {
      accessorKey: "useYn", header: t("master.worker.use", "사용"), size: 60,
      meta: { filterType: "multi" as const },
      cell: ({ getValue }) => {
        const v = getValue() as string;
        return (
          <span className={`px-2 py-1 text-xs rounded-full ${
            v === "Y"
              ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
              : "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300"
          }`}>
            {v === "Y" ? t("common.yes", "사용") : t("common.no", "미사용")}
          </span>
        );
      },
    },
  ], [t, isPanelOpen]);

  return (
    <div className="flex h-[calc(100vh-theme(spacing.16))] animate-fade-in">
      <div className="flex-1 min-w-0 overflow-auto p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold text-text flex items-center gap-2">
              <Users className="w-7 h-7 text-primary" />{t("master.worker.title", "작업자 관리")}
            </h1>
            <p className="text-text-muted mt-1">{t("master.worker.subtitle", "작업자 등록 및 관리")}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={fetchData}>
              <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} />{t("common.refresh")}
            </Button>
            <Button size="sm" onClick={() => { panelAnimateRef.current = !isPanelOpen; setEditingWorker(null); setIsPanelOpen(true); }}>
              <Plus className="w-4 h-4 mr-1" />{t("master.worker.addWorker", "작업자 추가")}
            </Button>
          </div>
        </div>

        <Card>
          <CardContent>
            <DataGrid
              data={workers}
              columns={columns}
              isLoading={loading}
              emptyMessage={t("master.worker.emptyMessage", "등록된 작업자가 없습니다.")}
              enableColumnPinning
              enableColumnFilter
              enableExport
              exportFileName={t("master.worker.title", "작업자 관리")}
              onRowClick={(row) => { if (isPanelOpen) setEditingWorker(row); }}
              toolbarLeft={
                <div className="flex gap-2 items-center">
                  <Input
                    placeholder={t("master.worker.searchPlaceholder", "코드/이름 검색")}
                    value={searchText}
                    onChange={e => setSearchText(e.target.value)}
                    leftIcon={<Search className="w-4 h-4" />}
                  />
                  <div className="w-28 flex-shrink-0">
                    <ComCodeSelect groupCode="USE_YN" value={useYnFilter} onChange={setUseYnFilter} fullWidth />
                  </div>
                </div>
              }
            />
          </CardContent>
        </Card>
      </div>

      {isPanelOpen && (
        <WorkerFormPanel
          editingWorker={editingWorker}
          onClose={handlePanelClose}
          onSave={handlePanelSave}
          animate={panelAnimateRef.current}
        />
      )}

      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        variant="danger"
        message={`'${deleteTarget?.workerName || ""}'을(를) 삭제하시겠습니까?`}
      />
    </div>
  );
}
