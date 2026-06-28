"use client";

/**
 * @file src/app/(authenticated)/quality/ppap/page.tsx
 * @description PPAP(Production Part Approval Process) 관리 페이지 - IATF 16949 준수
 *
 * 초보자 가이드:
 * 1. **StatCard 4개**: 전체, 제출대기, 승인대기, 승인완료 통계 표시
 * 2. **DataGrid**: PPAP 제출 목록 (필터, 정렬, 페이지네이션)
 * 3. **우측 패널**: 등록/수정(PpapFormPanel) 슬라이드 패널
 * 4. **상태 전환 액션**: 제출, 승인, 반려
 * 5. API: GET/POST /quality/ppap, PATCH /quality/ppap/:id
 */
import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  Plus, RefreshCw, FileText, Clock, CheckCircle, Search as SearchIcon,
  Send, ShieldCheck, XCircle, Undo2, Pencil, Trash2, Eye, X,
} from "lucide-react";
import { Card, CardContent, Button, Input, StatCard, ConfirmModal } from "@/components/ui";
import DataGrid from "@/components/data-grid/DataGrid";
import { ComCodeSelect } from "@/components/shared";
import api from "@/services/api";
import PpapFormPanel from "./components/PpapFormPanel";
import { createPpapGridColumns, type PpapSubmission } from "./ppapColumns";

/** 확인 액션 DTO */
interface ConfirmAction {
  label: string;
  action: () => Promise<void>;
}

export default function PpapPage() {
  const { t } = useTranslation();
  const [data, setData] = useState<PpapSubmission[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedRow, setSelectedRow] = useState<PpapSubmission | null>(null);

  /* -- 필터 상태 -- */
  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [levelFilter, setLevelFilter] = useState("");

  /* -- 패널 상태 -- */
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<PpapSubmission | null>(null);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [showRejectModal, setShowRejectModal] = useState(false);

  /* -- 데이터 조회 -- */
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { limit: "5000" };
      if (searchText) params.search = searchText;
      if (statusFilter) params.status = statusFilter;
      if (levelFilter) params.ppapLevel = levelFilter;
      const res = await api.get("/quality/ppap", { params });
      setData(res.data?.data ?? []);
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [searchText, statusFilter, levelFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  /* -- 통계 -- */
  const stats = useMemo(() => {
    const total = data.length;
    const draft = data.filter(d => d.status === "DRAFT").length;
    const submitted = data.filter(d => d.status === "SUBMITTED").length;
    const approved = data.filter(d => d.status === "APPROVED").length;
    return { total, draft, submitted, approved };
  }, [data]);

  /* -- 상태 전환 API -- */
  const patchAction = useCallback(async (ppapNo: string, endpoint: string, body?: object) => {
    await api.patch(`/quality/ppap/${endpoint}/${ppapNo}`, body ?? {});
    fetchData();
    setSelectedRow(null);
  }, [fetchData]);

  /* -- 삭제 API -- */
  const deleteAction = useCallback(async (ppapNo: string) => {
    await api.delete(`/quality/ppap/${ppapNo}`);
    fetchData();
    setSelectedRow(null);
  }, [fetchData]);

  /* -- 컬럼 정의 -- */
  const columns = useMemo(() => createPpapGridColumns({
    t,
    onViewDetail: setSelectedRow,
  }), [t]);

  /* -- 행 선택 시 액션 버튼 -- */
  const actionButtons = useMemo(() => {
    if (!selectedRow) return null;
    const s = selectedRow.status;
    return (
      <div className="flex gap-2 flex-wrap">
        {/* 상세보기 — 모든 상태 */}
        <Button size="sm" variant="secondary"
          onClick={() => { setEditTarget(selectedRow); setIsPanelOpen(true); }}>
          <Eye className="w-4 h-4 mr-1" />{t("common.detail")}
        </Button>
        {/* DRAFT: 삭제, 제출 */}
        {s === "DRAFT" && (
          <>
            <Button size="sm" variant="danger"
              onClick={() => setConfirmAction({
                label: t("common.delete"),
                action: () => deleteAction(selectedRow.ppapNo),
              })}>
              <Trash2 className="w-4 h-4 mr-1" />{t("common.delete")}
            </Button>
            <Button size="sm"
              onClick={() => setConfirmAction({
                label: t("quality.ppap.submit"),
                action: () => patchAction(selectedRow.ppapNo, "submit"),
              })}>
              <Send className="w-4 h-4 mr-1" />{t("quality.ppap.submit")}
            </Button>
          </>
        )}
        {/* REJECTED: 삭제, 재제출 */}
        {s === "REJECTED" && (
          <>
            <Button size="sm" variant="danger"
              onClick={() => setConfirmAction({
                label: t("common.delete"),
                action: () => deleteAction(selectedRow.ppapNo),
              })}>
              <Trash2 className="w-4 h-4 mr-1" />{t("common.delete")}
            </Button>
            <Button size="sm"
              onClick={() => setConfirmAction({
                label: t("quality.ppap.submit"),
                action: () => patchAction(selectedRow.ppapNo, "submit"),
              })}>
              <Send className="w-4 h-4 mr-1" />{t("quality.ppap.submit")}
            </Button>
          </>
        )}
        {/* SUBMITTED: 승인, 반려, 제출취소 */}
        {s === "SUBMITTED" && (
          <>
            <Button size="sm" onClick={() => setConfirmAction({
              label: t("quality.ppap.approve"),
              action: () => patchAction(selectedRow.ppapNo, "approve"),
            })}>
              <ShieldCheck className="w-4 h-4 mr-1" />{t("quality.ppap.approve")}
            </Button>
            <Button size="sm" variant="danger"
              onClick={() => { setRejectReason(""); setShowRejectModal(true); }}>
              <XCircle className="w-4 h-4 mr-1" />{t("quality.ppap.reject")}
            </Button>
            <Button size="sm" variant="secondary"
              onClick={() => setConfirmAction({
                label: t("quality.ppap.cancelSubmit"),
                action: () => patchAction(selectedRow.ppapNo, "cancel-submit"),
              })}>
              <Undo2 className="w-4 h-4 mr-1" />{t("quality.ppap.cancelSubmit")}
            </Button>
          </>
        )}
        {/* APPROVED: 승인취소 */}
        {s === "APPROVED" && (
          <Button size="sm" variant="secondary"
            onClick={() => setConfirmAction({
              label: t("quality.ppap.cancelApprove"),
              action: () => patchAction(selectedRow.ppapNo, "cancel-approve"),
            })}>
            <Undo2 className="w-4 h-4 mr-1" />{t("quality.ppap.cancelApprove")}
          </Button>
        )}
      </div>
    );
  }, [selectedRow, t, patchAction, deleteAction]);

  return (
    <div className="flex-1 flex flex-col overflow-hidden p-6 gap-4 animate-fade-in">
        {/* 헤더 */}
        <div className="flex justify-between items-center flex-shrink-0">
          <div>
            <h1 className="text-xl font-bold text-text flex items-center gap-2">
              <FileText className="w-7 h-7 text-primary" />{t("quality.ppap.title")}
            </h1>
            <p className="text-text-muted mt-1">{t("quality.ppap.subtitle")}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={fetchData}>
              <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} />{t("common.refresh")}
            </Button>
            <Button size="sm" onClick={() => { setEditTarget(null); setIsPanelOpen(true); }}>
              <Plus className="w-4 h-4 mr-1" />{t("quality.ppap.create")}
            </Button>
          </div>
        </div>

        {/* 액션 버튼 */}
        {actionButtons && (
          <div className="flex items-center gap-3 flex-shrink-0 px-1">
            <span className="text-xs text-text-muted font-medium">{selectedRow?.ppapNo}</span>
            {actionButtons}
            <button onClick={() => setSelectedRow(null)}
              className="p-1 hover:bg-surface rounded transition-colors" title={t("common.close", "닫기")}>
              <X className="w-4 h-4 text-text-muted" />
            </button>
          </div>
        )}

        {/* DataGrid */}
        <Card className="flex-1 min-h-0 overflow-hidden" padding="none"><CardContent className="h-full p-4">
          <DataGrid data={data} columns={columns} isLoading={loading}
            enableColumnFilter enableExport exportFileName={t("quality.ppap.title")}
            getRowId={row => (row as PpapSubmission).ppapNo}
            selectedRowId={selectedRow ? String(selectedRow.ppapNo) : undefined}
            toolbarLeft={
              <div className="flex gap-3 items-center flex-1 min-w-0 flex-wrap">
                <div className="flex-1 min-w-[180px]">
                  <Input placeholder={t("common.search")} value={searchText}
                    onChange={e => setSearchText(e.target.value)}
                    leftIcon={<SearchIcon className="w-4 h-4" />} fullWidth />
                </div>
                <ComCodeSelect groupCode="PPAP_STATUS" value={statusFilter}
                  onChange={setStatusFilter} labelPrefix={t("common.status")} />
                <select value={levelFilter} onChange={e => setLevelFilter(e.target.value)}
                  className="h-8 px-2 rounded-md border border-border bg-white dark:bg-slate-900 text-text text-xs">
                  <option value="">{t("quality.ppap.ppapLevel")}: {t("common.all")}</option>
                  {[1, 2, 3, 4, 5].map(lv => (
                    <option key={lv} value={lv}>Level {lv}</option>
                  ))}
                </select>
              </div>
            }
          
          sqlQuery={`SELECT *\nFROM QA_PPAPS\nWHERE COMPANY = '40'\n  AND PLANT_CD = '1000'\nORDER BY CREATED_AT DESC`}/>
        </CardContent></Card>

        {/* 확인 모달 */}
        <ConfirmModal isOpen={!!confirmAction} onClose={() => setConfirmAction(null)}
          onConfirm={async () => { await confirmAction?.action(); setConfirmAction(null); }}
          title={confirmAction?.label ?? ""} message={`${confirmAction?.label ?? ""} ${t("common.confirm")}?`} />

        {/* 반려 사유 모달 */}
        <ConfirmModal isOpen={showRejectModal} onClose={() => setShowRejectModal(false)}
          onConfirm={async () => {
            if (selectedRow) await patchAction(selectedRow.ppapNo, "reject", { rejectReason });
            setShowRejectModal(false);
          }}
          title={t("quality.ppap.reject")}
          message={
            <div className="space-y-2">
              <p>{t("quality.ppap.rejectReasonLabel")}</p>
              <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)}
                className="w-full rounded-md border border-border bg-white dark:bg-slate-900 text-text px-3 py-2 text-xs min-h-[80px] focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                placeholder={t("quality.ppap.rejectReasonLabel")} />
            </div>
          } />

      {/* 등록/수정 모달 */}
      <PpapFormPanel
        key={editTarget?.ppapNo ?? "__new__"}
        isOpen={isPanelOpen} editData={editTarget}
        onClose={() => { setIsPanelOpen(false); setEditTarget(null); }}
        onSave={fetchData} />
    </div>
  );
}
