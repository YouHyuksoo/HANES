/**
 * @file src/app/(authenticated)/system/document/page.tsx
 * @description 문서관리(DCC) 페이지 - IATF 16949 7.5 문서화된 정보 관리
 *
 * 초보자 가이드:
 * 1. **StatCard 4개**: 전체, 초안, 승인, 만료임박 통계 표시
 * 2. **DataGrid**: 문서 목록 + 검색/필터
 * 3. **우측 패널**: DocumentFormPanel으로 등록/수정/승인/개정
 * 4. **만료 하이라이트**: 30일 이내 만료 문서를 노란색 배경으로 강조
 * 5. API: GET/POST /system/documents, PATCH /system/documents/:id
 */

"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { ColumnDef } from "@tanstack/react-table";
import {
  FileText, Plus, RefreshCw, Search as SearchIcon,
  Clock, CheckCircle, AlertTriangle, Files, Pencil,
} from "lucide-react";
import { Card, CardContent, Button, Input, StatCard, ComCodeBadge } from "@/components/ui";
import DataGrid from "@/components/data-grid/DataGrid";
import { ComCodeSelect } from "@/components/shared";
import api from "@/services/api";
import DocumentFormPanel from "./components/DocumentFormPanel";

/** 문서 데이터 타입 */
interface Document {
  docNo: string;
  docTitle: string;
  docType: string;
  category: string;
  revisionNo: number;
  revisionDate: string;
  status: string;
  approvedBy: string;
  approvedAt: string;
  filePath: string;
  retentionPeriod: number;
  expiresAt: string;
  description: string;
  createdAt: string;
}

/** 만료 30일 이내 여부 판단 */
function isExpiringSoon(expiresAt: string | null): boolean {
  if (!expiresAt) return false;
  const diff = new Date(expiresAt).getTime() - Date.now();
  return diff > 0 && diff <= 30 * 24 * 60 * 60 * 1000;
}

export default function DocumentPage() {
  const { t } = useTranslation();
  const [data, setData] = useState<Document[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedRow, setSelectedRow] = useState<Document | null>(null);

  /* -- 필터 상태 -- */
  const [searchText, setSearchText] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  /* -- 패널 상태 -- */
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Document | null>(null);

  /* -- 데이터 조회 -- */
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { limit: "5000" };
      if (searchText) params.search = searchText;
      if (typeFilter) params.docType = typeFilter;
      if (statusFilter) params.status = statusFilter;
      const res = await api.get("/system/documents", { params });
      setData(res.data?.data ?? []);
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [searchText, typeFilter, statusFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  /* -- 통계 -- */
  const stats = useMemo(() => {
    const total = data.length;
    const draft = data.filter(d => d.status === "DRAFT").length;
    const approved = data.filter(d => d.status === "APPROVED").length;
    const expiring = data.filter(d => isExpiringSoon(d.expiresAt)).length;
    return { total, draft, approved, expiring };
  }, [data]);

  /* -- 패널 열기/닫기 -- */
  const handleCreate = () => { setEditTarget(null); setIsPanelOpen(true); };
  const handleRowClick = (row: Document) => {
    setSelectedRow(row);
    setEditTarget(row);
    setIsPanelOpen(true);
  };
  const handlePanelClose = () => { setIsPanelOpen(false); setEditTarget(null); };
  const handleSaved = () => { fetchData(); handlePanelClose(); };

  /* -- 컬럼 정의 -- */
  const columns = useMemo<ColumnDef<Document>[]>(() => [
    {
      id: "actions", header: "", size: 60,
      meta: { align: "center" as const, filterType: "none" as const },
      cell: ({ row }) => (
        <button
          onClick={(e) => { e.stopPropagation(); handleRowClick(row.original); }}
          className="p-1 hover:bg-surface rounded transition-colors" title={t("common.edit", "수정")}
        >
          <Pencil className="w-4 h-4 text-primary" />
        </button>
      ),
    },
    { accessorKey: "docNo", header: t("system.document.docNo"), size: 150,
      meta: { filterType: "text" as const },
      cell: ({ getValue }) => <span className="text-primary font-medium">{getValue() as string}</span> },
    { accessorKey: "docTitle", header: t("system.document.docTitle"), size: 220,
      meta: { filterType: "text" as const } },
    { accessorKey: "docType", header: t("system.document.docType"), size: 120,
      meta: { filterType: "multi" as const },
      cell: ({ getValue }) => <ComCodeBadge groupCode="DOC_TYPE" code={getValue() as string} /> },
    { accessorKey: "category", header: t("system.document.category"), size: 120,
      meta: { filterType: "text" as const } },
    { accessorKey: "revisionNo", header: t("system.document.revisionNo"), size: 80,
      meta: { filterType: "number" as const },
      cell: ({ getValue }) => <span className="font-mono text-center block">Rev.{getValue() as number}</span> },
    { accessorKey: "revisionDate", header: t("system.document.revisionDate"), size: 110,
      meta: { filterType: "date" as const },
      cell: ({ getValue }) => (getValue() as string)?.slice(0, 10) },
    { accessorKey: "status", header: t("common.status"), size: 110,
      meta: { filterType: "multi" as const },
      cell: ({ getValue }) => <ComCodeBadge groupCode="DOC_STATUS" code={getValue() as string} /> },
    { accessorKey: "approvedBy", header: t("system.document.approvedBy"), size: 100,
      meta: { filterType: "text" as const } },
    { accessorKey: "expiresAt", header: t("system.document.expiresAt"), size: 110,
      meta: { filterType: "date" as const },
      cell: ({ row }) => {
        const v = row.original.expiresAt;
        if (!v) return "-";
        const soon = isExpiringSoon(v);
        return (
          <span className={soon ? "text-amber-600 dark:text-amber-400 font-medium" : ""}>
            {soon && <AlertTriangle className="w-3 h-3 inline mr-1" />}
            {v.slice(0, 10)}
          </span>
        );
      },
    },
  ], [t]);

  return (
    <div className="flex h-full">
      {/* 메인 영역 */}
      <div className="flex-1 flex flex-col overflow-hidden p-6 gap-4 animate-fade-in">
        {/* 헤더 */}
        <div className="flex justify-between items-center flex-shrink-0">
          <div>
            <h1 className="text-xl font-bold text-text flex items-center gap-2">
              <FileText className="w-7 h-7 text-primary" />
              {t("system.document.title")}
            </h1>
            <p className="text-text-muted mt-1">{t("system.document.subtitle")}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={fetchData}>
              <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} />
              {t("common.refresh")}
            </Button>
            <Button size="sm" onClick={handleCreate}>
              <Plus className="w-4 h-4 mr-1" />{t("common.add")}
            </Button>
          </div>
        </div>

        {/* 통계 카드 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 flex-shrink-0">
          <StatCard label={t("common.total")} value={stats.total} icon={Files} color="blue" />
          <StatCard label={t("system.document.statusDraft")} value={stats.draft} icon={Clock} color="yellow" />
          <StatCard label={t("system.document.statusApproved")} value={stats.approved} icon={CheckCircle} color="green" />
          <StatCard label={t("system.document.expiringSoon")} value={stats.expiring} icon={AlertTriangle} color="orange" />
        </div>

        {/* DataGrid */}
        <Card className="flex-1 min-h-0 overflow-hidden" padding="none">
          <CardContent className="h-full p-4">
            <DataGrid
              data={data}
              columns={columns}
              isLoading={loading}
              enableColumnFilter
              enableExport
              exportFileName={t("system.document.title")}
              getRowId={row => (row as Document).docNo}
              selectedRowId={selectedRow ? String(selectedRow.docNo) : undefined}
              rowClassName={row => {
                const doc = row as Document;
                return isExpiringSoon(doc.expiresAt)
                  ? "bg-amber-50/50 dark:bg-amber-900/10"
                  : "";
              }}
              toolbarLeft={
                <div className="flex gap-3 items-center flex-1 min-w-0 flex-wrap">
                  <div className="flex-1 min-w-[180px]">
                    <Input
                      placeholder={t("system.document.searchPlaceholder")}
                      value={searchText}
                      onChange={e => setSearchText(e.target.value)}
                      leftIcon={<SearchIcon className="w-4 h-4" />}
                      fullWidth
                    />
                  </div>
                  <ComCodeSelect
                    groupCode="DOC_TYPE"
                    value={typeFilter}
                    onChange={setTypeFilter}
                    labelPrefix={t("system.document.docType")}
                  />
                  <ComCodeSelect
                    groupCode="DOC_STATUS"
                    value={statusFilter}
                    onChange={setStatusFilter}
                    labelPrefix={t("common.status")}
                  />
                </div>
              }
            />
          </CardContent>
        </Card>
      </div>

      {/* 우측 패널: 등록/수정 */}
      {isPanelOpen && (
        <DocumentFormPanel
          editData={editTarget}
          onClose={handlePanelClose}
          onSave={handleSaved}
        />
      )}
    </div>
  );
}
