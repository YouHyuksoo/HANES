"use client";

/**
 * @file src/app/(authenticated)/quality/audit/page.tsx
 * @description 내부심사 관리 페이지 — IATF 16949 9.2 내부심사 요구사항 준수
 *
 * 초보자 가이드:
 * 1. **DataGrid**: 내부심사 계획 목록 표시 (심사번호, 유형, 범위, 대상부서, 심사원 등)
 * 2. **우측 패널**: AuditFormPanel (등록/수정) 슬라이드 패널
 * 3. **AuditFindingList**: 선택된 심사의 발견사항 목록 (하단 카드)
 * 4. **상태 전환**: 완료, 마감 액션 버튼
 * 5. API: GET/POST /quality/audits, PATCH /quality/audits/:id
 */
import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { ColumnDef } from "@tanstack/react-table";
import {
  Plus, RefreshCw, ClipboardCheck,
  CheckCircle, Lock, Eye, Pencil, Trash2, Undo2,
} from "lucide-react";
import { Card, CardContent, Button, ComCodeBadge, ConfirmModal } from "@/components/ui";
import DataGrid from "@/components/data-grid/DataGrid";
import { ComCodeSelect } from "@/components/shared";
import api from "@/services/api";
import AuditFormPanel from "./components/AuditFormPanel";
import AuditFindingList from "./components/AuditFindingList";

/** 내부심사 데이터 타입 */
interface Audit {
  id: number; auditNo: string; auditType: string; auditScope: string;
  targetDept: string; auditor: string; coAuditor: string;
  scheduledDate: string; actualDate: string; status: string;
  overallResult: string; summary: string; createdAt: string;
}

export default function AuditPage() {
  const { t } = useTranslation();
  const [data, setData] = useState<Audit[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedRow, setSelectedRow] = useState<Audit | null>(null);

  /* -- 필터 상태 -- */
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Audit | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ label: string; action: () => Promise<void> } | null>(null);

  /* -- 데이터 조회 -- */
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { limit: "5000" };
      if (typeFilter) params.auditType = typeFilter;
      if (statusFilter) params.status = statusFilter;
      const res = await api.get("/quality/audits", { params });
      setData(res.data?.data ?? []);
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [typeFilter, statusFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleStateChange = (endpoint: string, label: string) => {
    if (!selectedRow) return;
    setConfirmAction({
      label,
      action: async () => {
        await api.patch(`/quality/audits/${endpoint}/${selectedRow.id}`);
        fetchData();
        setSelectedRow(null);
      },
    });
  };

  /* -- 컬럼 정의 -- */
  const columns = useMemo<ColumnDef<Audit>[]>(
    () => [
      {
        accessorKey: "auditNo",
        header: t("quality.audit.auditNo"),
        size: 160,
        meta: { filterType: "text" as const },
        cell: ({ getValue }) => (
          <span className="text-primary font-medium">{getValue() as string}</span>
        ),
      },
      {
        accessorKey: "auditType",
        header: t("quality.audit.auditType"),
        size: 120,
        meta: { filterType: "multi" as const },
        cell: ({ getValue }) => (
          <ComCodeBadge groupCode="AUDIT_TYPE" code={getValue() as string} />
        ),
      },
      {
        accessorKey: "auditScope",
        header: t("quality.audit.auditScope"),
        size: 180,
        meta: { filterType: "text" as const },
      },
      {
        accessorKey: "targetDept",
        header: t("quality.audit.targetDept"),
        size: 120,
        meta: { filterType: "text" as const },
      },
      {
        accessorKey: "auditor",
        header: t("quality.audit.auditor"),
        size: 100,
        meta: { filterType: "text" as const },
      },
      {
        accessorKey: "scheduledDate",
        header: t("quality.audit.scheduledDate"),
        size: 120,
        meta: { filterType: "date" as const },
        cell: ({ getValue }) => (getValue() as string)?.slice(0, 10),
      },
      {
        accessorKey: "status",
        header: t("common.status"),
        size: 110,
        meta: { filterType: "multi" as const },
        cell: ({ getValue }) => (
          <ComCodeBadge groupCode="AUDIT_STATUS" code={getValue() as string} />
        ),
      },
      {
        accessorKey: "overallResult",
        header: t("quality.audit.overallResult"),
        size: 110,
        meta: { filterType: "multi" as const },
        cell: ({ getValue }) => {
          const v = getValue() as string;
          return v ? <ComCodeBadge groupCode="AUDIT_RESULT" code={v} /> : "-";
        },
      },
    ],
    [t],
  );

  /* -- 삭제 -- */
  const handleDelete = useCallback(() => {
    if (!selectedRow) return;
    setConfirmAction({
      label: t("common.delete"),
      action: async () => {
        await api.delete(`/quality/audits/${selectedRow.id}`);
        fetchData();
        setSelectedRow(null);
      },
    });
  }, [selectedRow, fetchData, t]);

  /* -- 액션 버튼 -- */
  const actionButtons = useMemo(() => {
    if (!selectedRow) return null;
    const s = selectedRow.status;
    return (
      <div className="flex gap-2 flex-wrap">
        {(s === "PLANNED" || s === "IN_PROGRESS") ? (
          <Button size="sm" variant="secondary"
            onClick={() => { setEditTarget(selectedRow); setIsPanelOpen(true); }}>
            <Pencil className="w-4 h-4 mr-1" />{t("common.edit")}
          </Button>
        ) : (
          <Button size="sm" variant="secondary"
            onClick={() => { setEditTarget(selectedRow); setIsPanelOpen(true); }}>
            <Eye className="w-4 h-4 mr-1" />{t("common.detail")}
          </Button>
        )}
        {s === "PLANNED" && (
          <Button size="sm" variant="danger" onClick={handleDelete}>
            <Trash2 className="w-4 h-4 mr-1" />{t("common.delete")}
          </Button>
        )}
        {s === "IN_PROGRESS" && (
          <Button size="sm" onClick={() => handleStateChange("complete", t("quality.audit.complete"))}>
            <CheckCircle className="w-4 h-4 mr-1" />{t("quality.audit.complete")}
          </Button>
        )}
        {s === "COMPLETED" && (
          <>
            <Button size="sm" onClick={() => handleStateChange("close", t("quality.audit.close"))}>
              <Lock className="w-4 h-4 mr-1" />{t("quality.audit.close")}
            </Button>
            <Button size="sm" variant="secondary"
              onClick={() => handleStateChange("cancel-complete", t("quality.audit.cancelComplete"))}>
              <Undo2 className="w-4 h-4 mr-1" />{t("quality.audit.cancelComplete")}
            </Button>
          </>
        )}
        {s === "CLOSED" && (
          <Button size="sm" variant="secondary"
            onClick={() => handleStateChange("cancel-close", t("quality.audit.cancelClose"))}>
            <Undo2 className="w-4 h-4 mr-1" />{t("quality.audit.cancelClose")}
          </Button>
        )}
      </div>
    );
  }, [selectedRow, t, handleDelete]);

  return (
    <div className="flex-1 flex flex-col overflow-hidden p-6 gap-4 animate-fade-in">
        {/* 헤더 */}
        <div className="flex justify-between items-center flex-shrink-0">
          <div>
            <h1 className="text-xl font-bold text-text flex items-center gap-2">
              <ClipboardCheck className="w-7 h-7 text-primary" />
              {t("quality.audit.title")}
            </h1>
            <p className="text-text-muted mt-1">{t("quality.audit.subtitle")}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={fetchData}>
              <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} />
              {t("common.refresh")}
            </Button>
            <Button
              size="sm"
              onClick={() => {
                setEditTarget(null);
                setIsPanelOpen(true);
              }}
            >
              <Plus className="w-4 h-4 mr-1" />
              {t("common.add")}
            </Button>
          </div>
        </div>

        {actionButtons && (
          <div className="flex items-center gap-3 flex-shrink-0 px-1">
            <span className="text-xs text-text-muted font-medium">{selectedRow?.auditNo}</span>
            {actionButtons}
          </div>
        )}

        {/* 좌우 배치: 심사 목록(좌) + 발견사항(우) */}
        <div className="flex-1 min-h-0 flex gap-4">
          {/* 좌측: 심사 목록 그리드 */}
          <Card className={`min-h-0 overflow-hidden ${selectedRow ? "w-1/2" : "flex-1"}`} padding="none">
            <CardContent className="h-full p-4">
              <DataGrid
                data={data}
                columns={columns}
                isLoading={loading}
                enableColumnFilter
                enableExport
                exportFileName={t("quality.audit.title")}
                onRowClick={(row) => setSelectedRow(row as Audit)}
                getRowId={(row) => String((row as Audit).id)}
                selectedRowId={selectedRow ? String(selectedRow.id) : undefined}
                toolbarLeft={
                  <div className="flex gap-3 items-center flex-1 min-w-0 flex-wrap">
                    <ComCodeSelect
                      groupCode="AUDIT_TYPE"
                      value={typeFilter}
                      onChange={setTypeFilter}
                      labelPrefix={t("quality.audit.auditType")}
                    />
                    <ComCodeSelect
                      groupCode="AUDIT_STATUS"
                      value={statusFilter}
                      onChange={setStatusFilter}
                      labelPrefix={t("common.status")}
                    />
                  </div>
                }
              />
            </CardContent>
          </Card>

          {/* 우측: 발견사항 목록 */}
          {selectedRow && (
            <div className="w-1/2 min-h-0 overflow-auto">
              <AuditFindingList auditId={selectedRow.id} auditNo={selectedRow.auditNo} />
            </div>
          )}
        </div>

        {/* 확인 모달 */}
        <ConfirmModal
          isOpen={!!confirmAction}
          onClose={() => setConfirmAction(null)}
          onConfirm={async () => {
            await confirmAction?.action();
            setConfirmAction(null);
          }}
          title={confirmAction?.label ?? ""}
          message={`${confirmAction?.label ?? ""} ${t("common.confirm")}?`}
        />

      {/* 등록/수정 모달 */}
      <AuditFormPanel
        isOpen={isPanelOpen}
        editData={editTarget}
        onClose={() => {
          setIsPanelOpen(false);
          setEditTarget(null);
        }}
        onSave={fetchData}
      />
    </div>
  );
}
