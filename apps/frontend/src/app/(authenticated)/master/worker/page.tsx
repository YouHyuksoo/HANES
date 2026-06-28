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
import { Plus, RefreshCw, Users, Search } from "lucide-react";
import { Card, CardContent, Button, Input, ConfirmModal } from "@/components/ui";
import { ComCodeSelect } from "@/components/shared";
import DataGrid from "@/components/data-grid/DataGrid";
import { Worker } from "./types";
import { api } from "@/services/api";
import { usePageAiTools } from "@/ai-page-tools/usePageAiTools";
import { useUnsavedGuard } from "@/hooks/useUnsavedGuard";
import WorkerFormPanel from "./components/WorkerFormPanel";
import { createWorkerGridColumns } from "./workerColumns";

export default function WorkerPage() {
  usePageAiTools("master.worker");
  const { t } = useTranslation();
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [useYnFilter, setUseYnFilter] = useState("");

  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [editingWorker, setEditingWorker] = useState<Worker | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Worker | null>(null);
  const panelAnimateRef = useRef(true);
  const { markDirty, guard, guardModalProps } = useUnsavedGuard();

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
      await api.delete(`/master/workers/${deleteTarget.workerCode}`);
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

  const openEdit = useCallback((worker: Worker) => {
    guard(() => { panelAnimateRef.current = !isPanelOpen; setEditingWorker(worker); setIsPanelOpen(true); });
  }, [guard, isPanelOpen]);

  const openCreate = useCallback(() => {
    guard(() => { panelAnimateRef.current = !isPanelOpen; setEditingWorker(null); setIsPanelOpen(true); });
  }, [guard, isPanelOpen]);

  const columns = useMemo(() => createWorkerGridColumns({
    t,
    onEditWorker: openEdit,
    onDeleteWorker: setDeleteTarget,
  }), [t, openEdit]);

  return (
    <div className="flex h-full animate-fade-in">
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden p-6 gap-4">
        <div className="flex justify-between items-center flex-shrink-0">
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
            <Button size="sm" onClick={openCreate}>
              <Plus className="w-4 h-4 mr-1" />{t("master.worker.addWorker", "작업자 추가")}
            </Button>
          </div>
        </div>

        <Card className="flex-1 min-h-0 overflow-hidden" padding="none">
          <CardContent className="h-full p-4">
            <DataGrid
              data={workers}
              columns={columns}
              isLoading={loading}
              emptyMessage={t("master.worker.emptyMessage", "등록된 작업자가 없습니다.")}
              enableColumnPinning
              enableColumnFilter
              enableExport
              exportFileName={t("master.worker.title", "작업자 관리")}
              onRowClick={(row) => { if (isPanelOpen) guard(() => setEditingWorker(row)); }}
              toolbarLeft={
                <div className="flex gap-2 items-center">
                  <Input
                    placeholder={t("master.worker.searchPlaceholder", "코드/이름 검색")}
                    value={searchText}
                    onChange={e => setSearchText(e.target.value)}
                    leftIcon={<Search className="w-4 h-4" />}
                  />
                  <div className="w-28 flex-shrink-0">
                    <ComCodeSelect groupCode="USE_YN" value={useYnFilter} onChange={setUseYnFilter} labelPrefix={t("common.useYn", "사용여부")} fullWidth />
                  </div>
                </div>
              }
            
            sqlQuery={`SELECT *\nFROM WORKER_MASTERS\nWHERE COMPANY = '40'\n  AND PLANT_CD = '1000'\nORDER BY CREATED_AT DESC`}/>
          </CardContent>
        </Card>
      </div>

      {isPanelOpen && (
        <WorkerFormPanel
          editingWorker={editingWorker}
          onClose={() => guard(handlePanelClose)}
          onSave={handlePanelSave}
          animate={panelAnimateRef.current}
          onDirtyChange={markDirty}
        />
      )}

      <ConfirmModal {...guardModalProps} />

      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        variant="danger"
        message={t("master.company.deleteConfirm", {
          name: deleteTarget?.workerName || "",
          defaultValue: `'${deleteTarget?.workerName || ""}'을(를) 삭제하시겠습니까?`,
        })}
      />
    </div>
  );
}
