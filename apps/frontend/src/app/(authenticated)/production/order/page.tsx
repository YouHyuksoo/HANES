"use client";

/**
 * @file src/app/(authenticated)/production/order/page.tsx
 * @description 작업지시 관리 페이지 - 액션바 기반 상태관리, BOM 반제품 자동생성, 트리뷰
 *
 * 초보자 가이드:
 * 1. **작업지시**: 완제품/반제품 생산 명령 (WAITING → RUNNING → DONE)
 * 2. **액션바**: 행 선택 시 상단에 상태별 액션 버튼 표시
 * 3. **홀딩**: HOLD 상태 시 실적등록/출하 전부 차단
 * 4. **우측 패널**: 생성/수정 폼을 오른쪽 슬라이드 패널로 표시
 */

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import toast from "react-hot-toast";
import {
  Search, RefreshCw, ClipboardList, Plus, ChevronRight, ChevronDown,
  Edit2, Trash2, Play, CheckCircle2, PauseCircle, PlayCircle, XCircle,
  Barcode,
} from "lucide-react";
import { Card, CardContent, Button, Input, ComCodeBadge, StatCard, ConfirmModal, Modal } from "@/components/ui";
import { ComCodeSelect } from "@/components/shared";
import DataGrid from "@/components/data-grid/DataGrid";
import { ColumnDef } from "@tanstack/react-table";
import api from "@/services/api";
import { useSysConfigStore } from "@/stores/sysConfigStore";
import JobOrderFormPanel from "./components/JobOrderFormPanel";
import type { JobOrderFormData } from "./components/JobOrderFormPanel";

interface JobOrderItem {
  orderNo: string;
  parentOrderNo?: string | null;
  itemCode: string;
  part?: { itemCode?: string; itemName?: string; itemType?: string };
  lineCode?: string;
  routingCode?: string | null;
  routing?: { routingCode: string; routingName: string } | null;
  custPoNo?: string | null;
  planQty: number;
  goodQty: number;
  defectQty: number;
  planDate?: string;
  priority: number;
  status: string;
  startAt?: string;
  endAt?: string;
  remark?: string;
  children?: JobOrderItem[];
}

/** 트리 데이터를 평탄화 (들여쓰기 depth 포함) */
function flattenTree(items: JobOrderItem[], depth = 0): (JobOrderItem & { _depth: number })[] {
  const result: (JobOrderItem & { _depth: number })[] = [];
  for (const item of items) {
    result.push({ ...item, _depth: depth });
    if (item.children?.length) {
      result.push(...flattenTree(item.children, depth + 1));
    }
  }
  return result;
}

/** 액션 타입 정의 */
type ActionType = "start" | "complete" | "hold" | "holdRelease" | "cancel";

export default function JobOrderPage() {
  const { t } = useTranslation();
  const [data, setData] = useState<JobOrderItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [viewMode, setViewMode] = useState<"list" | "tree">("list");

  // 행 선택 상태
  const [selectedRow, setSelectedRow] = useState<JobOrderItem | null>(null);

  // 패널 상태
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<JobOrderFormData | null>(null);
  const panelAnimateRef = useRef(true);

  // 삭제/액션 확인 모달
  const [deleteTarget, setDeleteTarget] = useState<JobOrderItem | null>(null);
  const [pendingAction, setPendingAction] = useState<ActionType | null>(null);

  // 사전발행 모달
  const issueTiming = useSysConfigStore((s) => s.getConfig("FG_BARCODE_ISSUE_TIMING")) ?? "ON_INSPECT";
  const isPreIssue = issueTiming === "PRE_ISSUE";
  const [preIssueOpen, setPreIssueOpen] = useState(false);
  const [preIssueQty, setPreIssueQty] = useState(0);
  const [preIssueLoading, setPreIssueLoading] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      if (viewMode === "tree") {
        const res = await api.get("/production/job-orders/tree");
        setData(res.data?.data ?? []);
      } else {
        const params: Record<string, string> = { limit: "5000" };
        if (searchText) params.search = searchText;
        if (statusFilter) params.status = statusFilter;
        if (startDate) params.planDateFrom = startDate;
        if (endDate) params.planDateTo = endDate;
        const res = await api.get("/production/job-orders", { params });
        setData(res.data?.data ?? []);
      }
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [viewMode, searchText, statusFilter, startDate, endDate]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const displayData = useMemo(() => {
    if (viewMode === "tree") return flattenTree(data);
    return data.map(d => ({ ...d, _depth: 0 }));
  }, [viewMode, data]);

  const stats = useMemo(() => ({
    total: displayData.length,
    waiting: displayData.filter(d => d.status === "WAITING").length,
    running: displayData.filter(d => d.status === "RUNNING").length,
    done: displayData.filter(d => d.status === "DONE").length,
  }), [displayData]);

  const getProgress = (row: JobOrderItem) => {
    if (row.planQty === 0) return 0;
    return Math.round((row.goodQty / row.planQty) * 100);
  };

  // ===== 액션바 로직 =====
  const canStart = selectedRow?.status === "WAITING";
  const canComplete = selectedRow?.status === "RUNNING";
  const canHold = selectedRow?.status === "WAITING" || selectedRow?.status === "RUNNING";
  const canHoldRelease = selectedRow?.status === "HOLD";
  const canCancel = selectedRow?.status === "WAITING" || selectedRow?.status === "HOLD";

  const actionEndpoints: Record<ActionType, string> = {
    start: "start",
    complete: "complete",
    hold: "hold",
    holdRelease: "hold-release",
    cancel: "cancel",
  };

  const handleAction = useCallback(async () => {
    if (!selectedRow || !pendingAction) return;
    try {
      await api.post(`/production/job-orders/${selectedRow.orderNo}/${actionEndpoints[pendingAction]}`);
      setSelectedRow(null);
      fetchData();
    } catch {
      // api 인터셉터에서 처리
    } finally {
      setPendingAction(null);
    }
  }, [selectedRow, pendingAction, fetchData]);

  const getConfirmMessage = (action: ActionType) => {
    const key = `production.order.confirm${action.charAt(0).toUpperCase() + action.slice(1)}` as const;
    return t(key as string);
  };

  const getConfirmVariant = (action: ActionType): "danger" | "default" => {
    return action === "cancel" ? "danger" : "default";
  };

  /** 사전발행 모달 열기 */
  const handleOpenPreIssue = () => {
    if (!selectedRow) return;
    setPreIssueQty(selectedRow.planQty);
    setPreIssueOpen(true);
  };

  /** 사전발행 실행 */
  const handlePreIssue = async () => {
    if (!selectedRow || preIssueQty <= 0) return;
    setPreIssueLoading(true);
    try {
      await api.post("/quality/continuity-inspect/pre-issue", {
        orderNo: selectedRow.orderNo,
        qty: preIssueQty,
      });
      toast.success(t("production.order.preIssueSuccess", { count: preIssueQty }));
      setPreIssueOpen(false);
    } catch { /* api 인터셉터에서 처리 */ }
    finally { setPreIssueLoading(false); }
  };

  // ===== 패널 로직 =====
  const handleCreate = () => {
    panelAnimateRef.current = true;
    setEditingOrder(null);
    setIsPanelOpen(true);
  };

  const handleEdit = (row: JobOrderItem) => {
    panelAnimateRef.current = !isPanelOpen;
    setEditingOrder({
      orderNo: row.orderNo,
      itemCode: row.itemCode,
      lineCode: row.lineCode,
      custPoNo: row.custPoNo,
      planQty: row.planQty,
      planDate: row.planDate,
      priority: row.priority,
      remark: row.remark,
    });
    setIsPanelOpen(true);
  };

  const handlePanelClose = () => {
    setIsPanelOpen(false);
    setEditingOrder(null);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await api.delete(`/production/job-orders/${deleteTarget.orderNo}`);
      fetchData();
    } catch {
      // api 인터셉터에서 처리
    } finally {
      setDeleteTarget(null);
    }
  };

  /** 행 클릭 시 선택/해제 토글 */
  const handleRowClick = (row: JobOrderItem & { _depth: number }) => {
    setSelectedRow(prev => prev?.orderNo === row.orderNo ? null : row);
  };

  const columns = useMemo<ColumnDef<JobOrderItem & { _depth: number }>[]>(() => [
    {
      id: "actions", header: "", size: 60,
      meta: { align: "center" as const, filterType: "none" as const },
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <button onClick={(e) => { e.stopPropagation(); handleEdit(row.original); }}
            className="p-1 rounded hover:bg-primary/10 text-text-muted hover:text-primary transition-colors"
            title={t("common.edit")}>
            <Edit2 className="w-3.5 h-3.5" />
          </button>
          <button onClick={(e) => { e.stopPropagation(); setDeleteTarget(row.original); }}
            className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-text-muted hover:text-red-500 transition-colors"
            title={t("common.delete")}>
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      ),
    },
    {
      accessorKey: "orderNo", header: t("production.order.orderNo"), size: 180,
      meta: { filterType: "text" as const },
      cell: ({ row }) => {
        const depth = row.original._depth;
        return (
          <span className="flex items-center gap-1" style={{ paddingLeft: `${depth * 20}px` }}>
            {depth > 0 && <ChevronRight className="w-3 h-3 text-text-muted" />}
            {row.original.children?.length ? <ChevronDown className="w-3 h-3 text-primary" /> : null}
            <span className="font-mono text-sm">{row.original.orderNo}</span>
          </span>
        );
      },
    },
    {
      id: "partCode", header: t("common.partCode"), size: 110,
      meta: { filterType: "text" as const },
      accessorFn: (row) => row.part?.itemCode || "",
      cell: ({ getValue }) => <span className="font-mono text-sm">{(getValue() as string) || "-"}</span>,
    },
    {
      id: "partName", header: t("common.partName"), size: 140,
      meta: { filterType: "text" as const },
      accessorFn: (row) => row.part?.itemName || "",
    },
    {
      id: "partType", header: t("production.order.partType"), size: 70,
      meta: { filterType: "multi" as const },
      accessorFn: (row) => row.part?.itemType || "",
      cell: ({ getValue }) => {
        const v = getValue() as string;
        if (!v) return "-";
        const cls = v === "FG" ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
          : v === "WIP" ? "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300"
          : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400";
        return <span className={`px-2 py-0.5 text-xs rounded-full ${cls}`}>{v}</span>;
      },
    },
    {
      accessorKey: "lineCode", header: t("monthlyPlan.lineCode"), size: 90,
      meta: { filterType: "text" as const },
      cell: ({ getValue }) => (getValue() as string) || "-",
    },
    {
      accessorKey: "custPoNo", header: t("production.order.custPoNo"), size: 130,
      meta: { filterType: "text" as const },
      cell: ({ getValue }) => <span className="font-mono text-sm">{(getValue() as string) || "-"}</span>,
    },
    {
      accessorKey: "planQty", header: t("production.order.planQty"), size: 80,
      cell: ({ getValue }) => <span className="font-medium">{(getValue() as number).toLocaleString()}</span>,
      meta: { filterType: "number" as const, align: "right" as const },
    },
    {
      accessorKey: "goodQty", header: t("production.order.prodQty"), size: 80,
      cell: ({ getValue }) => <span>{(getValue() as number).toLocaleString()}</span>,
      meta: { filterType: "number" as const, align: "right" as const },
    },
    {
      id: "progress", header: t("production.order.progress"), size: 120,
      meta: { filterType: "none" as const },
      cell: ({ row }) => {
        const p = getProgress(row.original);
        return (
          <div className="flex items-center gap-2">
            <div className="flex-1 h-2 bg-background rounded-full overflow-hidden">
              <div className="h-full bg-primary rounded-full" style={{ width: `${p}%` }} />
            </div>
            <span className="text-xs text-text-muted w-10">{p}%</span>
          </div>
        );
      },
    },
    {
      accessorKey: "status", header: t("common.status"), size: 80,
      meta: { filterType: "multi" as const },
      cell: ({ getValue }) => <ComCodeBadge groupCode="JOB_ORDER_STATUS" code={getValue() as string} />,
    },
    {
      accessorKey: "planDate", header: t("production.order.planDate"), size: 100,
      meta: { filterType: "date" as const },
      cell: ({ getValue }) => {
        const v = getValue() as string;
        return v ? String(v).slice(0, 10) : "-";
      },
    },
  ], [t, isPanelOpen]);

  return (
    <div className="flex h-full animate-fade-in">
      {/* 좌측: 메인 콘텐츠 */}
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden p-6 gap-4">
        <div className="flex justify-between items-center flex-shrink-0">
          <div>
            <h1 className="text-xl font-bold text-text flex items-center gap-2">
              <ClipboardList className="w-7 h-7 text-primary" />
              {t("production.order.title")}
            </h1>
            <p className="text-text-muted mt-1">{t("production.order.description")}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={fetchData}>
              <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} />{t("common.refresh")}
            </Button>
            <Button variant="secondary" size="sm"
              onClick={() => setViewMode(v => v === "list" ? "tree" : "list")}>
              {viewMode === "list" ? t("production.order.treeView") : t("production.order.listView")}
            </Button>
            <Button size="sm" onClick={handleCreate}>
              <Plus className="w-4 h-4 mr-1" /> {t("production.order.create")}
            </Button>
          </div>
        </div>

        {/* 액션바 */}
        {selectedRow && (
          <div className="flex items-center gap-2 px-4 py-2 bg-primary/5 dark:bg-primary/10 border border-primary/20 rounded-lg flex-shrink-0 animate-fade-in">
            <span className="text-xs font-medium text-text mr-2">
              {selectedRow.orderNo}
            </span>
            <ComCodeBadge groupCode="JOB_ORDER_STATUS" code={selectedRow.status} />
            <div className="flex-1" />
            <Button size="sm" variant="secondary" disabled={!canStart}
              onClick={() => setPendingAction("start")}>
              <Play className="w-3.5 h-3.5 mr-1" />{t("production.order.actionStart")}
            </Button>
            <Button size="sm" variant="secondary" disabled={!canComplete}
              onClick={() => setPendingAction("complete")}>
              <CheckCircle2 className="w-3.5 h-3.5 mr-1" />{t("production.order.actionComplete")}
            </Button>
            <Button size="sm" variant="secondary" disabled={!canHold}
              onClick={() => setPendingAction("hold")}>
              <PauseCircle className="w-3.5 h-3.5 mr-1" />{t("production.order.actionHold")}
            </Button>
            <Button size="sm" variant="secondary" disabled={!canHoldRelease}
              onClick={() => setPendingAction("holdRelease")}>
              <PlayCircle className="w-3.5 h-3.5 mr-1" />{t("production.order.actionHoldRelease")}
            </Button>
            <Button size="sm" variant="secondary" disabled={!canCancel}
              onClick={() => setPendingAction("cancel")}
              className={canCancel ? "text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30" : ""}>
              <XCircle className="w-3.5 h-3.5 mr-1" />{t("production.order.actionCancel")}
            </Button>
            {isPreIssue && (
              <Button size="sm" variant="secondary" onClick={handleOpenPreIssue}>
                <Barcode className="w-3.5 h-3.5 mr-1" />{t("production.order.preIssueBtn")}
              </Button>
            )}
          </div>
        )}

        <div className="grid grid-cols-4 gap-3 flex-shrink-0">
          <StatCard label={t("production.order.stats.total")} value={stats.total} icon={ClipboardList} color="blue" />
          <StatCard label={t("production.order.stats.waiting")} value={stats.waiting} icon={ClipboardList} color="yellow" />
          <StatCard label={t("production.order.stats.running")} value={stats.running} icon={ClipboardList} color="green" />
          <StatCard label={t("production.order.stats.done")} value={stats.done} icon={ClipboardList} color="purple" />
        </div>

        <Card className="flex-1 min-h-0 overflow-hidden" padding="none"><CardContent className="h-full p-4">
          <DataGrid data={displayData} columns={columns} isLoading={loading} enableColumnFilter enableExport exportFileName="작업지시"
            onRowClick={handleRowClick}
            rowClassName={(row: JobOrderItem & { _depth: number }) => row.orderNo === selectedRow?.orderNo ? "bg-primary/5 dark:bg-primary/10" : ""}
            toolbarLeft={
              <div className="flex gap-3 flex-1 min-w-0">
                <div className="flex-1 min-w-0">
                  <Input placeholder={t("production.order.searchPlaceholder")}
                    value={searchText} onChange={e => setSearchText(e.target.value)}
                    leftIcon={<Search className="w-4 h-4" />} fullWidth />
                </div>
                <div className="w-36 flex-shrink-0">
                  <ComCodeSelect groupCode="JOB_ORDER_STATUS" value={statusFilter}
                    onChange={setStatusFilter} labelPrefix="상태" fullWidth />
                </div>
                <div className="w-36 flex-shrink-0">
                  <Input type="date" value={startDate}
                    onChange={e => setStartDate(e.target.value)} fullWidth />
                </div>
                <div className="w-36 flex-shrink-0">
                  <Input type="date" value={endDate}
                    onChange={e => setEndDate(e.target.value)} fullWidth />
                </div>
              </div>
            } />
        </CardContent></Card>
      </div>

      {/* 우측: 패널 */}
      {isPanelOpen && (
        <JobOrderFormPanel
          editingOrder={editingOrder}
          onClose={handlePanelClose}
          onSave={fetchData}
          animate={panelAnimateRef.current}
        />
      )}

      {/* 삭제 확인 모달 */}
      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title={t("common.deleteConfirmTitle")}
        message={t("common.deleteConfirmMessage", { name: deleteTarget?.orderNo })}
        confirmText={t("common.delete")}
        variant="danger"
      />

      {/* 액션 확인 모달 */}
      <ConfirmModal
        isOpen={!!pendingAction}
        onClose={() => setPendingAction(null)}
        onConfirm={handleAction}
        title={pendingAction ? t(`production.order.action${pendingAction.charAt(0).toUpperCase() + pendingAction.slice(1)}`) : ""}
        message={pendingAction ? getConfirmMessage(pendingAction) : ""}
        confirmText={t("common.confirm")}
        variant={pendingAction ? getConfirmVariant(pendingAction) : "default"}
      />

      {/* 바코드 사전발행 모달 */}
      <Modal isOpen={preIssueOpen} onClose={() => setPreIssueOpen(false)}
        title={t("production.order.preIssueBtn")} size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setPreIssueOpen(false)} disabled={preIssueLoading}>
              {t("common.cancel")}
            </Button>
            <Button variant="primary" onClick={handlePreIssue}
              isLoading={preIssueLoading} disabled={preIssueQty <= 0}>
              {t("common.confirm")}
            </Button>
          </>
        }>
        <div className="space-y-3">
          <p className="text-sm text-text-muted">
            {selectedRow?.orderNo} - {selectedRow?.itemCode}
          </p>
          <label className="block text-sm font-medium text-text">
            {t("production.order.preIssueQty")}
          </label>
          <Input type="number" value={preIssueQty}
            onChange={(e) => setPreIssueQty(Number(e.target.value))}
            min={1} fullWidth />
        </div>
      </Modal>
    </div>
  );
}
