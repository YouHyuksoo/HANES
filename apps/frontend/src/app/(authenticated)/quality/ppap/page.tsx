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
import { ColumnDef } from "@tanstack/react-table";
import {
  Plus, RefreshCw, FileText, Clock, CheckCircle, Search as SearchIcon,
  Send, ShieldCheck, XCircle, Undo2, Pencil, Trash2, Eye,
} from "lucide-react";
import { Card, CardContent, Button, Input, StatCard, ComCodeBadge, ConfirmModal } from "@/components/ui";
import DataGrid from "@/components/data-grid/DataGrid";
import { ComCodeSelect } from "@/components/shared";
import api from "@/services/api";
import PpapFormPanel from "./components/PpapFormPanel";

/** PPAP 데이터 타입 */
interface PpapSubmission {
  id: number;
  ppapNo: string;
  itemCode: string;
  itemName: string;
  customerCode: string;
  customerName: string;
  ppapLevel: number;
  reason: string;
  status: string;
  completionRate: number;
  remarks: string;
  submittedAt: string;
  approvedAt: string;
  rejectedAt: string;
  rejectReason: string;
  createdAt: string;
}

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
  const patchAction = useCallback(async (id: number, endpoint: string, body?: object) => {
    await api.patch(`/quality/ppap/${endpoint}/${id}`, body ?? {});
    fetchData();
    setSelectedRow(null);
  }, [fetchData]);

  /* -- 삭제 API -- */
  const deleteAction = useCallback(async (id: number) => {
    await api.delete(`/quality/ppap/${id}`);
    fetchData();
    setSelectedRow(null);
  }, [fetchData]);

  /* -- 컬럼 정의 -- */
  const columns = useMemo<ColumnDef<PpapSubmission>[]>(() => [
    { accessorKey: "ppapNo", header: t("quality.ppap.ppapNo"), size: 160,
      meta: { filterType: "text" as const },
      cell: ({ getValue }) => <span className="text-primary font-medium">{getValue() as string}</span> },
    { accessorKey: "itemCode", header: t("quality.ppap.itemCode"), size: 130, meta: { filterType: "text" as const } },
    { accessorKey: "itemName", header: t("quality.ppap.itemName"), size: 200, meta: { filterType: "text" as const } },
    { accessorKey: "customerName", header: t("quality.ppap.customerName"), size: 150, meta: { filterType: "text" as const } },
    { accessorKey: "ppapLevel", header: t("quality.ppap.ppapLevel"), size: 100,
      meta: { filterType: "multi" as const },
      cell: ({ getValue }) => (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
          Level {getValue() as number}
        </span>
      ),
    },
    { accessorKey: "reason", header: t("quality.ppap.reason"), size: 120,
      meta: { filterType: "multi" as const },
      cell: ({ getValue }) => <ComCodeBadge groupCode="PPAP_REASON" code={getValue() as string} /> },
    { accessorKey: "status", header: t("common.status"), size: 120,
      meta: { filterType: "multi" as const },
      cell: ({ getValue }) => <ComCodeBadge groupCode="PPAP_STATUS" code={getValue() as string} /> },
    { accessorKey: "completionRate", header: t("quality.ppap.completionRate"), size: 110,
      cell: ({ getValue }) => {
        const rate = (getValue() as number) ?? 0;
        return (
          <div className="flex items-center gap-2">
            <div className="flex-1 h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
              <div className={`h-full rounded-full ${rate === 100 ? "bg-green-500" : "bg-blue-500"}`}
                style={{ width: `${rate}%` }} />
            </div>
            <span className="text-xs font-medium text-text-muted w-10 text-right">{rate}%</span>
          </div>
        );
      },
    },
    { accessorKey: "createdAt", header: t("common.createdAt"), size: 120,
      meta: { filterType: "date" as const },
      cell: ({ getValue }) => (getValue() as string)?.slice(0, 10) },
  ], [t]);

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
                action: () => deleteAction(selectedRow.id),
              })}>
              <Trash2 className="w-4 h-4 mr-1" />{t("common.delete")}
            </Button>
            <Button size="sm"
              onClick={() => setConfirmAction({
                label: t("quality.ppap.submit"),
                action: () => patchAction(selectedRow.id, "submit"),
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
                action: () => deleteAction(selectedRow.id),
              })}>
              <Trash2 className="w-4 h-4 mr-1" />{t("common.delete")}
            </Button>
            <Button size="sm"
              onClick={() => setConfirmAction({
                label: t("quality.ppap.submit"),
                action: () => patchAction(selectedRow.id, "submit"),
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
              action: () => patchAction(selectedRow.id, "approve"),
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
                action: () => patchAction(selectedRow.id, "cancel-submit"),
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
              action: () => patchAction(selectedRow.id, "cancel-approve"),
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
          </div>
        )}

        {/* DataGrid */}
        <Card className="flex-1 min-h-0 overflow-hidden" padding="none"><CardContent className="h-full p-4">
          <DataGrid data={data} columns={columns} isLoading={loading}
            enableColumnFilter enableExport exportFileName={t("quality.ppap.title")}
            onRowClick={row => setSelectedRow(row as PpapSubmission)}
            getRowId={row => String((row as PpapSubmission).id)}
            selectedRowId={selectedRow ? String(selectedRow.id) : undefined}
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
          />
        </CardContent></Card>

        {/* 확인 모달 */}
        <ConfirmModal isOpen={!!confirmAction} onClose={() => setConfirmAction(null)}
          onConfirm={async () => { await confirmAction?.action(); setConfirmAction(null); }}
          title={confirmAction?.label ?? ""} message={`${confirmAction?.label ?? ""} ${t("common.confirm")}?`} />

        {/* 반려 사유 모달 */}
        <ConfirmModal isOpen={showRejectModal} onClose={() => setShowRejectModal(false)}
          onConfirm={async () => {
            if (selectedRow) await patchAction(selectedRow.id, "reject", { rejectReason });
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
      <PpapFormPanel isOpen={isPanelOpen} editData={editTarget}
        onClose={() => { setIsPanelOpen(false); setEditTarget(null); }}
        onSave={fetchData} />
    </div>
  );
}
