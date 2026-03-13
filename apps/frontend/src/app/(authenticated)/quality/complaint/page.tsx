"use client";

/**
 * @file quality/complaint/page.tsx
 * @description 고객클레임 관리 — IATF 16949 10.2.6. StatCard + DataGrid + FormPanel.
 *   상태 흐름: RECEIVED → INVESTIGATING → RESPONDING → RESOLVED → CLOSED
 */
import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { ColumnDef } from "@tanstack/react-table";
import {
  Plus, RefreshCw, AlertTriangle, Clock, Search as SearchIcon,
  Calendar, CheckCircle, Eye, FileText, Link2, X,
} from "lucide-react";
import { Card, CardContent, Button, Input, StatCard, ComCodeBadge, ConfirmModal } from "@/components/ui";
import DataGrid from "@/components/data-grid/DataGrid";
import { ComCodeSelect } from "@/components/shared";
import api from "@/services/api";
import ComplaintFormPanel from "./components/ComplaintFormPanel";

/** 클레임 데이터 타입 */
interface Complaint {
  id: number;
  complaintNo: string;
  customerCode: string;
  customerName: string;
  complaintDate: string;
  itemCode: string;
  lotNo: string;
  defectQty: number;
  complaintType: string;
  description: string;
  urgency: string;
  status: string;
  responsibleCode: string;
  capaId: number | null;
  costAmount: number | null;
  createdAt: string;
}

export default function ComplaintPage() {
  const { t } = useTranslation();
  const [data, setData] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedRow, setSelectedRow] = useState<Complaint | null>(null);

  /* -- 필터 상태 -- */
  const [searchText, setSearchText] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [urgencyFilter, setUrgencyFilter] = useState("");

  /* -- 패널 상태 -- */
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Complaint | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ label: string; action: () => Promise<void> } | null>(null);
  const [capaIdInput, setCapaIdInput] = useState("");
  const [isCapaModalOpen, setIsCapaModalOpen] = useState(false);

  /* -- 데이터 조회 -- */
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { limit: "5000" };
      if (searchText) params.search = searchText;
      if (statusFilter) params.status = statusFilter;
      if (typeFilter) params.complaintType = typeFilter;
      if (urgencyFilter) params.urgency = urgencyFilter;
      if (dateFrom) params.startDate = dateFrom;
      if (dateTo) params.endDate = dateTo;
      const res = await api.get("/quality/complaints", { params });
      setData(res.data?.data ?? []);
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [searchText, statusFilter, typeFilter, urgencyFilter, dateFrom, dateTo]);

  useEffect(() => { fetchData(); }, [fetchData]);

  /* -- 통계 -- */
  const stats = useMemo(() => {
    const total = data.length;
    const received = data.filter(d => d.status === "RECEIVED").length;
    const investigating = data.filter(d => d.status === "INVESTIGATING").length;
    const responding = data.filter(d => d.status === "RESPONDING").length;
    const resolved = data.filter(d => ["RESOLVED", "CLOSED"].includes(d.status)).length;
    return { total, received, investigating, responding, resolved };
  }, [data]);

  /* -- 상태 전환 API -- */
  const patchAction = useCallback(async (id: number, endpoint: string, body?: object) => {
    await api.patch(`/quality/complaints/${id}/${endpoint}`, body ?? {});
    fetchData();
    setSelectedRow(null);
  }, [fetchData]);

  /* -- 액션 핸들러 -- */
  const handleInvestigate = () => {
    if (!selectedRow) return;
    setConfirmAction({
      label: t("quality.complaint.investigate"),
      action: () => patchAction(selectedRow.id, "investigate"),
    });
  };
  const handleRespond = () => {
    if (!selectedRow) return;
    setConfirmAction({
      label: t("quality.complaint.respond"),
      action: () => patchAction(selectedRow.id, "respond"),
    });
  };
  const handleResolve = () => {
    if (!selectedRow) return;
    setConfirmAction({
      label: t("quality.complaint.resolve"),
      action: () => patchAction(selectedRow.id, "resolve"),
    });
  };
  const handleClose = () => {
    if (!selectedRow) return;
    setConfirmAction({
      label: t("common.close"),
      action: () => patchAction(selectedRow.id, "close"),
    });
  };
  const handleLinkCapa = async () => {
    if (!selectedRow || !capaIdInput) return;
    await patchAction(selectedRow.id, "link-capa", { capaId: Number(capaIdInput) });
    setIsCapaModalOpen(false);
    setCapaIdInput("");
  };

  /* -- 컬럼 정의 -- */
  const columns = useMemo<ColumnDef<Complaint>[]>(() => [
    { accessorKey: "complaintNo", header: t("quality.complaint.complaintNo"), size: 170,
      meta: { filterType: "text" as const },
      cell: ({ getValue }) => <span className="text-primary font-medium">{getValue() as string}</span> },
    { accessorKey: "customerName", header: t("quality.complaint.customerName"), size: 150,
      meta: { filterType: "text" as const } },
    { accessorKey: "complaintDate", header: t("quality.complaint.complaintDate"), size: 110,
      meta: { filterType: "date" as const },
      cell: ({ getValue }) => (getValue() as string)?.slice(0, 10) },
    { accessorKey: "itemCode", header: t("master.bom.itemCode"), size: 120,
      meta: { filterType: "text" as const } },
    { accessorKey: "defectQty", header: t("quality.complaint.defectQty"), size: 90,
      meta: { filterType: "number" as const },
      cell: ({ getValue }) => <span className="font-mono text-right block">{(getValue() as number)?.toLocaleString()}</span> },
    { accessorKey: "complaintType", header: t("quality.complaint.complaintType"), size: 110,
      meta: { filterType: "multi" as const },
      cell: ({ getValue }) => <ComCodeBadge groupCode="COMPLAINT_TYPE" code={getValue() as string} /> },
    { accessorKey: "urgency", header: t("quality.complaint.urgency"), size: 90,
      meta: { filterType: "multi" as const },
      cell: ({ getValue }) => <ComCodeBadge groupCode="COMPLAINT_URGENCY" code={getValue() as string} /> },
    { accessorKey: "status", header: t("common.status"), size: 110,
      meta: { filterType: "multi" as const },
      cell: ({ getValue }) => <ComCodeBadge groupCode="COMPLAINT_STATUS" code={getValue() as string} /> },
    { accessorKey: "responsibleCode", header: t("common.manager"), size: 100,
      meta: { filterType: "text" as const } },
  ], [t]);

  /* -- 액션 버튼 -- */
  const actionButtons = useMemo(() => {
    if (!selectedRow) return null;
    const s = selectedRow.status;
    return (
      <div className="flex gap-2 flex-wrap">
        {s === "RECEIVED" && (
          <>
            <Button size="sm" variant="secondary" onClick={() => { setEditTarget(selectedRow); setIsPanelOpen(true); }}>
              <Eye className="w-4 h-4 mr-1" />{t("common.edit")}
            </Button>
            <Button size="sm" onClick={handleInvestigate}>
              <SearchIcon className="w-4 h-4 mr-1" />{t("quality.complaint.investigate")}
            </Button>
          </>
        )}
        {s === "INVESTIGATING" && (
          <Button size="sm" onClick={handleRespond}>
            <FileText className="w-4 h-4 mr-1" />{t("quality.complaint.respond")}
          </Button>
        )}
        {s === "RESPONDING" && (
          <Button size="sm" onClick={handleResolve}>
            <CheckCircle className="w-4 h-4 mr-1" />{t("quality.complaint.resolve")}
          </Button>
        )}
        {s === "RESOLVED" && (
          <Button size="sm" onClick={handleClose}>
            <X className="w-4 h-4 mr-1" />{t("common.close")}
          </Button>
        )}
        {!selectedRow.capaId && !["CLOSED"].includes(s) && (
          <Button size="sm" variant="secondary" onClick={() => setIsCapaModalOpen(true)}>
            <Link2 className="w-4 h-4 mr-1" />{t("quality.complaint.linkCapa")}
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
              <AlertTriangle className="w-7 h-7 text-primary" />{t("quality.complaint.title")}
            </h1>
            <p className="text-text-muted mt-1">{t("quality.complaint.subtitle")}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={fetchData}>
              <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} />{t("common.refresh")}
            </Button>
            <Button size="sm" onClick={() => { setEditTarget(null); setIsPanelOpen(true); }}>
              <Plus className="w-4 h-4 mr-1" />{t("quality.complaint.create")}
            </Button>
          </div>
        </div>

        {/* 통계 카드 */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 flex-shrink-0">
          <StatCard label={t("quality.complaint.statsTotal")} value={stats.total} icon={AlertTriangle} color="blue" />
          <StatCard label={t("quality.complaint.statsReceived")} value={stats.received} icon={Clock} color="yellow" />
          <StatCard label={t("quality.complaint.statsInvestigating")} value={stats.investigating} icon={SearchIcon} color="orange" />
          <StatCard label={t("quality.complaint.statsResponding")} value={stats.responding} icon={FileText} color="purple" />
          <StatCard label={t("quality.complaint.statsResolved")} value={stats.resolved} icon={CheckCircle} color="green" />
        </div>

        {/* 액션 버튼 */}
        {actionButtons && (
          <Card className="flex-shrink-0"><CardContent><div className="flex items-center gap-3">
            <span className="text-sm text-text-muted font-medium">{selectedRow?.complaintNo}</span>
            {actionButtons}
          </div></CardContent></Card>
        )}

        {/* DataGrid */}
        <Card className="flex-1 min-h-0 overflow-hidden" padding="none"><CardContent className="h-full p-4">
          <DataGrid data={data} columns={columns} isLoading={loading}
            enableColumnFilter enableExport exportFileName={t("quality.complaint.title")}
            onRowClick={row => setSelectedRow(row as Complaint)}
            getRowId={row => String((row as Complaint).id)}
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
                <ComCodeSelect groupCode="COMPLAINT_STATUS" value={statusFilter}
                  onChange={setStatusFilter} labelPrefix={t("common.status")} />
                <ComCodeSelect groupCode="COMPLAINT_TYPE" value={typeFilter}
                  onChange={setTypeFilter} labelPrefix={t("quality.complaint.complaintType")} />
                <ComCodeSelect groupCode="COMPLAINT_URGENCY" value={urgencyFilter}
                  onChange={setUrgencyFilter} labelPrefix={t("quality.complaint.urgency")} />
              </div>
            }
          />
        </CardContent></Card>

        {/* 확인 모달 */}
        <ConfirmModal isOpen={!!confirmAction} onClose={() => setConfirmAction(null)}
          onConfirm={async () => { await confirmAction?.action(); setConfirmAction(null); }}
          title={confirmAction?.label ?? ""} message={`${confirmAction?.label ?? ""} ${t("common.confirm")}?`} />

        {/* CAPA 연계 모달 */}
        <ConfirmModal isOpen={isCapaModalOpen} onClose={() => { setIsCapaModalOpen(false); setCapaIdInput(""); }}
          onConfirm={handleLinkCapa}
          title={t("quality.complaint.linkCapa")}
          message={
            <Input label="CAPA ID" type="number" value={capaIdInput}
              onChange={e => setCapaIdInput(e.target.value)} fullWidth />
          } />
      </div>

      {/* 우측 패널: 등록/수정 */}
      {isPanelOpen && (
        <ComplaintFormPanel editData={editTarget}
          onClose={() => { setIsPanelOpen(false); setEditTarget(null); }}
          onSave={fetchData} />
      )}
    </div>
  );
}
