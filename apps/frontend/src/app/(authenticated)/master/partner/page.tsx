"use client";

/**
 * @file src/app/(authenticated)/master/partner/page.tsx
 * @description 거래처 마스터 관리 페이지 - DB API 연동
 *
 * 초보자 가이드:
 * 1. **거래처 유형**: SUPPLIER(공급상) / CUSTOMER(고객)
 * 2. **검색/필터**: 유형별 필터 + 텍스트 검색 (API 서버측 처리)
 * 3. **CRUD**: 추가/수정은 우측 슬라이드 패널, 삭제는 소프트삭제
 */
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Plus, Search, RefreshCw, Building2 } from "lucide-react";
import { Card, CardContent, Button, Input, ConfirmModal } from "@/components/ui";
import { ComCodeSelect, UseYnSelect } from "@/components/shared";
import DataGrid from "@/components/data-grid/DataGrid";
import api from "@/services/api";
import { usePageAiTools } from "@/ai-page-tools/usePageAiTools";
import { useUnsavedGuard } from "@/hooks/useUnsavedGuard";
import PartnerFormPanel, { type Partner } from "./components/PartnerFormPanel";
import { createPartnerGridColumns } from "./partnerColumns";

type PanelMode = "create" | "edit";

function PartnerPage() {
  usePageAiTools("master.partner");
  const { t } = useTranslation();
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [useYnFilter, setUseYnFilter] = useState("");

  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [editingPartner, setEditingPartner] = useState<Partner | null>(null);
  const [panelMode, setPanelMode] = useState<PanelMode>("create");
  const [deleteTarget, setDeleteTarget] = useState<Partner | null>(null);
  const panelAnimateRef = useRef(true);
  const { markDirty, guard, guardModalProps } = useUnsavedGuard();

  /** API에서 거래처 목록 조회 */
  const fetchPartners = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { limit: "5000" };
      if (searchText) params.search = searchText;
      if (typeFilter) params.partnerType = typeFilter;
      if (useYnFilter) params.useYn = useYnFilter;
      const res = await api.get("/master/partners", { params });
      if (res.data.success) setPartners(res.data.data || []);
    } catch {
      setPartners([]);
    } finally {
      setLoading(false);
    }
  }, [searchText, typeFilter, useYnFilter]);

  useEffect(() => { fetchPartners(); }, [fetchPartners]);

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteTarget) return;
    try {
      await api.delete(`/master/partners/${deleteTarget.partnerCode}`);
      fetchPartners();
    } catch (e: any) {
      console.error("Delete failed:", e);
    } finally {
      setDeleteTarget(null);
    }
  }, [deleteTarget, fetchPartners]);

  const handlePanelClose = useCallback(() => {
    guard(() => {
      setIsPanelOpen(false);
      setEditingPartner(null);
      setPanelMode("create");
      panelAnimateRef.current = true;
    });
  }, [guard]);

  const handlePanelSave = useCallback(() => {
    fetchPartners();
  }, [fetchPartners]);

  const openCreatePanel = useCallback(() => {
    guard(() => {
      panelAnimateRef.current = !isPanelOpen;
      setEditingPartner(null);
      setPanelMode("create");
      setIsPanelOpen(true);
    });
  }, [isPanelOpen, guard]);

  const openEditPanel = useCallback((partner: Partner) => {
    guard(() => {
      panelAnimateRef.current = !isPanelOpen;
      setEditingPartner(partner);
      setPanelMode("edit");
      setIsPanelOpen(true);
    });
  }, [isPanelOpen, guard]);

  const handleRowClick = useCallback((partner: Partner) => {
    if (!isPanelOpen || panelMode !== "edit") return;
    guard(() => setEditingPartner(partner));
  }, [isPanelOpen, panelMode, guard]);

  const columns = useMemo(() => createPartnerGridColumns({
    t,
    onEditPartner: openEditPanel,
    onDeletePartner: setDeleteTarget,
  }), [t, openEditPanel]);

  return (
    <div className="flex h-full animate-fade-in">
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden p-6 gap-4">
        <div className="flex justify-between items-center flex-shrink-0">
          <div>
            <h1 className="text-xl font-bold text-text flex items-center gap-2">
              <Building2 className="w-7 h-7 text-primary" />{t("master.partner.title")}
            </h1>
            <p className="text-text-muted mt-1">{t("master.partner.subtitle")} ({partners.length}{t("common.count", "건")})</p>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={fetchPartners}>
              <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} />{t("common.refresh")}
            </Button>
            <Button size="sm" onClick={openCreatePanel}>
              <Plus className="w-4 h-4 mr-1" />{t("master.partner.addPartner")}
            </Button>
          </div>
        </div>

        <Card className="flex-1 min-h-0 overflow-hidden" padding="none"><CardContent className="h-full p-4">
          <DataGrid
            data={partners}
            columns={columns}
            isLoading={loading}
            enableColumnPinning
            enableColumnFilter
            enableExport
            exportFileName={t("master.partner.title")}
            onRowClick={handleRowClick}
            rowClassName={(row) => row.useYn === "N" ? "!text-red-500 dark:!text-red-400" : ""}
            toolbarLeft={
              <div className="flex gap-2 items-center flex-1 min-w-0">
                <div className="flex-1 min-w-0">
                  <Input placeholder={t("master.partner.searchPlaceholder")} value={searchText}
                    onChange={(e) => setSearchText(e.target.value)} leftIcon={<Search className="w-4 h-4" />} fullWidth />
                </div>
                <div className="w-40 flex-shrink-0">
                  <ComCodeSelect groupCode="PARTNER_TYPE" value={typeFilter} onChange={setTypeFilter}
                    labelPrefix={t("master.partner.partnerType")} fullWidth />
                </div>
                <div className="w-36 flex-shrink-0">
                  <UseYnSelect value={useYnFilter} onChange={setUseYnFilter} fullWidth />
                </div>
              </div>
            }
          
          sqlQuery={`SELECT *\nFROM PARTNER_MASTERS\nWHERE COMPANY = '40'\n  AND PLANT_CD = '1000'\nORDER BY CREATED_AT DESC`}
          sqlFilters={{ search: searchText, partnerType: typeFilter, useYn: useYnFilter }}/>
        </CardContent></Card>
      </div>

      {isPanelOpen && (
        <PartnerFormPanel
          mode={panelMode}
          editingPartner={editingPartner}
          onClose={handlePanelClose}
          onSave={handlePanelSave}
          animate={panelAnimateRef.current}
          onDirtyChange={markDirty}
        />
      )}

      <ConfirmModal {...guardModalProps} />

      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        variant="danger"
        message={`'${deleteTarget?.partnerName || ""}'${t("common.deleteMessage", "을(를) 삭제하시겠습니까?")}`}
      />
    </div>
  );
}

export default PartnerPage;
