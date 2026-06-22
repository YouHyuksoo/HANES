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
import { Plus, Edit2, Trash2, Search, RefreshCw, FileText, Eye } from "lucide-react";
import { Card, CardContent, Button, Input, ConfirmModal } from "@/components/ui";
import DataGrid from "@/components/data-grid/DataGrid";
import { ColumnDef } from "@tanstack/react-table";
import api from "@/services/api";
import WorkInstructionFormPanel, { getWorkInstructionKey, type WorkInstruction } from "./components/WorkInstructionFormPanel";
import WorkInstructionPreviewPanel from "./components/WorkInstructionPreviewPanel";
import { usePageAiTools } from "@/ai-page-tools/usePageAiTools";

type PanelMode = "none" | "preview" | "edit";

export default function WorkInstructionPage() {
  usePageAiTools("master.work-instruction");
  const { t } = useTranslation();
  const [data, setData] = useState<WorkInstruction[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState("");

  const [panelMode, setPanelMode] = useState<PanelMode>("none");
  const [selectedItem, setSelectedItem] = useState<WorkInstruction | null>(null);
  const [editingItem, setEditingItem] = useState<WorkInstruction | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<WorkInstruction | null>(null);
  const [deleting, setDeleting] = useState(false);
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

  /** 삭제 확인 실행 */
  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/master/work-instructions/${encodeURIComponent(getWorkInstructionKey(deleteTarget))}`);
      setDeleteTarget(null);
      handlePanelClose();
      fetchData();
    } catch {
      // 에러는 api 인터셉터에서 처리
    } finally {
      setDeleting(false);
    }
  }, [deleteTarget, fetchData, handlePanelClose]);

  const columns = useMemo<ColumnDef<WorkInstruction>[]>(() => [
    {
      id: "actions", header: t("common.actions"), size: 84,
      meta: { align: "center" as const },
      cell: ({ row }) => (
        <div className="flex items-center justify-center gap-1">
          <button onClick={(e) => { e.stopPropagation(); handleEditClick(row.original); }} className="p-1 hover:bg-surface rounded">
            <Edit2 className="w-4 h-4 text-primary" />
          </button>
          <button onClick={(e) => { e.stopPropagation(); setDeleteTarget(row.original); }} className="p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded">
            <Trash2 className="w-4 h-4 text-red-500" />
          </button>
        </div>
      ),
    },
    { accessorKey: "itemCode", header: t("common.partCode"), size: 100, meta: { filterType: "text" as const } },
    { accessorKey: "itemName", header: t("common.partName"), size: 140, meta: { filterType: "text" as const } },
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
    <div className="flex h-full animate-fade-in">
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden p-6 gap-4">
        <div className="flex justify-between items-center flex-shrink-0">
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

        <Card className="flex-1 min-h-0 overflow-hidden" padding="none"><CardContent className="h-full p-4">
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
          
          sqlQuery={`SELECT *\nFROM WORK_INSTRUCTIONS\nWHERE COMPANY = '40'\n  AND PLANT_CD = '1000'\nORDER BY CREATED_AT DESC`}/>
        </CardContent></Card>
      </div>

      {panelMode === "preview" && selectedItem && (
        <WorkInstructionPreviewPanel
          item={selectedItem}
          onClose={handlePanelClose}
          onEdit={handleSwitchToEdit}
          onDelete={setDeleteTarget}
          animate={panelAnimateRef.current}
        />
      )}

      {panelMode === "edit" && (
        <WorkInstructionFormPanel
          key={editingItem ? getWorkInstructionKey(editingItem) : "__new__"}
          editingItem={editingItem}
          onClose={handlePanelClose}
          onSave={handlePanelSave}
          animate={panelAnimateRef.current}
        />
      )}

      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        title={t("master.workInstruction.deleteTitle", "작업지도서 삭제")}
        message={t("master.workInstruction.deleteConfirm", "이 작업지도서를 삭제하시겠습니까? 삭제 후에는 복구할 수 없습니다.")}
        confirmText={t("common.delete")}
        variant="danger"
        isLoading={deleting}
      />
    </div>
  );
}
