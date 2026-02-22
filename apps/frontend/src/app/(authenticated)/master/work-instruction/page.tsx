"use client";

/**
 * @file src/app/(authenticated)/master/work-instruction/page.tsx
 * @description 작업지도서 관리 페이지 - 품목/공정별 작업 지침 CRUD + 미리보기
 *
 * 초보자 가이드:
 * 1. **작업지도서 목록**: 품목/공정별 지침 DataGrid 표시
 * 2. **행 클릭 → 미리보기**: 우측 패널에 작업지도서 내용/첨부 미리보기
 * 3. **편집 버튼 → 수정 패널**: 미리보기에서 수정 버튼 또는 그리드 편집 아이콘 클릭
 * 4. **추가 버튼 → 등록 패널**: 우측 패널에서 새 작업지도서 등록
 */
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Plus, Edit2, Search, RefreshCw, FileText, Eye } from "lucide-react";
import { Card, CardContent, Button, Input } from "@/components/ui";
import DataGrid from "@/components/data-grid/DataGrid";
import { ColumnDef } from "@tanstack/react-table";
import api from "@/services/api";
import WorkInstructionFormPanel, { type WorkInstruction } from "./components/WorkInstructionFormPanel";
import WorkInstructionPreviewPanel from "./components/WorkInstructionPreviewPanel";

type PanelMode = "none" | "preview" | "edit";

export default function WorkInstructionPage() {
  const { t } = useTranslation();
  const [data, setData] = useState<WorkInstruction[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState("");

  const [panelMode, setPanelMode] = useState<PanelMode>("none");
  const [selectedItem, setSelectedItem] = useState<WorkInstruction | null>(null);
  const [editingItem, setEditingItem] = useState<WorkInstruction | null>(null);
  const panelAnimateRef = useRef(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { limit: "5000" };
      if (searchText) params.search = searchText;
      const res = await api.get("/master/work-instructions", { params });
      setData(res.data?.data ?? []);
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [searchText]);

  useEffect(() => { fetchData(); }, [fetchData]);

  /** 패널 닫기 */
  const handlePanelClose = useCallback(() => {
    setPanelMode("none");
    setSelectedItem(null);
    setEditingItem(null);
    panelAnimateRef.current = true;
  }, []);

  /** 편집 패널 저장 후 */
  const handlePanelSave = useCallback(() => {
    fetchData();
  }, [fetchData]);

  /** 미리보기 → 편집 전환 */
  const handleSwitchToEdit = useCallback((item: WorkInstruction) => {
    panelAnimateRef.current = false;
    setEditingItem(item);
    setPanelMode("edit");
  }, []);

  /** 행 클릭: 미리보기 열기 (편집 모드면 편집 항목 전환) */
  const handleRowClick = useCallback((row: WorkInstruction) => {
    if (panelMode === "edit") {
      setEditingItem(row);
    } else {
      panelAnimateRef.current = panelMode === "none";
      setSelectedItem(row);
      setPanelMode("preview");
    }
  }, [panelMode]);

  /** 편집 아이콘 클릭 */
  const handleEditClick = useCallback((row: WorkInstruction) => {
    panelAnimateRef.current = panelMode === "none";
    setEditingItem(row);
    setPanelMode("edit");
  }, [panelMode]);

  /** 추가 버튼 클릭 */
  const handleAddClick = useCallback(() => {
    panelAnimateRef.current = panelMode === "none";
    setEditingItem(null);
    setPanelMode("edit");
  }, [panelMode]);

  const columns = useMemo<ColumnDef<WorkInstruction>[]>(() => [
    {
      id: "actions", header: t("common.actions"), size: 60,
      meta: { align: "center" as const },
      cell: ({ row }) => (
        <button onClick={(e) => { e.stopPropagation(); handleEditClick(row.original); }} className="p-1 hover:bg-surface rounded">
          <Edit2 className="w-4 h-4 text-primary" />
        </button>
      ),
    },
    { accessorKey: "partCode", header: t("common.partCode"), size: 100, meta: { filterType: "text" as const } },
    { accessorKey: "partName", header: t("common.partName"), size: 140, meta: { filterType: "text" as const } },
    { accessorKey: "processCode", header: t("master.workInstruction.processCode"), size: 90, cell: ({ getValue }) => getValue() || "-" },
    { accessorKey: "title", header: t("master.workInstruction.docTitle"), size: 220, meta: { filterType: "text" as const } },
    {
      accessorKey: "revision", header: "Rev", size: 60,
      cell: ({ getValue }) => <span className="px-2 py-0.5 text-xs rounded bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">{getValue() as string}</span>,
    },
    { accessorKey: "updatedAt", header: t("master.workInstruction.updatedAt"), size: 100 },
    {
      accessorKey: "useYn", header: t("master.workInstruction.use"), size: 60,
      cell: ({ getValue }) => <span className={`w-2 h-2 rounded-full inline-block ${getValue() === "Y" ? "bg-green-500" : "bg-gray-400"}`} />,
    },
  ], [t, handleEditClick]);

  return (
    <div className="flex h-[calc(100vh-theme(spacing.16))] animate-fade-in">
      <div className="flex-1 min-w-0 overflow-auto p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold text-text flex items-center gap-2">
              <FileText className="w-7 h-7 text-primary" />{t("master.workInstruction.title")}
            </h1>
            <p className="text-text-muted mt-1">{t("master.workInstruction.subtitle")}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={fetchData}>
              <RefreshCw className="w-4 h-4 mr-1" />{t('common.refresh')}
            </Button>
            <Button size="sm" onClick={handleAddClick}>
              <Plus className="w-4 h-4 mr-1" />{t("master.workInstruction.addDoc")}
            </Button>
          </div>
        </div>

        <Card><CardContent>
          <DataGrid
            data={data}
            columns={columns}
            isLoading={loading}
            enableColumnPinning
            enableColumnFilter
            enableExport
            exportFileName={t("master.workInstruction.title")}
            onRowClick={handleRowClick}
            toolbarLeft={
              <div className="flex gap-3 flex-1 min-w-0">
                <div className="flex-1 min-w-0">
                  <Input placeholder={t("master.workInstruction.searchPlaceholder")} value={searchText}
                    onChange={(e) => setSearchText(e.target.value)} leftIcon={<Search className="w-4 h-4" />} fullWidth />
                </div>
              </div>
            }
          />
        </CardContent></Card>
      </div>

      {panelMode === "preview" && selectedItem && (
        <WorkInstructionPreviewPanel
          item={selectedItem}
          onClose={handlePanelClose}
          onEdit={handleSwitchToEdit}
          animate={panelAnimateRef.current}
        />
      )}

      {panelMode === "edit" && (
        <WorkInstructionFormPanel
          editingItem={editingItem}
          onClose={handlePanelClose}
          onSave={handlePanelSave}
          animate={panelAnimateRef.current}
        />
      )}
    </div>
  );
}
