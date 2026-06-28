"use client";

/**
 * @file src/app/(authenticated)/master/equip-inspect-item/page.tsx
 * @description 점검항목 마스터 페이지 - 설비유형별 점검항목 풀(EQUIP_INSPECT_ITEM_POOL) 통합 CRUD
 */
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { ClipboardList, Plus, Trash2, Search, RefreshCw, ImageIcon, Upload } from "lucide-react";
import { Card, CardContent, Button, Input, Select, ConfirmModal } from "@/components/ui";
import { ComCodeSelect, UseYnSelect } from "@/components/shared";
import DataGrid from "@/components/data-grid/DataGrid";
import api from "@/services/api";
import { resolveBackendFileUrl } from "@/utils/file-url";
import { useUnsavedGuard } from "@/hooks/useUnsavedGuard";
import {
  createEquipInspectItemGridColumns,
  type InspectItemPoolRow,
  type InspectType,
  type ItemType,
} from "./equipInspectItemColumns";

interface InspectItemForm {
  itemCode: string;
  equipType: string;
  itemName: string;
  inspectType: InspectType;
  criteria: string;
  cycle: string;
  itemType: ItemType;
  unit: string;
  lslValue: string;
  uslValue: string;
  useYn: string;
  remark: string;
}

const emptyForm = (): InspectItemForm => ({
  itemCode: "",
  equipType: "",
  itemName: "",
  inspectType: "DAILY",
  criteria: "",
  cycle: "DAILY",
  itemType: "VISUAL",
  unit: "",
  lslValue: "",
  uslValue: "",
  useYn: "Y",
  remark: "",
});

const normalizeUnitCode = (unit: string | null | undefined) => {
  if (!unit) return "";
  const trimmed = unit.trim();
  return trimmed.toLowerCase() === "mm" ? "MM" : trimmed;
};

export default function EquipInspectItemPage() {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<InspectItemPoolRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [equipTypeFilter, setEquipTypeFilter] = useState("");
  const [panelOpen, setPanelOpen] = useState(false);
  const [editing, setEditing] = useState<InspectItemPoolRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<InspectItemPoolRow | null>(null);
  const [form, setForm] = useState<InspectItemForm>(() => emptyForm());
  const initialFormRef = useRef<InspectItemForm>(emptyForm());
  const { markDirty, guard, guardModalProps } = useUnsavedGuard();
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [imageError, setImageError] = useState(false);
  const [imageDeleteConfirmOpen, setImageDeleteConfirmOpen] = useState(false);

  // previewUrl 변경 시 이미지 로드 에러 상태 리셋
  useEffect(() => { setImageError(false); }, [previewUrl]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { limit: "5000" };
      if (searchText) params.search = searchText;
      if (typeFilter) params.inspectType = typeFilter;
      if (equipTypeFilter) params.equipType = equipTypeFilter;
      const res = await api.get("/master/equip-inspect-item-masters", { params });
      setItems(res.data?.data ?? []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [searchText, typeFilter, equipTypeFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    return () => {
      if (previewUrl?.startsWith("blob:")) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const typeFilterOptions = useMemo(() => [
    { value: "", label: `${t("master.equipInspect.inspectType")}: ${t("common.all")}` },
    { value: "DAILY", label: `${t("master.equipInspect.inspectType")}: ${t("master.equipInspect.typeDaily")}` },
    { value: "PERIODIC", label: `${t("master.equipInspect.inspectType")}: ${t("master.equipInspect.typePeriodic")}` },
    { value: "PM", label: `${t("master.equipInspect.inspectType")}: ${t("master.equipInspect.typePM")}` },
    { value: "WORKER", label: `${t("master.equipInspect.inspectType")}: ${t("master.equipInspect.typeWorker")}` },
  ], [t]);

  const typeOptions = useMemo(() => [
    { value: "DAILY", label: t("master.equipInspect.typeDaily") },
    { value: "PERIODIC", label: t("master.equipInspect.typePeriodic") },
    { value: "PM", label: t("master.equipInspect.typePM") },
    { value: "WORKER", label: t("master.equipInspect.typeWorker") },
  ], [t]);

  const itemTypeOptions = useMemo(() => [
    { value: "VISUAL", label: t("master.equipInspect.itemTypeVisual", "판정형") },
    { value: "MEASURE", label: t("master.equipInspect.itemTypeMeasure", "측정형") },
  ], [t]);

  const itemTypeLabels = useMemo<Record<string, string>>(() => ({
    VISUAL: t("master.equipInspect.itemTypeVisual", "판정형"),
    MEASURE: t("master.equipInspect.itemTypeMeasure", "측정형"),
  }), [t]);

  const cycleOptions = useMemo(() => [
    { value: "DAILY", label: t("master.equipInspect.cycleDaily") },
    { value: "WEEKLY", label: t("master.equipInspect.cycleWeekly") },
    { value: "MONTHLY", label: t("master.equipInspect.cycleMonthly") },
    { value: "QUARTERLY", label: t("master.equipInspect.cycleQuarterly", "분기") },
    { value: "SEMI_ANNUAL", label: t("master.equipInspect.cycleSemiAnnual", "반기") },
    { value: "ANNUAL", label: t("master.equipInspect.cycleAnnual", "연간") },
  ], [t]);

  const inspectTypeLabels = useMemo<Record<string, string>>(() => ({
    DAILY: t("master.equipInspect.typeDaily"),
    PERIODIC: t("master.equipInspect.typePeriodic"),
    PM: t("master.equipInspect.typePM"),
    WORKER: t("master.equipInspect.typeWorker"),
  }), [t]);

  const cycleLabels = useMemo<Record<string, string>>(() => ({
    DAILY: t("master.equipInspect.cycleDaily"),
    WEEKLY: t("master.equipInspect.cycleWeekly"),
    MONTHLY: t("master.equipInspect.cycleMonthly"),
    QUARTERLY: t("master.equipInspect.cycleQuarterly", "분기"),
    SEMI_ANNUAL: t("master.equipInspect.cycleSemiAnnual", "반기"),
    ANNUAL: t("master.equipInspect.cycleAnnual", "연간"),
  }), [t]);

  const setField = (key: keyof InspectItemForm, value: string) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const resetImageState = (nextPreviewUrl: string | null) => {
    if (previewUrl?.startsWith("blob:")) URL.revokeObjectURL(previewUrl);
    setSelectedImageFile(null);
    setPreviewUrl(nextPreviewUrl);
  };

  const openCreate = () => {
    setEditing(null);
    const blank = emptyForm();
    setForm(blank);
    initialFormRef.current = blank;
    resetImageState(null);
    setPanelOpen(true);
  };

  const openEdit = (item: InspectItemPoolRow) => {
    setEditing(item);
    const nextForm: InspectItemForm = {
      itemCode: item.itemCode,
      equipType: item.equipType || "",
      itemName: item.itemName,
      inspectType: item.inspectType,
      criteria: item.criteria || "",
      cycle: item.cycle || "DAILY",
      itemType: item.itemType || "VISUAL",
      unit: normalizeUnitCode(item.unit),
      lslValue: item.lslValue != null ? String(item.lslValue) : "",
      uslValue: item.uslValue != null ? String(item.uslValue) : "",
      useYn: item.useYn || "Y",
      remark: item.remark || "",
    };
    setForm(nextForm);
    initialFormRef.current = nextForm;
    resetImageState(item.imageUrl || null);
    setPanelOpen(true);
  };

  // 작성 중(저장 안 됨) 여부 계산 후 가드에 보고 — 행 전환 시 유실 방어
  const dirty = useMemo(
    () =>
      panelOpen &&
      (JSON.stringify(form) !== JSON.stringify(initialFormRef.current) ||
        previewUrl !== (editing?.imageUrl ?? null)),
    [panelOpen, form, previewUrl, editing],
  );
  useEffect(() => {
    markDirty(dirty);
  }, [dirty, markDirty]);

  const closePanel = () => {
    setPanelOpen(false);
    setEditing(null);
    setForm(emptyForm());
    resetImageState(null);
  };

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

  const uploadImage = async (itemCode: string, file: File) => {
    const formData = new FormData();
    formData.append("image", file);
    await api.post(`/master/equip-inspect-item-masters/${encodeURIComponent(itemCode)}/image`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  };

  const handleSave = async () => {
    if (!form.itemCode.trim() || !form.itemName.trim() || !form.inspectType || !form.cycle) return;
    setSaving(true);
    const isMeasure = form.itemType === "MEASURE";
    const payload = {
      itemCode: form.itemCode.trim(),
      itemName: form.itemName.trim(),
      inspectType: form.inspectType,
      equipType: form.equipType || null,
      criteria: !isMeasure ? (form.criteria.trim() || null) : null,
      cycle: form.cycle || null,
      useYn: form.useYn,
      remark: form.remark.trim() || null,
      itemType: form.itemType,
      unit: isMeasure ? (form.unit.trim() || null) : null,
      lslValue: isMeasure && form.lslValue !== "" ? Number(form.lslValue) : null,
      uslValue: isMeasure && form.uslValue !== "" ? Number(form.uslValue) : null,
    };
    try {
      const itemCode = editing?.itemCode || form.itemCode.trim();
      if (editing) {
        await api.put(`/master/equip-inspect-item-masters/${encodeURIComponent(editing.itemCode)}`, payload);
        if (selectedImageFile) {
          await uploadImage(editing.itemCode, selectedImageFile);
        } else if (!previewUrl && editing.imageUrl) {
          await api.delete(`/master/equip-inspect-item-masters/${encodeURIComponent(editing.itemCode)}/image`);
        }
      } else {
        await api.post("/master/equip-inspect-item-masters", payload);
        if (selectedImageFile) await uploadImage(itemCode, selectedImageFile);
      }
      await fetchData();
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
      await api.delete(`/master/equip-inspect-item-masters/${encodeURIComponent(deleteTarget.itemCode)}`);
      setDeleteTarget(null);
      fetchData();
    } catch {
      // 공통 API 레이어에서 오류 토스트 처리
    }
  };

  const columns = useMemo(() => createEquipInspectItemGridColumns({
    t,
    inspectTypeLabels,
    itemTypeLabels,
    cycleLabels,
    guard,
    onEditItem: openEdit,
    onDeleteItem: setDeleteTarget,
  }), [t, inspectTypeLabels, cycleLabels, itemTypeLabels, guard]);

  return (
    <div className="h-full flex overflow-hidden animate-fade-in">
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden p-6 gap-4">
        <div className="flex justify-between items-center flex-shrink-0">
          <div>
            <h1 className="text-xl font-bold text-text flex items-center gap-2">
              <ClipboardList className="w-7 h-7 text-primary" />
              {t("master.equipInspectItem.title", "점검항목 마스터")}
            </h1>
            <p className="text-text-muted mt-1">{t("master.equipInspectItem.subtitle", "설비유형별 점검항목을 등록하고 관리합니다. 설비점검 매핑의 기준 정보입니다.")}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={fetchData}>
              <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} />{t("common.refresh")}
            </Button>
            <Button size="sm" onClick={() => guard(openCreate)}>
              <Plus className="w-4 h-4 mr-1" />{t("common.register", "등록")}
            </Button>
          </div>
        </div>

        <Card className="flex-1 min-h-0 overflow-hidden" padding="none">
          <CardContent className="h-full p-4">
            <DataGrid data={items} columns={columns} isLoading={loading} enableColumnFilter enableExport
              exportFileName={t("master.equipInspectItem.title", "점검항목마스터")}
              emptyMessage={t("master.equipInspect.noItems")}
              onRowClick={(row) => { if (panelOpen) guard(() => openEdit(row)); }}
              toolbarLeft={
                <div className="flex gap-3 flex-1 min-w-0">
                  <div className="flex-1 min-w-0">
                    <Input placeholder={t("master.equipInspect.searchPlaceholder")} value={searchText}
                      onChange={e => setSearchText(e.target.value)} leftIcon={<Search className="w-4 h-4" />} fullWidth />
                  </div>
                  <div className="w-44 flex-shrink-0">
                    <ComCodeSelect groupCode="EQUIP_TYPE" value={equipTypeFilter} onChange={setEquipTypeFilter} labelPrefix={t("master.equip.type", "설비유형")} />
                  </div>
                  <div className="w-44 flex-shrink-0">
                    <Select options={typeFilterOptions} value={typeFilter} onChange={setTypeFilter} fullWidth />
                  </div>
                </div>
              }
              sqlQuery={`SELECT *\nFROM EQUIP_INSPECT_ITEM_MASTERS\nWHERE COMPANY = '40'\n  AND PLANT_CD = '1000'\nORDER BY EQUIP_TYPE, INSPECT_TYPE, ITEM_CODE`} />
          </CardContent>
        </Card>
      </div>

      {panelOpen && (
        <div className="w-[480px] border-l border-border bg-background flex flex-col h-full overflow-hidden shadow-2xl text-xs animate-slide-in-right">
          <div className="px-5 py-3 border-b border-border flex items-center justify-between flex-shrink-0">
            <h2 className="text-sm font-bold text-text">
              {editing ? t("master.equipInspect.editItem") : t("common.register", "등록")}
            </h2>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="secondary" onClick={() => guard(closePanel)}>{t("common.cancel")}</Button>
              <Button size="sm" onClick={handleSave} disabled={saving || !form.itemCode.trim() || !form.itemName.trim() || !form.inspectType || !form.cycle}>
                {saving ? t("common.saving", "저장 중") : (editing ? t("common.save") : t("common.register", "등록"))}
              </Button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-3 space-y-4">
            <div>
              <h3 className="text-xs font-semibold text-text-muted mb-2">{t("master.equipInspectItem.sectionBasic", "기본정보")}</h3>
              <div className="grid grid-cols-2 gap-3">
                <Input label={t("master.equipInspect.itemCode", "항목코드")} value={form.itemCode}
                  onChange={e => setField("itemCode", e.target.value)} disabled={!!editing} fullWidth required />
                <ComCodeSelect groupCode="EQUIP_TYPE" includeAll={false} label={t("master.equip.type", "설비유형")}
                  value={form.equipType} onChange={v => setField("equipType", v)} fullWidth />
                <div className="col-span-2">
                  <Input label={t("master.equipInspect.itemName")} value={form.itemName}
                    onChange={e => setField("itemName", e.target.value)} fullWidth required />
                </div>
                <Select label={t("master.equipInspect.inspectType")} options={typeOptions}
                  value={form.inspectType} onChange={v => setField("inspectType", v as InspectType)} fullWidth required />
                <Select label={t("master.equipInspect.itemType", "판정구분")} options={itemTypeOptions}
                  value={form.itemType} onChange={v => setField("itemType", v as ItemType)} fullWidth />
                <Select label={t("master.equipInspect.cycle")} options={cycleOptions}
                  value={form.cycle} onChange={v => setField("cycle", v)} fullWidth required />
                <UseYnSelect includeAll={false} label={t("common.useYn", "사용")}
                  value={form.useYn} onChange={v => setField("useYn", v)} fullWidth />
              </div>
            </div>

            <div>
              <h3 className="text-xs font-semibold text-text-muted mb-2">{t("master.equipInspectItem.sectionCriteria", "판정기준")}</h3>
              {form.itemType === "MEASURE" ? (
                <div className="grid grid-cols-3 gap-3">
                  <ComCodeSelect groupCode="UNIT_TYPE" includeAll={false} showCode label={t("master.equipInspect.unit", "단위")}
                    value={form.unit} onChange={v => setField("unit", v)} fullWidth />
                  <Input label={t("master.equipInspect.lowerLimit", "하한")} type="number" value={form.lslValue}
                    onChange={e => setField("lslValue", e.target.value)} fullWidth />
                  <Input label={t("master.equipInspect.upperLimit", "상한")} type="number" value={form.uslValue}
                    onChange={e => setField("uslValue", e.target.value)} fullWidth />
                </div>
              ) : (
                <Input label={t("master.equipInspect.criteria")} value={form.criteria}
                  onChange={e => setField("criteria", e.target.value)} fullWidth />
              )}
            </div>

            <div>
              <h3 className="text-xs font-semibold text-text-muted mb-2">{t("master.equipInspectItem.image", "사진")}</h3>
              {previewUrl ? (
                <div className="relative group">
                  {imageError ? (
                    <div className="w-full h-44 rounded-lg border border-border bg-surface flex flex-col items-center justify-center gap-2">
                      <ImageIcon className="w-8 h-8 text-text-muted" />
                      <span className="text-xs text-text-muted">{t("master.equipInspectItem.imageLoadFailed", "이미지를 불러올 수 없습니다")}</span>
                    </div>
                  ) : (
                    <img src={resolveBackendFileUrl(previewUrl)} alt={form.itemName || form.itemCode}
                      onError={() => setImageError(true)}
                      className="w-full h-44 object-contain rounded-lg border border-border bg-surface" />
                  )}
                  <button type="button" onClick={() => setImageDeleteConfirmOpen(true)}
                    className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <button type="button" onClick={() => fileInputRef.current?.click()} disabled={saving}
                  className="w-full h-28 border-2 border-dashed border-border rounded-lg flex flex-col items-center justify-center gap-2 hover:border-primary hover:bg-primary/5 transition-colors disabled:opacity-50">
                  {saving ? <RefreshCw className="w-6 h-6 text-text-muted animate-spin" /> : <ImageIcon className="w-8 h-8 text-text-muted" />}
                  <span className="text-xs text-text-muted">{t("master.equipInspectItem.imageUploadHint", "클릭하여 점검항목 사진 선택")}</span>
                </button>
              )}
              {previewUrl && (
                <button type="button" onClick={() => fileInputRef.current?.click()} disabled={saving}
                  className="mt-2 w-full text-xs text-primary hover:text-primary/80 flex items-center justify-center gap-1">
                  <Upload className="w-3.5 h-3.5" />
                  {t("master.equipInspectItem.imageChange", "사진 변경")}
                </button>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleImageSelect(file);
                  e.target.value = "";
                }}
              />
            </div>

            <Input label={t("common.remark", "비고")} value={form.remark}
              onChange={e => setField("remark", e.target.value)} fullWidth />
          </div>
        </div>
      )}

      <ConfirmModal {...guardModalProps} />

      <ConfirmModal isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDeleteConfirm}
        title={t("common.delete")} message={t("common.confirmDelete")} variant="danger" />
      <ConfirmModal
        isOpen={imageDeleteConfirmOpen}
        onClose={() => setImageDeleteConfirmOpen(false)}
        onConfirm={handleImageClear}
        title={t("common.deleteConfirm", "삭제 확인")}
        message={t("master.equipInspectItem.imageDeleteConfirm", "점검항목 사진을 삭제하시겠습니까?")}
        variant="danger"
      />
    </div>
  );
}
