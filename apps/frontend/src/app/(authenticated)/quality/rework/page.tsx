"use client";

/**
 * @file src/app/(authenticated)/quality/rework/page.tsx
 * @description 재작업 지시 페이지 — IATF 16949 8.7.1 부적합 출력물 재작업 관리
 *
 * 초보자 가이드:
 * 1. **StatCard 5개**: 전체, 승인대기, 진행중, 완료, 재검사대기 통계 표시
 * 2. **DataGrid**: 재작업 지시 목록
 * 3. **우측 패널**: 등록/수정(ReworkFormPanel), 승인(ReworkApprovePanel) 슬라이드 패널
 * 4. **상태 전환 액션**: 승인요청, 품질승인, 생산승인, 작업시작, 작업완료
 * 5. API: GET/POST /quality/reworks, PATCH /quality/reworks/:id/...
 */
import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { ColumnDef } from "@tanstack/react-table";
import {
  Plus, RefreshCw, ClipboardList, Clock, Play, CheckCircle, Search as SearchIcon,
  Calendar, Send, ShieldCheck, Factory, Eye, Layers,
} from "lucide-react";
import { Card, CardContent, Button, Input, StatCard, ComCodeBadge, ConfirmModal } from "@/components/ui";
import DataGrid from "@/components/data-grid/DataGrid";
import { LineSelect, ComCodeSelect } from "@/components/shared";
import api from "@/services/api";
import ReworkFormPanel from "./components/ReworkFormPanel";
import type { ReworkEditData } from "./components/ReworkFormPanel";
import ReworkApprovePanel from "./components/ReworkApprovePanel";
import ReworkResultPanel from "./components/ReworkResultPanel";
import type { ResultTarget } from "./components/ReworkResultPanel";

/** 재작업 지시 데이터 타입 */
interface ReworkOrder {
  id: number;
  reworkNo: string;
  itemCode: string;
  itemName: string;
  reworkQty: number;
  defectType: string;
  reworkMethod: string;
  status: string;
  workerCode: string;
  lineCode: string;
  equipCode: string;
  resultQty: number;
  passQty: number;
  failQty: number;
  remarks: string;
  createdAt: string;
}

/** 재작업 공정 데이터 타입 */
interface ReworkProcess {
  id: number;
  processCode: string;
  processName: string;
  seq: number;
  status: string;
  planQty: number;
  resultQty: number;
  workerCode: string;
  startAt: string;
  endAt: string;
}

type ApproveType = "qc" | "prod";

export default function ReworkPage() {
  const { t } = useTranslation();
  const [data, setData] = useState<ReworkOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedRow, setSelectedRow] = useState<ReworkOrder | null>(null);
  const [processes, setProcesses] = useState<ReworkProcess[]>([]);

  /* ── 필터 상태 ── */
  const [searchText, setSearchText] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [lineFilter, setLineFilter] = useState("");

  /* ── 패널 상태 ── */
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<ReworkEditData | null>(null);
  const [isApproveOpen, setIsApproveOpen] = useState(false);
  const [approveType, setApproveType] = useState<ApproveType>("qc");
  const [confirmAction, setConfirmAction] = useState<{ label: string; action: () => Promise<void> } | null>(null);
  const [resultTarget, setResultTarget] = useState<ResultTarget | null>(null);

  /* ── 데이터 조회 ── */
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { limit: "5000" };
      if (searchText) params.search = searchText;
      if (statusFilter) params.status = statusFilter;
      if (lineFilter) params.lineCode = lineFilter;
      if (dateFrom) params.startDate = dateFrom;
      if (dateTo) params.endDate = dateTo;
      const res = await api.get("/quality/reworks", { params });
      setData(res.data?.data ?? []);
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [searchText, statusFilter, lineFilter, dateFrom, dateTo]);

  useEffect(() => { fetchData(); }, [fetchData]);

  /* ── 행 선택 시 공정 목록 조회 ── */
  useEffect(() => {
    if (selectedRow) {
      api.get(`/quality/reworks/${selectedRow.id}/processes`)
        .then(res => setProcesses(res.data?.data ?? []))
        .catch(() => setProcesses([]));
    } else {
      setProcesses([]);
    }
  }, [selectedRow]);

  /* ── 통계 ── */
  const stats = useMemo(() => {
    const total = data.length;
    const pending = data.filter(d => ["QC_PENDING", "PROD_PENDING"].includes(d.status)).length;
    const inProgress = data.filter(d => d.status === "IN_PROGRESS").length;
    const done = data.filter(d => ["PASS", "FAIL", "SCRAP"].includes(d.status)).length;
    const inspectPending = data.filter(d => d.status === "INSPECT_PENDING").length;
    return { total, pending, inProgress, done, inspectPending };
  }, [data]);

  /* ── 상태 전환 API ── */
  const patchAction = useCallback(async (id: number, endpoint: string, body?: object) => {
    await api.patch(`/quality/reworks/${id}/${endpoint}`, body ?? {});
    fetchData();
    setSelectedRow(null);
  }, [fetchData]);

  /* ── 액션 핸들러 ── */
  const handleRequestApproval = () => {
    if (!selectedRow) return;
    setConfirmAction({ label: t("quality.rework.requestApproval"), action: () => patchAction(selectedRow.id, "request-approval") });
  };
  const handleQcApprove = () => { setApproveType("qc"); setIsApproveOpen(true); };
  const handleProdApprove = () => { setApproveType("prod"); setIsApproveOpen(true); };
  const handleStart = () => {
    if (!selectedRow) return;
    setConfirmAction({ label: t("quality.rework.start"), action: () => patchAction(selectedRow.id, "start") });
  };
  const handleComplete = () => {
    if (!selectedRow) return;
    setConfirmAction({ label: t("quality.rework.complete"), action: () => patchAction(selectedRow.id, "complete", { resultQty: selectedRow.reworkQty }) });
  };

  const handleApproveSubmit = async (action: "APPROVE" | "REJECT", reason?: string) => {
    if (!selectedRow) return;
    const endpoint = approveType === "qc" ? "qc-approve" : "prod-approve";
    await api.patch(`/quality/reworks/${selectedRow.id}/${endpoint}`, { action, reason });
    fetchData();
    setSelectedRow(null);
  };

  /* ── 공정별 액션 ── */
  const fetchProcesses = useCallback(async (orderId: number) => {
    try {
      const res = await api.get(`/quality/reworks/${orderId}/processes`);
      setProcesses(res.data?.data ?? []);
    } catch { setProcesses([]); }
  }, []);

  const handleProcessStart = useCallback(async (proc: ReworkProcess) => {
    await api.patch(`/quality/rework-processes/${proc.id}/start`);
    if (selectedRow) fetchProcesses(selectedRow.id);
    fetchData();
  }, [selectedRow, fetchProcesses, fetchData]);

  const handleProcessComplete = useCallback(async (proc: ReworkProcess) => {
    await api.patch(`/quality/rework-processes/${proc.id}/complete`, { resultQty: proc.resultQty || proc.planQty });
    if (selectedRow) fetchProcesses(selectedRow.id);
    fetchData();
  }, [selectedRow, fetchProcesses, fetchData]);

  const handleProcessSkip = useCallback(async (proc: ReworkProcess) => {
    await api.patch(`/quality/rework-processes/${proc.id}/skip`);
    if (selectedRow) fetchProcesses(selectedRow.id);
    fetchData();
  }, [selectedRow, fetchProcesses, fetchData]);

  const handleOpenResult = useCallback((proc: ReworkProcess) => {
    if (!selectedRow) return;
    setResultTarget({
      processId: proc.id,
      processCode: proc.processCode,
      processName: proc.processName,
      seq: proc.seq,
      planQty: proc.planQty,
      reworkNo: selectedRow.reworkNo,
    });
  }, [selectedRow]);

  const handleResultSave = useCallback(() => {
    setResultTarget(null);
    if (selectedRow) fetchProcesses(selectedRow.id);
    fetchData();
  }, [selectedRow, fetchProcesses, fetchData]);

  /* ── 컬럼 정의 ── */
  const columns = useMemo<ColumnDef<ReworkOrder>[]>(() => [
    { accessorKey: "reworkNo", header: t("quality.rework.reworkNo"), size: 170, meta: { filterType: "text" as const },
      cell: ({ getValue }) => <span className="text-primary font-medium">{getValue() as string}</span> },
    { accessorKey: "itemCode", header: t("quality.rework.itemCode"), size: 130, meta: { filterType: "text" as const } },
    { accessorKey: "itemName", header: t("quality.rework.itemName"), size: 180, meta: { filterType: "text" as const } },
    { accessorKey: "reworkQty", header: t("quality.rework.reworkQty"), size: 90, meta: { filterType: "number" as const },
      cell: ({ getValue }) => <span className="font-mono text-right block">{(getValue() as number).toLocaleString()}</span> },
    { accessorKey: "defectType", header: t("quality.rework.defectType"), size: 110, meta: { filterType: "text" as const },
      cell: ({ getValue }) => <ComCodeBadge groupCode="DEFECT_TYPE" code={getValue() as string} /> },
    { accessorKey: "status", header: t("common.status"), size: 120, meta: { filterType: "multi" as const },
      cell: ({ getValue }) => <ComCodeBadge groupCode="REWORK_STATUS" code={getValue() as string} /> },
    { accessorKey: "workerCode", header: t("quality.rework.worker"), size: 100, meta: { filterType: "text" as const } },
    { accessorKey: "createdAt", header: t("common.createdAt"), size: 140, meta: { filterType: "date" as const },
      cell: ({ getValue }) => (getValue() as string)?.slice(0, 10) },
  ], [t]);

  /* ── 행 선택 시 액션 버튼 ── */
  const actionButtons = useMemo(() => {
    if (!selectedRow) return null;
    const s = selectedRow.status;
    return (
      <div className="flex gap-2 flex-wrap">
        {s === "REGISTERED" && (
          <>
            <Button size="sm" variant="secondary" onClick={() => { setEditTarget(selectedRow as unknown as ReworkEditData); setIsPanelOpen(true); }}>
              <Eye className="w-4 h-4 mr-1" />{t("common.edit")}
            </Button>
            <Button size="sm" onClick={handleRequestApproval}>
              <Send className="w-4 h-4 mr-1" />{t("quality.rework.requestApproval")}
            </Button>
          </>
        )}
        {s === "QC_PENDING" && <Button size="sm" onClick={handleQcApprove}><ShieldCheck className="w-4 h-4 mr-1" />{t("quality.rework.qcApprove")}</Button>}
        {s === "PROD_PENDING" && <Button size="sm" onClick={handleProdApprove}><Factory className="w-4 h-4 mr-1" />{t("quality.rework.prodApprove")}</Button>}
        {s === "APPROVED" && <Button size="sm" onClick={handleStart}><Play className="w-4 h-4 mr-1" />{t("quality.rework.start")}</Button>}
        {s === "IN_PROGRESS" && <Button size="sm" onClick={handleComplete}><CheckCircle className="w-4 h-4 mr-1" />{t("quality.rework.complete")}</Button>}
        {(s === "QC_REJECTED" || s === "PROD_REJECTED") && (
          <>
            <Button size="sm" variant="secondary" onClick={() => { setEditTarget(selectedRow as unknown as ReworkEditData); setIsPanelOpen(true); }}>
              <Eye className="w-4 h-4 mr-1" />{t("common.edit")}
            </Button>
            <Button size="sm" onClick={handleRequestApproval}>
              <Send className="w-4 h-4 mr-1" />{t("quality.rework.reRequest")}
            </Button>
          </>
        )}
      </div>
    );
  }, [selectedRow, t]);

  return (
    <div className="flex h-full">
      {/* 메인 영역 */}
      <div className="flex-1 space-y-6 animate-fade-in overflow-auto p-0">
        {/* 헤더 */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold text-text flex items-center gap-2">
              <ClipboardList className="w-7 h-7 text-primary" />{t("quality.rework.title")}
            </h1>
            <p className="text-text-muted mt-1">{t("quality.rework.subtitle")}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={fetchData}>
              <RefreshCw className="w-4 h-4 mr-1" />{t("common.refresh")}
            </Button>
            <Button size="sm" onClick={() => { setEditTarget(null); setIsPanelOpen(true); }}>
              <Plus className="w-4 h-4 mr-1" />{t("quality.rework.create")}
            </Button>
          </div>
        </div>

        {/* 통계 카드 */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <StatCard label={t("quality.rework.statsTotal")} value={stats.total} icon={ClipboardList} color="blue" />
          <StatCard label={t("quality.rework.statsPending")} value={stats.pending} icon={Clock} color="yellow" />
          <StatCard label={t("quality.rework.statsInProgress")} value={stats.inProgress} icon={Play} color="orange" />
          <StatCard label={t("quality.rework.statsDone")} value={stats.done} icon={CheckCircle} color="green" />
          <StatCard label={t("quality.rework.statsInspectPending")} value={stats.inspectPending} icon={SearchIcon} color="purple" />
        </div>

        {/* 액션 버튼 */}
        {actionButtons && (
          <Card><CardContent><div className="flex items-center gap-3">
            <span className="text-sm text-text-muted font-medium">{selectedRow?.reworkNo}</span>
            {actionButtons}
          </div></CardContent></Card>
        )}

        {/* 공정 현황 */}
        {selectedRow && processes.length > 0 && (
          <Card><CardContent>
            <h3 className="text-sm font-bold text-text mb-3 flex items-center gap-2">
              <Layers className="w-4 h-4 text-primary" />
              {t("quality.rework.processStatus")} - {selectedRow.reworkNo}
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border bg-surface dark:bg-slate-800">
                    <th className="px-3 py-2 text-left font-medium text-text-muted">{t("quality.rework.processSeq")}</th>
                    <th className="px-3 py-2 text-left font-medium text-text-muted">{t("quality.rework.processCode")}</th>
                    <th className="px-3 py-2 text-left font-medium text-text-muted">{t("quality.rework.processName")}</th>
                    <th className="px-3 py-2 text-left font-medium text-text-muted">{t("common.status")}</th>
                    <th className="px-3 py-2 text-right font-medium text-text-muted">{t("quality.rework.reworkQty")}</th>
                    <th className="px-3 py-2 text-right font-medium text-text-muted">{t("quality.rework.resultQty")}</th>
                    <th className="px-3 py-2 text-left font-medium text-text-muted">{t("quality.rework.worker")}</th>
                    <th className="px-3 py-2 text-center font-medium text-text-muted">{t("common.manage")}</th>
                  </tr>
                </thead>
                <tbody>
                  {processes.map(proc => (
                    <tr key={proc.id} className="border-b border-border/50 hover:bg-surface/50 dark:hover:bg-slate-800/50">
                      <td className="px-3 py-2 text-text-muted">{proc.seq}</td>
                      <td className="px-3 py-2 font-medium text-text">{proc.processCode}</td>
                      <td className="px-3 py-2 text-text">{proc.processName}</td>
                      <td className="px-3 py-2"><ComCodeBadge groupCode="REWORK_PROCESS_STATUS" code={proc.status} /></td>
                      <td className="px-3 py-2 text-right font-mono text-text">{proc.planQty}</td>
                      <td className="px-3 py-2 text-right font-mono text-text">{proc.resultQty}</td>
                      <td className="px-3 py-2 text-text-muted">{proc.workerCode || '-'}</td>
                      <td className="px-3 py-2 text-center">
                        <div className="flex gap-1 justify-center">
                          {proc.status === "WAITING" && (
                            <>
                              <Button size="sm" variant="secondary" onClick={() => handleProcessStart(proc)} className="text-[10px] px-1.5 py-0.5 h-6">
                                <Play className="w-3 h-3 mr-0.5" />{t("quality.rework.start")}
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => handleProcessSkip(proc)} className="text-[10px] px-1.5 py-0.5 h-6 text-text-muted">
                                {t("quality.rework.skip")}
                              </Button>
                            </>
                          )}
                          {proc.status === "IN_PROGRESS" && (
                            <>
                              <Button size="sm" variant="primary" onClick={() => handleOpenResult(proc)} className="text-[10px] px-1.5 py-0.5 h-6">
                                <ClipboardList className="w-3 h-3 mr-0.5" />{t("quality.rework.resultEntry")}
                              </Button>
                              <Button size="sm" variant="secondary" onClick={() => handleProcessComplete(proc)} className="text-[10px] px-1.5 py-0.5 h-6">
                                <CheckCircle className="w-3 h-3 mr-0.5" />{t("quality.rework.complete")}
                              </Button>
                            </>
                          )}
                          {proc.status === "COMPLETED" && (
                            <span className="text-green-600 dark:text-green-400 text-[10px]">{t("quality.rework.complete")}</span>
                          )}
                          {proc.status === "SKIPPED" && (
                            <span className="text-text-muted text-[10px]">{t("quality.rework.skip")}</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent></Card>
        )}

        {/* DataGrid */}
        <Card><CardContent>
          <DataGrid data={data} columns={columns} isLoading={loading}
            enableColumnFilter enableExport exportFileName={t("quality.rework.title")}
            onRowClick={row => setSelectedRow(row as ReworkOrder)}
            getRowId={row => String((row as ReworkOrder).id)}
            selectedRowId={selectedRow ? String(selectedRow.id) : undefined}
            toolbarLeft={
              <div className="flex gap-3 items-center flex-1 min-w-0 flex-wrap">
                <div className="flex-1 min-w-[180px]">
                  <Input placeholder={t("common.search")} value={searchText}
                    onChange={e => setSearchText(e.target.value)}
                    leftIcon={<SearchIcon className="w-4 h-4" />} fullWidth />
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-text-muted" />
                  <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-36" />
                  <span className="text-text-muted">~</span>
                  <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-36" />
                </div>
                <ComCodeSelect groupCode="REWORK_STATUS" value={statusFilter}
                  onChange={setStatusFilter} placeholder={t("common.status")} />
                <LineSelect value={lineFilter} onChange={setLineFilter} placeholder={t("quality.rework.line")} />
              </div>
            }
          />
        </CardContent></Card>

        {/* 확인 모달 */}
        <ConfirmModal isOpen={!!confirmAction} onClose={() => setConfirmAction(null)}
          onConfirm={async () => { await confirmAction?.action(); setConfirmAction(null); }}
          title={confirmAction?.label ?? ""} message={`${confirmAction?.label ?? ""} ${t("common.confirm")}?`} />
      </div>

      {/* 우측 패널: 등록/수정 */}
      {isPanelOpen && (
        <ReworkFormPanel editData={editTarget}
          onClose={() => { setIsPanelOpen(false); setEditTarget(null); }}
          onSave={fetchData} />
      )}

      {/* 우측 패널: 승인/반려 */}
      {isApproveOpen && (
        <ReworkApprovePanel type={approveType}
          onClose={() => setIsApproveOpen(false)}
          onSubmit={handleApproveSubmit} />
      )}

      {/* 우측 패널: 실적 입력 */}
      {resultTarget && (
        <ReworkResultPanel target={resultTarget}
          onClose={() => setResultTarget(null)}
          onSave={handleResultSave} />
      )}
    </div>
  );
}
