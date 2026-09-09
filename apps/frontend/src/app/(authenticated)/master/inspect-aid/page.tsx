"use client";

/**
 * @file src/app/(authenticated)/master/inspect-aid/page.tsx
 * @description 검사보조구 마스터(한도견본·검사홀더) 페이지 — 레이아웃·상태 배선만 담당
 *
 * 초보자 가이드:
 * 1. 상단 유형 탭(전체/양품견본/불량견본/홀더) + 만료·임박 카운트(서버 /expiring?days=30)
 * 2. 좌: DataGrid(서버 페이징) — 컬럼은 inspectAidColumns.tsx (만료/임박 배지 포함)
 * 3. 우: InspectAidFormPanel — 행 클릭 시 데이터 교체 + useUnsavedGuard, 사진은 저장 후 POST :code/image
 * 4. API: /master/inspect-aids (GET/POST), /:code (PUT/DELETE), /:code/image (POST/DELETE), /expiring
 */
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Plus, RefreshCw, Search, ShieldCheck } from "lucide-react";
import { Card, CardContent, Button, Input, ConfirmModal } from "@/components/ui";
import type { SelectOption } from "@/components/ui";
import DataGrid from "@/components/data-grid/DataGrid";
import { ComCodeSelect, UseYnSelect } from "@/components/shared";
import ServerPager from "@/components/shared/ServerPager";
import api from "@/services/api";
import { useUnsavedGuard } from "@/hooks/useUnsavedGuard";
import { createInspectAidGridColumns, type InspectAidRow, type InspectAidType } from "./inspectAidColumns";
import InspectAidFormPanel, {
  emptyInspectAidForm,
  validateInspectAidForm,
  type InspectAidForm,
} from "./InspectAidFormPanel";

const PAGE_SIZE = 100;
const EXPIRING_DAYS = 30;
type TypeTab = "" | InspectAidType;

interface DefectCodeOption { defectCode: string; defectName: string }

export default function InspectAidPage() {
  const { t } = useTranslation();
  const [rows, setRows] = useState<InspectAidRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [typeTab, setTypeTab] = useState<TypeTab>("");
  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [useYnFilter, setUseYnFilter] = useState("Y");
  const [expiringSummary, setExpiringSummary] = useState({ expired: 0, expiring: 0 });
  const [defectCodeOptions, setDefectCodeOptions] = useState<SelectOption[]>([]);
  const [panelOpen, setPanelOpen] = useState(false);
  const [editing, setEditing] = useState<InspectAidRow | null>(null);
  const [selectedRow, setSelectedRow] = useState<InspectAidRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<InspectAidRow | null>(null);
  const [form, setForm] = useState<InspectAidForm>(() => emptyInspectAidForm());
  const initialFormRef = useRef<InspectAidForm>(emptyInspectAidForm());
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [imageError, setImageError] = useState(false);
  const [imageDeleteConfirmOpen, setImageDeleteConfirmOpen] = useState(false);
  const { markDirty, guard, guardModalProps } = useUnsavedGuard();

  useEffect(() => { setImageError(false); }, [previewUrl]);
  useEffect(() => () => { if (previewUrl?.startsWith("blob:")) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

  const fetchExpiring = useCallback(async () => {
    try {
      const res = await api.get("/master/inspect-aids/expiring", { params: { days: EXPIRING_DAYS } });
      const list: InspectAidRow[] = res.data?.data ?? [];
      setExpiringSummary({
        expired: list.filter(r => r.expiryState === "EXPIRED").length,
        expiring: list.filter(r => r.expiryState === "EXPIRING").length,
      });
    } catch {
      setExpiringSummary({ expired: 0, expiring: 0 });
    }
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { page: String(page), limit: String(PAGE_SIZE) };
      if (typeTab) params.aidType = typeTab;
      if (searchText.trim()) params.search = searchText.trim();
      if (statusFilter) params.status = statusFilter;
      if (useYnFilter) params.useYn = useYnFilter;
      const res = await api.get("/master/inspect-aids", { params });
      setRows(res.data?.data ?? []);
      setTotal(Number(res.data?.meta?.total ?? 0));
    } catch {
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, typeTab, searchText, statusFilter, useYnFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => { fetchExpiring(); }, [fetchExpiring]);
  useEffect(() => { setPage(1); }, [typeTab, searchText, statusFilter, useYnFilter]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get("/quality/defect-codes/options");
        const list: DefectCodeOption[] = Array.isArray(res.data?.data) ? res.data.data : [];
        if (!cancelled) setDefectCodeOptions(list.map(d => ({ value: d.defectCode, label: `${d.defectCode} - ${d.defectName}` })));
      } catch {
        if (!cancelled) setDefectCodeOptions([]);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const typeTabs = useMemo<Array<{ value: TypeTab; label: string }>>(() => [
    { value: "", label: t("common.all") },
    { value: "LIMIT_OK", label: t("comCode.INSPECT_AID_TYPE.LIMIT_OK") },
    { value: "LIMIT_NG", label: t("comCode.INSPECT_AID_TYPE.LIMIT_NG") },
    { value: "HOLDER", label: t("comCode.INSPECT_AID_TYPE.HOLDER") },
  ], [t]);

  const setField = useCallback((key: keyof InspectAidForm, value: string) => {
    setForm(prev => ({ ...prev, [key]: value }));
  }, []);

  const resetImageState = (nextPreviewUrl: string | null) => {
    if (previewUrl?.startsWith("blob:")) URL.revokeObjectURL(previewUrl);
    setSelectedImageFile(null);
    setPreviewUrl(nextPreviewUrl);
  };

  const openCreate = () => {
    setEditing(null);
    const blank = emptyInspectAidForm();
    if (typeTab) blank.aidType = typeTab;
    setForm(blank);
    initialFormRef.current = blank;
    resetImageState(null);
    setPanelOpen(true);
  };

  const openEdit = (row: InspectAidRow) => {
    setEditing(row);
    setSelectedRow(row);
    const next: InspectAidForm = {
      aidCode: row.aidCode,
      aidType: row.aidType,
      aidName: row.aidName,
      itemCode: row.itemCode ?? "",
      processCode: row.processCode ?? "",
      defectCode: row.defectCode ?? "",
      location: row.location ?? "",
      validFrom: row.validFrom ?? "",
      validTo: row.validTo ?? "",
      approvedBy: row.approvedBy ?? "",
      approvedAt: row.approvedAt?.slice(0, 10) ?? "",
      status: row.status || "ACTIVE",
      remark: row.remark ?? "",
      useYn: row.useYn || "Y",
    };
    setForm(next);
    initialFormRef.current = next;
    resetImageState(row.imageUrl ?? null);
    setPanelOpen(true);
  };

  const closePanel = () => {
    setPanelOpen(false);
    setEditing(null);
    resetImageState(null);
  };

  // 작성 중(저장 안 됨) 여부 — 폼 값 또는 사진 변경 시 dirty
  const dirty = useMemo(
    () => panelOpen && (
      JSON.stringify(form) !== JSON.stringify(initialFormRef.current) ||
      previewUrl !== (editing?.imageUrl ?? null)
    ),
    [panelOpen, form, previewUrl, editing],
  );
  useEffect(() => { markDirty(dirty); }, [dirty, markDirty]);

  const handleImageSelect = (file: File) => {
    if (previewUrl?.startsWith("blob:")) URL.revokeObjectURL(previewUrl);
    setSelectedImageFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const handleImageClear = () => {
    if (previewUrl?.startsWith("blob:")) URL.revokeObjectURL(previewUrl);
    setSelectedImageFile(null);
    setPreviewUrl(null);
    setImageDeleteConfirmOpen(false);
  };

  const uploadImage = async (aidCode: string, file: File) => {
    const formData = new FormData();
    formData.append("image", file);
    await api.post(`/master/inspect-aids/${encodeURIComponent(aidCode)}/image`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  };

  const handleSave = async () => {
    if (!validateInspectAidForm(form)) return;
    setSaving(true);
    const payload = {
      aidCode: form.aidCode.trim(),
      aidType: form.aidType,
      aidName: form.aidName.trim(),
      itemCode: form.itemCode || null,
      processCode: form.processCode || null,
      defectCode: form.aidType === "LIMIT_NG" ? (form.defectCode || null) : null,
      location: form.location.trim() || null,
      validFrom: form.validFrom || null,
      validTo: form.validTo || null,
      approvedBy: form.approvedBy.trim() || null,
      approvedAt: form.approvedAt || null,
      status: form.status,
      remark: form.remark.trim() || null,
      useYn: form.useYn,
    };
    try {
      const aidCode = editing?.aidCode ?? payload.aidCode;
      if (editing) {
        await api.put(`/master/inspect-aids/${encodeURIComponent(editing.aidCode)}`, payload);
        if (selectedImageFile) {
          await uploadImage(editing.aidCode, selectedImageFile);
        } else if (!previewUrl && editing.imageUrl) {
          await api.delete(`/master/inspect-aids/${encodeURIComponent(editing.aidCode)}/image`);
        }
      } else {
        await api.post("/master/inspect-aids", payload);
        if (selectedImageFile) await uploadImage(aidCode, selectedImageFile);
      }
      await Promise.all([fetchData(), fetchExpiring()]);
      closePanel();
    } catch {
      // 공통 API 레이어에서 오류 토스트 처리
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    try {
      await api.delete(`/master/inspect-aids/${encodeURIComponent(deleteTarget.aidCode)}`);
      if (editing?.aidCode === deleteTarget.aidCode) closePanel();
      await Promise.all([fetchData(), fetchExpiring()]);
    } catch {
      // 공통 API 레이어에서 오류 토스트 처리
    } finally {
      setDeleteTarget(null);
    }
  };

  const columns = useMemo(() => createInspectAidGridColumns({
    t,
    onEditAid: (row) => guard(() => openEdit(row)),
    onDeleteAid: setDeleteTarget,
  }), [t, guard]);

  return (
    <div className="flex h-full overflow-hidden animate-fade-in">
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden p-6 gap-4">
        <div className="flex justify-between items-center flex-shrink-0">
          <div>
            <h1 className="text-xl font-bold text-text flex items-center gap-2">
              <ShieldCheck className="w-7 h-7 text-primary" />
              {t("master.inspectAid.title")}
            </h1>
            <p className="text-text-muted mt-1">{t("master.inspectAid.subtitle")}</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-xs text-text-muted flex items-center gap-3">
              <span>
                {t("master.inspectAid.expired")}: <span className="font-semibold text-red-600 dark:text-red-400">{expiringSummary.expired}</span>
              </span>
              <span>
                {t("master.inspectAid.expiringWithin", { days: EXPIRING_DAYS })}: <span className="font-semibold text-amber-700 dark:text-amber-300">{expiringSummary.expiring}</span>
              </span>
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" onClick={() => { fetchData(); fetchExpiring(); }}>
                <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} />{t("common.refresh")}
              </Button>
              <Button size="sm" onClick={() => guard(openCreate)}>
                <Plus className="w-4 h-4 mr-1" />{t("common.add")}
              </Button>
            </div>
          </div>
        </div>

        {/* 유형 탭 */}
        <div className="flex gap-1 border-b border-border flex-shrink-0" role="tablist">
          {typeTabs.map(tab => (
            <button key={tab.value || "ALL"} type="button" role="tab" aria-selected={typeTab === tab.value}
              onClick={() => setTypeTab(tab.value)}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                typeTab === tab.value ? "border-primary text-primary" : "border-transparent text-text-muted hover:text-text"
              }`}>
              {tab.label}
            </button>
          ))}
        </div>

        <Card className="flex-1 min-h-0 overflow-hidden" padding="none">
          <CardContent className="h-full p-4">
            <DataGrid data={rows} columns={columns} isLoading={loading} pageSize={PAGE_SIZE}
              enableColumnFilter enableExport
              exportFileName={t("master.inspectAid.title")}
              getRowId={(row) => (row as InspectAidRow).aidCode}
              selectedRowId={selectedRow?.aidCode}
              onRowClick={(row) => {
                const aid = row as InspectAidRow;
                if (panelOpen) guard(() => openEdit(aid));
                else setSelectedRow(aid);
              }}
              toolbarLeft={
                <div className="flex gap-3 items-center flex-1 min-w-0 flex-wrap">
                  <div className="w-64">
                    <Input placeholder={t("master.inspectAid.searchPlaceholder")} value={searchText}
                      onChange={e => setSearchText(e.target.value)} leftIcon={<Search className="w-4 h-4" />} fullWidth />
                  </div>
                  <ComCodeSelect groupCode="INSPECT_AID_STATUS" value={statusFilter} onChange={setStatusFilter}
                    labelPrefix={t("common.status")} />
                  <UseYnSelect value={useYnFilter} onChange={setUseYnFilter} />
                  <ServerPager page={page} total={total} limit={PAGE_SIZE} onPageChange={setPage} disabled={loading} className="flex-shrink-0 ml-auto" />
                </div>
              }
              sqlQuery={`SELECT *\nFROM INSPECT_AIDS\nWHERE COMPANY = '40'\n  AND PLANT_CD = '1000'\nORDER BY AID_TYPE, AID_CODE`} />
          </CardContent>
        </Card>
      </div>

      {panelOpen && (
        <InspectAidFormPanel
          t={t}
          editing={!!editing}
          saving={saving}
          form={form}
          defectCodeOptions={defectCodeOptions}
          previewUrl={previewUrl}
          imageError={imageError}
          onChange={setField}
          onImageSelect={handleImageSelect}
          onImageError={() => setImageError(true)}
          onRequestImageDelete={() => setImageDeleteConfirmOpen(true)}
          onSave={handleSave}
          onCancel={() => guard(closePanel)}
        />
      )}

      <ConfirmModal {...guardModalProps} />

      <ConfirmModal isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDeleteConfirm}
        variant="danger" title={t("common.delete")}
        message={`'${deleteTarget?.aidName ?? ""}'${t("common.deleteConfirm")}`} />
      <ConfirmModal isOpen={imageDeleteConfirmOpen} onClose={() => setImageDeleteConfirmOpen(false)} onConfirm={handleImageClear}
        variant="danger" title={t("common.deleteConfirm", "삭제 확인")}
        message={t("master.inspectAid.imageDeleteConfirm")} />
    </div>
  );
}
