"use client";

/**
 * @file src/app/(authenticated)/quality/capa/page.tsx
 * @description CAPA 시정/예방조치 관리 — IATF 16949 10.2. DataGrid + FormPanel + ActionList
 */
import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { ColumnDef } from "@tanstack/react-table";
import {
  Plus, RefreshCw, ClipboardList, Clock, Play, CheckCircle, Search as SearchIcon,
  Calendar, Shield, Eye, FileSearch, Lock, X,
} from "lucide-react";
import { Card, CardContent, Button, Input, StatCard, ComCodeBadge, ConfirmModal } from "@/components/ui";
import DataGrid from "@/components/data-grid/DataGrid";
import { ComCodeSelect } from "@/components/shared";
import api from "@/services/api";
import CapaFormPanel from "./components/CapaFormPanel";
import ActionList from "./components/ActionList";
import TextInputModal from "./components/TextInputModal";

interface CapaRequest {
  [key: string]: unknown;
  id: number; capaNo: string; capaType: string; sourceType: string;
  title: string; description: string; rootCause: string; actionPlan: string;
  targetDate: string; responsibleCode: string; status: string; priority: string;
  verificationResult: string; itemCode: string; lineCode: string; createdAt: string;
}

export default function CapaPage() {
  const { t } = useTranslation();
  const [data, setData] = useState<CapaRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedRow, setSelectedRow] = useState<CapaRequest | null>(null);

  /* -- 필터 상태 -- */
  const [searchText, setSearchText] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");

  /* -- 패널 상태 -- */
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<CapaRequest | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ label: string; action: () => Promise<void> } | null>(null);

  /* -- 텍스트 입력 모달 상태 -- */
  const [textInput, setTextInput] = useState("");
  const [textAction, setTextAction] = useState<{
    label: string; field: string; action: (val: string) => Promise<void>;
  } | null>(null);

  /* -- 데이터 조회 -- */
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { limit: "5000" };
      if (searchText) params.search = searchText;
      if (statusFilter) params.status = statusFilter;
      if (typeFilter) params.capaType = typeFilter;
      if (sourceFilter) params.sourceType = sourceFilter;
      if (dateFrom) params.startDate = dateFrom;
      if (dateTo) params.endDate = dateTo;
      const res = await api.get("/quality/capas", { params });
      setData(res.data?.data ?? []);
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [searchText, statusFilter, typeFilter, sourceFilter, dateFrom, dateTo]);

  useEffect(() => { fetchData(); }, [fetchData]);

  /* -- 통계 -- */
  const stats = useMemo(() => {
    const total = data.length;
    const open = data.filter(d => d.status === "OPEN").length;
    const analyzing = data.filter(d => d.status === "ANALYZING").length;
    const inProgress = data.filter(d => ["ACTION_PLANNED", "IN_PROGRESS"].includes(d.status)).length;
    const verifying = data.filter(d => d.status === "VERIFYING").length;
    const closed = data.filter(d => d.status === "CLOSED").length;
    return { total, open, analyzing, inProgress, verifying, closed };
  }, [data]);

  /* -- 상태 전환 API -- */
  const patchAction = useCallback(async (id: number, endpoint: string, body?: object) => {
    await api.patch(`/quality/capas/${id}/${endpoint}`, body ?? {});
    fetchData();
    setSelectedRow(null);
  }, [fetchData]);

  /* -- 액션 핸들러 -- */
  const handleAnalyze = () => {
    if (!selectedRow) return;
    setTextInput(selectedRow.rootCause ?? "");
    setTextAction({
      label: t("quality.capa.analyze"),
      field: t("quality.capa.rootCause"),
      action: async (val) => patchAction(selectedRow.id, "analyze", { rootCause: val }),
    });
  };
  const handlePlan = () => {
    if (!selectedRow) return;
    setTextInput(selectedRow.actionPlan ?? "");
    setTextAction({
      label: t("quality.capa.plan"),
      field: t("quality.capa.actionPlan"),
      action: async (val) => patchAction(selectedRow.id, "plan", { actionPlan: val }),
    });
  };
  const handleStart = () => {
    if (!selectedRow) return;
    setConfirmAction({
      label: t("quality.capa.start"),
      action: () => patchAction(selectedRow.id, "start"),
    });
  };
  const handleVerify = () => {
    if (!selectedRow) return;
    setTextInput("");
    setTextAction({
      label: t("quality.capa.verify"),
      field: t("quality.capa.verificationResult"),
      action: async (val) => patchAction(selectedRow.id, "verify", { verificationResult: val }),
    });
  };
  const handleClose = () => {
    if (!selectedRow) return;
    setConfirmAction({
      label: t("quality.capa.close"),
      action: () => patchAction(selectedRow.id, "close"),
    });
  };

  /* -- 컬럼 정의 -- */
  const columns = useMemo<ColumnDef<CapaRequest>[]>(() => [
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
    { accessorKey: "capaNo", header: t("quality.capa.capaNo"), size: 170, meta: { filterType: "text" as const },
      cell: ({ getValue }) => <span className="text-primary font-medium">{getValue() as string}</span> },
    { accessorKey: "capaType", header: t("quality.capa.capaType"), size: 100,
      cell: ({ getValue }) => <ComCodeBadge groupCode="CAPA_TYPE" code={getValue() as string} /> },
    { accessorKey: "sourceType", header: t("quality.capa.sourceType"), size: 110,
      cell: ({ getValue }) => <ComCodeBadge groupCode="CAPA_SOURCE_TYPE" code={getValue() as string} /> },
    { accessorKey: "title", header: t("quality.capa.title"), size: 220, meta: { filterType: "text" as const } },
    { accessorKey: "priority", header: t("common.priority"), size: 90,
      cell: ({ getValue }) => getValue() ? <ComCodeBadge groupCode="CHANGE_PRIORITY" code={getValue() as string} /> : "-" },
    { accessorKey: "status", header: t("common.status"), size: 120,
      cell: ({ getValue }) => <ComCodeBadge groupCode="CAPA_STATUS" code={getValue() as string} /> },
    { accessorKey: "responsibleCode", header: t("quality.capa.responsible"), size: 100, meta: { filterType: "text" as const } },
    { accessorKey: "targetDate", header: t("quality.capa.targetDate"), size: 110,
      cell: ({ getValue }) => (getValue() as string)?.slice(0, 10) ?? "-" },
    { accessorKey: "createdAt", header: t("common.createdAt"), size: 110, meta: { filterType: "date" as const },
      cell: ({ getValue }) => (getValue() as string)?.slice(0, 10) },
  ], [t]);

  /* -- 행 선택 시 액션 버튼 -- */
  const actionButtons = useMemo(() => {
    if (!selectedRow) return null;
    const s = selectedRow.status;
    return (
      <div className="flex gap-2 flex-wrap">
        {s === "OPEN" && (
          <>
            <Button size="sm" variant="secondary" onClick={() => { setEditTarget(selectedRow); setIsPanelOpen(true); }}>
              <Eye className="w-4 h-4 mr-1" />{t("common.edit")}
            </Button>
            <Button size="sm" onClick={handleAnalyze}>
              <FileSearch className="w-4 h-4 mr-1" />{t("quality.capa.analyze")}
            </Button>
          </>
        )}
        {s === "ANALYZING" && (
          <Button size="sm" onClick={handlePlan}>
            <ClipboardList className="w-4 h-4 mr-1" />{t("quality.capa.plan")}
          </Button>
        )}
        {s === "ACTION_PLANNED" && (
          <Button size="sm" onClick={handleStart}>
            <Play className="w-4 h-4 mr-1" />{t("quality.capa.start")}
          </Button>
        )}
        {s === "IN_PROGRESS" && (
          <Button size="sm" onClick={handleVerify}>
            <Shield className="w-4 h-4 mr-1" />{t("quality.capa.verify")}
          </Button>
        )}
        {s === "VERIFYING" && (
          <Button size="sm" onClick={handleClose}>
            <Lock className="w-4 h-4 mr-1" />{t("quality.capa.close")}
          </Button>
        )}
      </div>
    );
  }, [selectedRow, t]);

  return (
    <div className="flex h-full">
      {/* 메인 영역 */}
      <div className="flex-1 flex flex-col overflow-hidden p-6 gap-4 animate-fade-in">
        {/* 헤더 */}
        <div className="flex justify-between items-center flex-shrink-0">
          <div>
            <h1 className="text-xl font-bold text-text flex items-center gap-2">
              <Shield className="w-7 h-7 text-primary" />{t("quality.capa.pageTitle")}
            </h1>
            <p className="text-text-muted mt-1">{t("quality.capa.subtitle")}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={fetchData}>
              <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} />{t("common.refresh")}
            </Button>
            <Button size="sm" onClick={() => { setEditTarget(null); setIsPanelOpen(true); }}>
              <Plus className="w-4 h-4 mr-1" />{t("quality.capa.create")}
            </Button>
          </div>
        </div>

        {/* 통계 카드 */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3 flex-shrink-0">
          <StatCard label={t("quality.capa.statsTotal")} value={stats.total} icon={ClipboardList} color="blue" />
          <StatCard label={t("quality.capa.statsOpen")} value={stats.open} icon={Clock} color="yellow" />
          <StatCard label={t("quality.capa.statsAnalyzing")} value={stats.analyzing} icon={FileSearch} color="orange" />
          <StatCard label={t("quality.capa.statsInProgress")} value={stats.inProgress} icon={Play} color="blue" />
          <StatCard label={t("quality.capa.statsVerifying")} value={stats.verifying} icon={Shield} color="purple" />
          <StatCard label={t("quality.capa.statsClosed")} value={stats.closed} icon={CheckCircle} color="green" />
        </div>

        {/* 액션 버튼 */}
        {actionButtons && (
          <Card className="flex-shrink-0"><CardContent><div className="flex items-center gap-3">
            <span className="text-sm text-text-muted font-medium">{selectedRow?.capaNo}</span>
            {actionButtons}
            <button onClick={() => setSelectedRow(null)} className="ml-auto p-1 hover:bg-surface rounded transition-colors" title={t("common.close")}>
              <X className="w-4 h-4 text-text-muted" />
            </button>
          </div></CardContent></Card>
        )}

        {/* 조치 항목 목록 */}
        {selectedRow && (
          <ActionList capaId={selectedRow.id} capaStatus={selectedRow.status} onUpdate={fetchData} />
        )}

        {/* DataGrid */}
        <Card className="flex-1 min-h-0 overflow-hidden" padding="none"><CardContent className="h-full p-4">
          <DataGrid data={data} columns={columns} isLoading={loading}
            enableColumnFilter enableExport exportFileName={t("quality.capa.pageTitle")}
            getRowId={row => String((row as CapaRequest).id)}
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
                <ComCodeSelect groupCode="CAPA_STATUS" value={statusFilter}
                  onChange={setStatusFilter} labelPrefix={t("common.status")} />
                <ComCodeSelect groupCode="CAPA_TYPE" value={typeFilter}
                  onChange={setTypeFilter} labelPrefix={t("quality.capa.capaType")} />
                <ComCodeSelect groupCode="CAPA_SOURCE_TYPE" value={sourceFilter}
                  onChange={setSourceFilter} labelPrefix={t("quality.capa.sourceType")} />
              </div>
            }
          />
        </CardContent></Card>

        {/* 확인 모달 */}
        <ConfirmModal isOpen={!!confirmAction} onClose={() => setConfirmAction(null)}
          onConfirm={async () => { await confirmAction?.action(); setConfirmAction(null); }}
          title={confirmAction?.label ?? ""} message={`${confirmAction?.label ?? ""} ${t("common.confirm")}?`} />

        {/* 텍스트 입력 모달 */}
        <TextInputModal isOpen={!!textAction} title={textAction?.label ?? ""} fieldLabel={textAction?.field ?? ""}
          value={textInput} onChange={setTextInput}
          onConfirm={async () => { if (textAction && textInput.trim()) { await textAction.action(textInput.trim()); } setTextAction(null); setTextInput(""); }}
          onClose={() => { setTextAction(null); setTextInput(""); }} />
      </div>

      {/* 우측 패널: 등록/수정 */}
      {isPanelOpen && (
        <CapaFormPanel editData={editTarget}
          onClose={() => { setIsPanelOpen(false); setEditTarget(null); }}
          onSave={fetchData} />
      )}
    </div>
  );
}
