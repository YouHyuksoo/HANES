"use client";

/**
 * @file src/app/(authenticated)/consumables/master/page.tsx
 * @description 소모품 마스터 관리 페이지 — DB API 연동
 *
 * 초보자 가이드:
 * 1. **목록 조회**: GET /consumables (페이지네이션, 검색, 카테고리 필터)
 * 2. **등록/수정**: 우측 슬라이드 패널(ConsumableFormPanel)에서 처리
 * 3. **삭제**: DELETE /consumables/:consumableCode (소프트 삭제)
 */
import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import {
  Plus, RefreshCw, Search, Wrench,
} from "lucide-react";
import { Card, CardContent, Button, Input, ConfirmModal } from "@/components/ui";
import { ComCodeSelect } from "@/components/shared";
import DataGrid from "@/components/data-grid/DataGrid";
import api from "@/services/api";
import ConsumableFormPanel, {
  type ConsumableItem,
  type ConsumableFormValues,
} from "./components/ConsumableFormPanel";
import ConsumableUsageMapPanel from "./components/ConsumableUsageMapPanel";
import { createConsumableMasterGridColumns } from "./consumableMasterColumns";

function ConsumableMasterPage() {
  const { t } = useTranslation();
  const [data, setData] = useState<ConsumableItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [editing, setEditing] = useState<ConsumableItem | null>(null);
  const [selected, setSelected] = useState<ConsumableItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const panelAnimateRef = useRef(true);

  /* 목록 조회 */
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { limit: 100, useYn: "Y" };
      if (categoryFilter) params.category = categoryFilter;
      if (searchTerm) params.search = searchTerm;

      const res = await api.get("/consumables", { params });
      if (res.data.success) {
        const rows = res.data.data || [];
        setData(rows);
        // 사용매핑 패널은 기본 감춤 — 매핑 아이콘으로 연 행만 유지한다.
        setSelected((current) => {
          if (!current) return null;
          return rows.find((row: ConsumableItem) => row.consumableCode === current.consumableCode) ?? null;
        });
      }
    } catch {
      /* 에러는 api 인터셉터에서 처리 */
    } finally {
      setLoading(false);
    }
  }, [categoryFilter, searchTerm]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  /* 등록/수정 */
  const handleSubmit = async (form: ConsumableFormValues) => {
    setSaving(true);
    try {
      if (editing) {
        await api.put(`/consumables/${editing.consumableCode}`, form);
      } else {
        await api.post("/consumables", form);
      }
      setIsPanelOpen(false);
      setEditing(null);
      fetchData();
    } catch {
      /* 에러는 인터셉터 처리 */
    } finally {
      setSaving(false);
    }
  };

  /* 삭제 */
  const handleDelete = (id: string) => {
    setDeleteTarget(id);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    try {
      await api.delete(`/consumables/${deleteTarget}`);
      fetchData();
    } catch {
      /* ignore */
    } finally {
      setDeleteTarget(null);
    }
  };

  /* 패널 닫기 */
  const handlePanelClose = useCallback(() => {
    setIsPanelOpen(false);
    setEditing(null);
    panelAnimateRef.current = true;
  }, []);

  /* 컬럼 정의 */
  const columns = useMemo(
    () => createConsumableMasterGridColumns({
      t,
      onEdit: (item) => {
        panelAnimateRef.current = !isPanelOpen;
        setSelected(null);
        setEditing(item);
        setIsPanelOpen(true);
      },
      onUsageMap: (item) => {
        handlePanelClose();
        setSelected(item);
      },
      onDelete: handleDelete,
    }),
    [t, isPanelOpen, handlePanelClose],
  );

  return (
    <div className="flex h-full animate-fade-in">
      {/* 좌측: 메인 콘텐츠 */}
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden p-6 gap-4">
        <div className="flex justify-between items-center flex-shrink-0">
          <div>
            <h1 className="text-xl font-bold text-text flex items-center gap-2">
              <Wrench className="w-7 h-7 text-primary" />
              {t("consumables.master.title")}
            </h1>
            <p className="text-text-muted mt-1">{t("consumables.master.description")}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={fetchData}>
              <RefreshCw className="w-4 h-4 mr-1" /> {t("common.refresh")}
            </Button>
            <Button size="sm" onClick={() => { panelAnimateRef.current = !isPanelOpen; setSelected(null); setEditing(null); setIsPanelOpen(true); }}>
              <Plus className="w-4 h-4 mr-1" /> {t("consumables.master.register")}
            </Button>
          </div>
        </div>

        <Card className="flex-1 min-h-0 overflow-hidden" padding="none">
          <CardContent className="h-full p-4">
            <DataGrid
              data={data}
              columns={columns}
              isLoading={loading}
              enableColumnFilter
              enableExport
              exportFileName={t("consumables.master.title")}
              toolbarLeft={
                <div className="flex gap-2 items-center">
                  <Input placeholder={t("consumables.master.searchPlaceholder")}
                    value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                    leftIcon={<Search className="w-4 h-4" />} />
                  <ComCodeSelect groupCode="CONSUMABLE_CATEGORY" value={categoryFilter} onChange={setCategoryFilter} labelPrefix={t("consumables.life.categoryLabel", "분류")} />
                </div>
              }
            
            sqlQuery={`SELECT *\nFROM CONSUMABLES\nWHERE COMPANY = '40'\n  AND PLANT_CD = '1000'\nORDER BY CREATED_AT DESC`}/>
          </CardContent>
        </Card>
      </div>

      {/* 우측: 소모품 등록/수정 슬라이드 패널 */}
      {isPanelOpen && (
        <ConsumableFormPanel
          key={editing?.consumableCode ?? "__new__"}
          item={editing}
          onClose={handlePanelClose}
          onSubmit={handleSubmit}
          loading={saving}
          animate={panelAnimateRef.current}
        />
      )}

      {selected && (
        <ConsumableUsageMapPanel item={selected} onClose={() => setSelected(null)} />
      )}

      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        title={t("common.delete")}
        message={t("common.confirmDelete", "삭제하시겠습니까?")}
      />
    </div>
  );
}

export default ConsumableMasterPage;
