"use client";

/**
 * @file src/app/(authenticated)/quality/fai/page.tsx
 * @description 초물검사(FAI) 페이지 — IATF 16949 8.3.4.4 신규/변경 품목 첫 생산품 검증
 *
 * 초보자 가이드:
 * 1. StatCard 5개: 전체, 요청, 검사중, 합격, 불합격
 * 2. DataGrid + 우측 FormPanel + 하단 FaiItemList
 * 3. 상태 전환: 검사시작 / 검사완료(PASS/FAIL/CONDITIONAL) / 승인
 */
import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { ColumnDef } from "@tanstack/react-table";
import {
  Plus, RefreshCw, ClipboardCheck, Clock, Play, CheckCircle,
  Search as SearchIcon, Calendar, ShieldCheck, XCircle, FileSearch, X,
} from "lucide-react";
import { Card, CardContent, Button, Input, StatCard, ComCodeBadge, ConfirmModal } from "@/components/ui";
import DataGrid from "@/components/data-grid/DataGrid";
import { ComCodeSelect } from "@/components/shared";
import api from "@/services/api";
import FaiFormPanel from "./components/FaiFormPanel";
import FaiItemList from "./components/FaiItemList";

interface FaiRequest {
  id: number; faiNo: string; triggerType: string; triggerRef: string;
  itemCode: string; orderNo: string; lineCode: string; sampleQty: number;
  inspectorCode: string; status: string; inspectDate: string;
  result: string; remarks: string; approvalCode: string;
  approvedAt: string; createdAt: string;
}

export default function FaiPage() {
  const { t } = useTranslation();
  const [data, setData] = useState<FaiRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedRow, setSelectedRow] = useState<FaiRequest | null>(null);
  const [searchText, setSearchText] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [triggerFilter, setTriggerFilter] = useState("");
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<FaiRequest | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ label: string; action: () => Promise<void> } | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { limit: "5000" };
      if (searchText) params.search = searchText;
      if (statusFilter) params.status = statusFilter;
      if (triggerFilter) params.triggerType = triggerFilter;
      if (dateFrom) params.startDate = dateFrom;
      if (dateTo) params.endDate = dateTo;
      const res = await api.get("/quality/fai", { params });
      setData(res.data?.data ?? []);
    } catch { setData([]); }
    finally { setLoading(false); }
  }, [searchText, statusFilter, triggerFilter, dateFrom, dateTo]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const stats = useMemo(() => ({
    total: data.length,
    requested: data.filter(d => d.status === "REQUESTED").length,
    inspecting: data.filter(d => ["SAMPLING", "INSPECTING"].includes(d.status)).length,
    pass: data.filter(d => d.status === "PASS").length,
    fail: data.filter(d => ["FAIL", "CONDITIONAL"].includes(d.status)).length,
  }), [data]);

  const patchAction = useCallback(async (id: number, ep: string, body?: object) => {
    await api.patch(`/quality/fai/${id}/${ep}`, body ?? {});
    fetchData(); setSelectedRow(null);
  }, [fetchData]);

  const handleStart = () => {
    if (!selectedRow) return;
    setConfirmAction({ label: t("quality.fai.start"), action: () => patchAction(selectedRow.id, "start") });
  };
  const handleComplete = (result: string) => {
    if (!selectedRow) return;
    setConfirmAction({ label: t("quality.fai.complete"), action: () => patchAction(selectedRow.id, "complete", { result }) });
  };
  const handleApprove = () => {
    if (!selectedRow) return;
    setConfirmAction({ label: t("quality.fai.approve"), action: () => patchAction(selectedRow.id, "approve") });
  };

  const columns = useMemo<ColumnDef<FaiRequest>[]>(() => [
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
    { accessorKey: "faiNo", header: t("quality.fai.faiNo"), size: 170, meta: { filterType: "text" as const },
      cell: ({ getValue }) => <span className="text-primary font-medium">{getValue() as string}</span> },
    { accessorKey: "triggerType", header: t("quality.fai.triggerType"), size: 130,
      cell: ({ getValue }) => <ComCodeBadge groupCode="FAI_TRIGGER_TYPE" code={getValue() as string} /> },
    { accessorKey: "itemCode", header: t("common.code"), size: 130, meta: { filterType: "text" as const } },
    { accessorKey: "sampleQty", header: t("quality.fai.sampleQty"), size: 90,
      cell: ({ getValue }) => <span className="font-mono text-right block">{(getValue() as number).toLocaleString()}</span> },
    { accessorKey: "status", header: t("common.status"), size: 120, meta: { filterType: "multi" as const },
      cell: ({ getValue }) => <ComCodeBadge groupCode="FAI_STATUS" code={getValue() as string} /> },
    { accessorKey: "result", header: t("quality.fai.result"), size: 100,
      cell: ({ getValue }) => { const v = getValue() as string; return v ? <ComCodeBadge groupCode="FAI_RESULT" code={v} /> : "-"; } },
    { accessorKey: "inspectorCode", header: t("quality.fai.inspectorCode"), size: 100 },
    { accessorKey: "createdAt", header: t("common.date"), size: 110, meta: { filterType: "date" as const },
      cell: ({ getValue }) => (getValue() as string)?.slice(0, 10) },
  ], [t]);

  const actionButtons = useMemo(() => {
    if (!selectedRow) return null;
    const s = selectedRow.status;
    return (
      <div className="flex gap-2 flex-wrap">
        {s === "REQUESTED" && (
          <>
            <Button size="sm" variant="secondary" onClick={() => { setEditTarget(selectedRow); setIsPanelOpen(true); }}>
              {t("common.edit")}
            </Button>
            <Button size="sm" onClick={handleStart}><Play className="w-4 h-4 mr-1" />{t("quality.fai.start")}</Button>
          </>
        )}
        {["SAMPLING", "INSPECTING"].includes(s) && (
          <div className="flex gap-1">
            <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white" onClick={() => handleComplete("PASS")}>
              <CheckCircle className="w-4 h-4 mr-1" />PASS</Button>
            <Button size="sm" className="bg-red-600 hover:bg-red-700 text-white" onClick={() => handleComplete("FAIL")}>
              <XCircle className="w-4 h-4 mr-1" />FAIL</Button>
            <Button size="sm" variant="secondary" onClick={() => handleComplete("CONDITIONAL")}>CONDITIONAL</Button>
          </div>
        )}
        {["PASS", "FAIL", "CONDITIONAL"].includes(s) && !selectedRow.approvedAt && (
          <Button size="sm" onClick={handleApprove}><ShieldCheck className="w-4 h-4 mr-1" />{t("quality.fai.approve")}</Button>
        )}
      </div>
    );
  }, [selectedRow, t]);

  return (
    <div className="flex h-full">
      <div className="flex-1 flex flex-col overflow-hidden p-6 gap-4 animate-fade-in">
        {/* 헤더 */}
        <div className="flex justify-between items-center flex-shrink-0">
          <div>
            <h1 className="text-xl font-bold text-text flex items-center gap-2">
              <ClipboardCheck className="w-7 h-7 text-primary" />{t("quality.fai.title")}
            </h1>
            <p className="text-text-muted mt-1">{t("quality.fai.subtitle")}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={fetchData}>
              <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} />{t("common.refresh")}
            </Button>
            <Button size="sm" onClick={() => { setEditTarget(null); setIsPanelOpen(true); }}>
              <Plus className="w-4 h-4 mr-1" />{t("quality.fai.create")}
            </Button>
          </div>
        </div>

        {/* 통계 카드 */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 flex-shrink-0">
          <StatCard label={t("quality.fai.statsTotal")} value={stats.total} icon={ClipboardCheck} color="blue" />
          <StatCard label={t("quality.fai.statsRequested")} value={stats.requested} icon={Clock} color="yellow" />
          <StatCard label={t("quality.fai.statsInspecting")} value={stats.inspecting} icon={Play} color="orange" />
          <StatCard label={t("quality.fai.statsPass")} value={stats.pass} icon={CheckCircle} color="green" />
          <StatCard label={t("quality.fai.statsFail")} value={stats.fail} icon={XCircle} color="red" />
        </div>

        {/* 액션 버튼 */}
        {actionButtons && (
          <Card className="flex-shrink-0"><CardContent><div className="flex items-center gap-3">
            <span className="text-sm text-text-muted font-medium">{selectedRow?.faiNo}</span>
            {actionButtons}
            <button onClick={() => setSelectedRow(null)} className="ml-auto p-1 hover:bg-surface rounded transition-colors" title={t("common.close")}>
              <X className="w-4 h-4 text-text-muted" />
            </button>
          </div></CardContent></Card>
        )}

        {/* DataGrid */}
        <Card className="flex-1 min-h-0 overflow-hidden" padding="none"><CardContent className="h-full p-4">
          <DataGrid data={data} columns={columns} isLoading={loading}
            enableColumnFilter enableExport exportFileName={t("quality.fai.title")}
            getRowId={row => String((row as FaiRequest).id)}
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
                <ComCodeSelect groupCode="FAI_STATUS" value={statusFilter}
                  onChange={setStatusFilter} labelPrefix={t("common.status")} />
                <ComCodeSelect groupCode="FAI_TRIGGER_TYPE" value={triggerFilter}
                  onChange={setTriggerFilter} labelPrefix={t("quality.fai.triggerType")} />
              </div>
            }
          />
        </CardContent></Card>

        {/* 검사항목 상세 */}
        {selectedRow && (
          <FaiItemList faiId={selectedRow.id} faiNo={selectedRow.faiNo}
            editable={["SAMPLING", "INSPECTING"].includes(selectedRow.status)} />
        )}

        <ConfirmModal isOpen={!!confirmAction} onClose={() => setConfirmAction(null)}
          onConfirm={async () => { await confirmAction?.action(); setConfirmAction(null); }}
          title={confirmAction?.label ?? ""} message={`${confirmAction?.label ?? ""} ${t("common.confirm")}?`} />
      </div>

      {isPanelOpen && (
        <FaiFormPanel editData={editTarget}
          onClose={() => { setIsPanelOpen(false); setEditTarget(null); }}
          onSave={fetchData} />
      )}
    </div>
  );
}
