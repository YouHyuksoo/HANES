"use client";

/**
 * @file src/app/(authenticated)/quality/change-control/page.tsx
 * @description 4M 변경점관리 페이지 — IATF 16949 8.5.6 변경 관리
 *
 * 초보자 가이드:
 * 1. **StatCard 4개**: 전체, 검토대기, 진행중, 완료 통계 표시
 * 2. **DataGrid**: 변경점 목록 (페이지네이션, 필터)
 * 3. **우측 패널**: 등록/수정(ChangeFormPanel) 슬라이드 패널
 * 4. **상태 전환 액션**: 제출, 검토, 승인, 시행시작, 완료
 * 5. API: GET/POST /quality/changes, PATCH /quality/changes/:id/...
 */
import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  Plus, RefreshCw, FileText, Clock, Play, CheckCircle, Search as SearchIcon,
  Calendar, Send, ShieldCheck, Eye, X,
} from "lucide-react";
import { Card, CardContent, Button, Input, StatCard, ConfirmModal } from "@/components/ui";
import DataGrid from "@/components/data-grid/DataGrid";
import { ComCodeSelect } from "@/components/shared";
import DateRangeFilter from "@/components/shared/DateRangeFilter";
import api from "@/services/api";
import ChangeFormPanel from "./components/ChangeFormPanel";
import { createChangeControlGridColumns, type ChangeOrder } from "./changeControlColumns";

/** 검토/승인 DTO */
interface ReviewAction {
  label: string;
  action: () => Promise<void>;
}

export default function ChangeControlPage() {
  const { t } = useTranslation();
  const [data, setData] = useState<ChangeOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedRow, setSelectedRow] = useState<ChangeOrder | null>(null);

  /* -- 필터 상태 -- */
  const [searchText, setSearchText] = useState("");
  const [fromDate, setDateFrom] = useState("");
  const [toDate, setDateTo] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");

  /* -- 패널 상태 -- */
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<ChangeOrder | null>(null);
  const [confirmAction, setConfirmAction] = useState<ReviewAction | null>(null);

  /* -- 데이터 조회 -- */
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { limit: "5000" };
      if (searchText) params.search = searchText;
      if (statusFilter) params.status = statusFilter;
      if (typeFilter) params.changeType = typeFilter;
      if (priorityFilter) params.priority = priorityFilter;
      if (fromDate) params.fromDate = fromDate;
      if (toDate) params.toDate = toDate;
      const res = await api.get("/quality/changes", { params });
      setData(res.data?.data ?? []);
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [searchText, statusFilter, typeFilter, priorityFilter, fromDate, toDate]);

  useEffect(() => { fetchData(); }, [fetchData]);

  /* -- 통계 -- */
  const stats = useMemo(() => {
    const total = data.length;
    const pending = data.filter(d => d.status === "SUBMITTED").length;
    const inProgress = data.filter(d => d.status === "IN_PROGRESS").length;
    const completed = data.filter(d => ["COMPLETED", "CLOSED"].includes(d.status)).length;
    return { total, pending, inProgress, completed };
  }, [data]);

  /* -- 상태 전환 API -- */
  const patchAction = useCallback(async (changeNo: string, endpoint: string, body?: object) => {
    await api.patch(`/quality/changes/${changeNo}/${endpoint}`, body ?? {});
    fetchData();
    setSelectedRow(null);
  }, [fetchData]);

  /* -- 컬럼 정의 -- */
  const columns = useMemo(() => createChangeControlGridColumns({
    t,
    onSelectRow: setSelectedRow,
  }), [t]);

  /* -- 행 선택 시 액션 버튼 -- */
  const actionButtons = useMemo(() => {
    if (!selectedRow) return null;
    const s = selectedRow.status;
    return (
      <div className="flex gap-2 flex-wrap">
        {(s === "DRAFT" || s === "REJECTED") && (
          <>
            <Button size="sm" variant="secondary"
              onClick={() => { setEditTarget(selectedRow); setIsPanelOpen(true); }}>
              <Eye className="w-4 h-4 mr-1" />{t("common.edit")}
            </Button>
            <Button size="sm"
              onClick={() => setConfirmAction({
                label: t("quality.change.submit"),
                action: () => patchAction(selectedRow.changeNo, "submit"),
              })}>
              <Send className="w-4 h-4 mr-1" />{t("quality.change.submit")}
            </Button>
          </>
        )}
        {s === "SUBMITTED" && (
          <>
            <Button size="sm" onClick={() => setConfirmAction({
              label: t("quality.change.review") + " (APPROVE)",
              action: () => patchAction(selectedRow.changeNo, "review", { action: "APPROVE" }),
            })}>
              <ShieldCheck className="w-4 h-4 mr-1" />{t("quality.change.approve")}
            </Button>
            <Button size="sm" variant="danger"
              onClick={() => setConfirmAction({
                label: t("quality.change.review") + " (REJECT)",
                action: () => patchAction(selectedRow.changeNo, "review", { action: "REJECT" }),
              })}>
              {t("common.reject")}
            </Button>
          </>
        )}
        {s === "APPROVED" && (
          <Button size="sm" onClick={() => setConfirmAction({
            label: t("quality.change.start"),
            action: () => patchAction(selectedRow.changeNo, "start"),
          })}>
            <Play className="w-4 h-4 mr-1" />{t("quality.change.start")}
          </Button>
        )}
        {s === "IN_PROGRESS" && (
          <Button size="sm" onClick={() => setConfirmAction({
            label: t("quality.change.complete"),
            action: () => patchAction(selectedRow.changeNo, "complete"),
          })}>
            <CheckCircle className="w-4 h-4 mr-1" />{t("quality.change.complete")}
          </Button>
        )}
      </div>
    );
  }, [selectedRow, t, patchAction]);

  return (
    <div className="flex h-full">
      {/* 메인 영역 */}
      <div className="flex-1 flex flex-col overflow-hidden p-6 gap-4 animate-fade-in">
        {/* 헤더 */}
        <div className="flex justify-between items-center flex-shrink-0">
          <div>
            <h1 className="text-xl font-bold text-text flex items-center gap-2">
              <FileText className="w-7 h-7 text-primary" />{t("quality.change.title")}
            </h1>
            <p className="text-text-muted mt-1">{t("quality.change.subtitle")}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={fetchData}>
              <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} />{t("common.refresh")}
            </Button>
            <Button size="sm" onClick={() => { setEditTarget(null); setIsPanelOpen(true); }}>
              <Plus className="w-4 h-4 mr-1" />{t("quality.change.create")}
            </Button>
          </div>
        </div>

        {/* 통계 카드 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 flex-shrink-0">
          <StatCard label={t("quality.change.statsTotal")} value={stats.total} icon={FileText} color="blue" />
          <StatCard label={t("quality.change.statsPending")} value={stats.pending} icon={Clock} color="yellow" />
          <StatCard label={t("quality.change.statsInProgress")} value={stats.inProgress} icon={Play} color="orange" />
          <StatCard label={t("quality.change.statsCompleted")} value={stats.completed} icon={CheckCircle} color="green" />
        </div>

        {/* 액션 버튼 */}
        {actionButtons && (
          <div className="flex items-center gap-3 flex-shrink-0 px-1">
            <span className="text-xs text-text-muted font-medium">{selectedRow?.changeNo}</span>
            {actionButtons}
            <button onClick={() => setSelectedRow(null)} className="ml-auto p-1 hover:bg-surface rounded transition-colors" title={t("common.close")}>
              <X className="w-4 h-4 text-text-muted" />
            </button>
          </div>
        )}

        {/* DataGrid */}
        <Card className="flex-1 min-h-0 overflow-hidden" padding="none"><CardContent className="h-full p-4">
          <DataGrid data={data} columns={columns} isLoading={loading}
            enableColumnFilter enableExport exportFileName={t("quality.change.title")}
            getRowId={row => (row as ChangeOrder).changeNo}
            selectedRowId={selectedRow ? String(selectedRow.changeNo) : undefined}
            toolbarLeft={
              <div className="flex gap-3 items-center flex-1 min-w-0 flex-wrap">
                <div className="flex-1 min-w-[180px]">
                  <Input placeholder={t("common.search")} value={searchText}
                    onChange={e => setSearchText(e.target.value)}
                    leftIcon={<SearchIcon className="w-4 h-4" />} fullWidth />
                </div>
                <DateRangeFilter
                  from={fromDate}
                  to={toDate}
                  onFromChange={setDateFrom}
                  onToChange={setDateTo}
                  className="flex-shrink-0"
                />
                <ComCodeSelect groupCode="CHANGE_STATUS" value={statusFilter}
                  onChange={setStatusFilter} labelPrefix={t("common.status")} />
                <ComCodeSelect groupCode="CHANGE_TYPE" value={typeFilter}
                  onChange={setTypeFilter} labelPrefix={t("quality.change.changeType")} />
                <ComCodeSelect groupCode="CHANGE_PRIORITY" value={priorityFilter}
                  onChange={setPriorityFilter} labelPrefix={t("quality.change.priority")} />
              </div>
            }
          
          sqlQuery={`SELECT *\nFROM QA_CHANGE_CONTROLS\nWHERE COMPANY = '40'\n  AND PLANT_CD = '1000'\nORDER BY CREATED_AT DESC`}/>
        </CardContent></Card>

        {/* 확인 모달 */}
        <ConfirmModal isOpen={!!confirmAction} onClose={() => setConfirmAction(null)}
          onConfirm={async () => { await confirmAction?.action(); setConfirmAction(null); }}
          title={confirmAction?.label ?? ""} message={`${confirmAction?.label ?? ""} ${t("common.confirm")}?`} />
      </div>

      {/* 우측 패널: 등록/수정 */}
      {isPanelOpen && (
        <ChangeFormPanel
          key={editTarget?.changeNo ?? "__new__"}
          editData={editTarget}
          onClose={() => { setIsPanelOpen(false); setEditTarget(null); }}
          onSave={fetchData} />
      )}
    </div>
  );
}
