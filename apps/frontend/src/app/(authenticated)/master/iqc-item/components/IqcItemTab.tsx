"use client";

/**
 * @file components/IqcItemTab.tsx
 * @description IQC 검사항목 풀 관리 탭 - 우측 패널 CRUD
 */

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Plus, Edit2, Trash2, Search, RefreshCw, ClipboardCheck } from "lucide-react";
import { Card, CardContent, Button, Input, Select, ConfirmModal } from "@/components/ui";
import DataGrid from "@/components/data-grid/DataGrid";
import { ColumnDef } from "@tanstack/react-table";
import { JUDGE_METHOD_COLORS } from "../types";
import IqcItemFormPanel, { type IqcItemFormState, type IqcItemPool } from "./IqcItemFormPanel";
import api from "@/services/api";

export default function IqcItemTab() {
  const { t } = useTranslation();
  const [data, setData] = useState<IqcItemPool[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [methodFilter, setMethodFilter] = useState("");
  const [panelOpen, setPanelOpen] = useState(false);
  const [editing, setEditing] = useState<IqcItemPool | null>(null);
  const [panelKey, setPanelKey] = useState(0);
  const [confirmModal, setConfirmModal] = useState<{ open: boolean; itemCode: string }>({ open: false, itemCode: "" });
  const panelAnimateRef = useRef(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (methodFilter) params.judgeMethod = methodFilter;
      const res = await api.get("/master/iqc-item-pool", { params });
      setData(res.data?.data ?? []);
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [methodFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const methodOptions = useMemo(() => [
    { value: "", label: t("master.iqcItem.judgeMethod", "판정방법") },
    { value: "VISUAL", label: t("master.iqcItem.visual", "육안") },
    { value: "MEASURE", label: t("master.iqcItem.measureMethod", "계측") },
  ], [t]);

  const judgeOptions = useMemo(() => [
    { value: "VISUAL", label: t("master.iqcItem.visual", "육안") },
    { value: "MEASURE", label: t("master.iqcItem.measureMethod", "계측") },
  ], [t]);

  const methodLabels = useMemo<Record<string, string>>(() => ({
    VISUAL: t("master.iqcItem.visual", "육안"),
    MEASURE: t("master.iqcItem.measureMethod", "계측"),
  }), [t]);

  const filtered = useMemo(() => {
    if (!searchText) return data;
    const s = searchText.toLowerCase();
    return data.filter(item =>
      item.inspItemCode.toLowerCase().includes(s) ||
      item.inspItemName.toLowerCase().includes(s)
    );
  }, [data, searchText]);

  const closePanel = useCallback(() => {
    setPanelOpen(false);
    setEditing(null);
    panelAnimateRef.current = true;
  }, []);

  const openCreate = useCallback(() => {
    panelAnimateRef.current = !panelOpen;
    setEditing(null);
    setPanelKey(k => k + 1);
    setPanelOpen(true);
  }, [panelOpen]);

  const openEdit = useCallback((item: IqcItemPool) => {
    panelAnimateRef.current = !panelOpen;
    setEditing(item);
    setPanelKey(k => k + 1);
    setPanelOpen(true);
  }, [panelOpen]);

  const handleSave = useCallback(async (form: IqcItemFormState) => {
    if (!form.itemCode || !form.itemName) return;
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        inspItemCode: form.itemCode,
        inspItemName: form.itemName,
        judgeMethod: form.judgeMethod,
        unit: form.unit || undefined,
      };

      if (editing) {
        await api.put(`/master/iqc-item-pool/${editing.inspItemCode}`, payload);
      } else {
        await api.post("/master/iqc-item-pool", payload);
      }
      closePanel();
      fetchData();
    } catch (e) {
      console.error("Save failed:", e);
    } finally {
      setSaving(false);
    }
  }, [editing, fetchData, closePanel]);

  const handleDelete = useCallback(async () => {
    try {
      await api.delete(`/master/iqc-item-pool/${confirmModal.itemCode}`);
      setConfirmModal({ open: false, itemCode: "" });
      fetchData();
    } catch (e) {
      console.error("Delete failed:", e);
    }
  }, [confirmModal.itemCode, fetchData]);

  const columns = useMemo<ColumnDef<IqcItemPool>[]>(() => [
    {
      id: "actions", header: "", size: 70,
      meta: { align: "center" as const, filterType: "none" as const },
      cell: ({ row }) => (
        <div className="flex gap-1">
          <button onClick={(e) => { e.stopPropagation(); openEdit(row.original); }} className="p-1 hover:bg-surface rounded">
            <Edit2 className="w-4 h-4 text-primary" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setConfirmModal({ open: true, itemCode: row.original.inspItemCode });
            }}
            className="p-1 hover:bg-surface rounded"
          >
            <Trash2 className="w-4 h-4 text-red-500" />
          </button>
        </div>
      ),
    },
    { accessorKey: "inspItemCode", header: t("master.iqcItem.itemCode", "항목코드"), size: 120, meta: { filterType: "text" as const } },
    { accessorKey: "inspItemName", header: t("master.iqcItem.inspectItem"), size: 200, meta: { filterType: "text" as const } },
    {
      accessorKey: "judgeMethod", header: t("master.iqcItem.judgeMethod", "판정방법"), size: 100,
      meta: { filterType: "multi" as const },
      cell: ({ getValue }) => {
        const v = getValue() as string;
        return <span className={`px-2 py-0.5 text-xs rounded-full ${JUDGE_METHOD_COLORS[v]}`}>{methodLabels[v]}</span>;
      },
    },
    { accessorKey: "unit", header: t("common.unit", "단위"), size: 80, meta: { filterType: "text" as const } },
  ], [t, methodLabels, openEdit]);

  return (
    <div className="flex h-full">
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden p-6 gap-4">
        {/* 헤더: 타이틀(좌) + 액션 버튼(우) — 품목마스터 표준 */}
        <div className="flex justify-between items-center flex-shrink-0">
          <div>
            <h1 className="text-xl font-bold text-text flex items-center gap-2">
              <ClipboardCheck className="w-7 h-7 text-primary" />
              {t("master.iqcItem.itemPool", "검사항목마스터")}
            </h1>
            <p className="text-text-muted mt-1">
              {t("master.iqcItem.itemPoolSubtitle", "IQC 검사에 사용할 전역 검사항목을 등록하고 관리합니다.")} ({data.length}건)
            </p>
          </div>
          <div className="flex gap-2 items-center">
            <Button variant="secondary" size="sm" onClick={fetchData}>
              <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} />{t("common.refresh")}
            </Button>
            <Button size="sm" onClick={openCreate}>
              <Plus className="w-4 h-4 mr-1" />{t("master.iqcItem.addItem")}
            </Button>
          </div>
        </div>

        <Card className="flex-1 min-h-0 overflow-hidden" padding="none">
          <CardContent className="h-full p-4">
            <DataGrid
              data={filtered}
              columns={columns}
              isLoading={loading}
              enableColumnFilter
              enableExport
              exportFileName={t("master.iqcItem.tabItems", "검사항목")}
              onRowClick={(row) => {
                if (!panelOpen || !editing) return;
                setEditing(row as IqcItemPool);
                setPanelKey(k => k + 1);
              }}
              toolbarLeft={
                <div className="flex gap-3 flex-1 min-w-0">
                  <div className="flex-1 min-w-0">
                    <Input
                      placeholder={t("master.iqcItem.searchPlaceholder")}
                      value={searchText}
                      onChange={e => setSearchText(e.target.value)}
                      leftIcon={<Search className="w-4 h-4" />}
                      fullWidth
                    />
                  </div>
                  <div className="w-36 flex-shrink-0">
                    <Select options={methodOptions} value={methodFilter} onChange={setMethodFilter} fullWidth />
                  </div>
                </div>
              }

            sqlQuery={`SELECT *\nFROM IQC_ITEM_POOL\nWHERE COMPANY = '40'\n  AND PLANT_CD = '1000'\nORDER BY CREATED_AT DESC`}/>
          </CardContent>
        </Card>
      </div>

      {panelOpen && (
        <IqcItemFormPanel
          key={`${editing?.inspItemCode ?? "create"}-${panelKey}`}
          editing={editing}
          saving={saving}
          judgeOptions={judgeOptions}
          onClose={closePanel}
          onSave={handleSave}
          animate={panelAnimateRef.current}
        />
      )}

      <ConfirmModal
        isOpen={confirmModal.open}
        onClose={() => setConfirmModal({ open: false, itemCode: "" })}
        onConfirm={handleDelete}
        title={t("master.iqcItem.deleteItem", "검사항목 삭제")}
        message={t("master.iqcItem.deleteConfirm", "이 검사항목을 삭제하시겠습니까?")}
        variant="danger"
      />
    </div>
  );
}
