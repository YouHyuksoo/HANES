"use client";

/**
 * @file src/app/(authenticated)/master/limit-sample/page.tsx
 * @description 양불마스터(양품/불량 한도견본) 페이지 — 레이아웃·상태 배선만 담당
 *
 * 초보자 가이드:
 * 1. 상단 유형 탭(전체/양품견본/불량견본) + 만료·임박 카운트(서버 /expiring?days=30)
 * 2. 좌: DataGrid(서버 페이징) — 컬럼은 limitSampleColumns.tsx (만료/임박 배지 포함)
 * 3. 우: LimitSampleFormPanel — 행 클릭 시 데이터 교체 + useUnsavedGuard
 * 4. 사진은 여러 장. 신규 등록은 저장 후 순차 업로드하고, 대표 1장은 서버가 유일성을 보장한다.
 * 5. API: /master/limit-samples (GET/POST), /:code (PUT/DELETE), /:code/images (POST),
 *         /:code/images/:seqNo (PUT/DELETE), /expiring
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
import { formatDateOnly } from "@/utils/date";
import {
  createLimitSampleGridColumns,
  type LimitSampleImageRow,
  type LimitSampleRow,
  type LimitSampleType,
} from "./limitSampleColumns";
import LimitSampleFormPanel, {
  emptyLimitSampleForm,
  validateLimitSampleForm,
  type LimitSampleForm,
} from "./LimitSampleFormPanel";
import type { PendingSampleImage } from "./LimitSampleImageSection";

const PAGE_SIZE = 100;
const EXPIRING_DAYS = 30;
type TypeTab = "" | LimitSampleType;

interface DefectCodeOption { defectCode: string; defectName: string }

/** 로컬 큐 식별자 — crypto.randomUUID가 없는 구형 브라우저 대비 */
function newLocalId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `img-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export default function LimitSamplePage() {
  const { t } = useTranslation();
  const [rows, setRows] = useState<LimitSampleRow[]>([]);
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
  const [editing, setEditing] = useState<LimitSampleRow | null>(null);
  const [selectedRow, setSelectedRow] = useState<LimitSampleRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<LimitSampleRow | null>(null);
  const [form, setForm] = useState<LimitSampleForm>(() => emptyLimitSampleForm());
  const initialFormRef = useRef<LimitSampleForm>(emptyLimitSampleForm());
  const [images, setImages] = useState<LimitSampleImageRow[]>([]);
  const initialImagesRef = useRef<LimitSampleImageRow[]>([]);
  const [pendingImages, setPendingImages] = useState<PendingSampleImage[]>([]);
  const [imageDeleteTarget, setImageDeleteTarget] = useState<number | null>(null);
  const { markDirty, guard, guardModalProps } = useUnsavedGuard();

  // 미리보기 blob URL은 컴포넌트가 사라질 때 해제한다.
  useEffect(() => () => {
    for (const item of pendingImages) URL.revokeObjectURL(item.previewUrl);
  }, [pendingImages]);

  const fetchExpiring = useCallback(async () => {
    try {
      const res = await api.get("/master/limit-samples/expiring", { params: { days: EXPIRING_DAYS } });
      const list: LimitSampleRow[] = res.data?.data ?? [];
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
      if (typeTab) params.sampleType = typeTab;
      if (searchText.trim()) params.search = searchText.trim();
      if (statusFilter) params.status = statusFilter;
      if (useYnFilter) params.useYn = useYnFilter;
      const res = await api.get("/master/limit-samples", { params });
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
    { value: "OK", label: t("comCode.LIMIT_SAMPLE_TYPE.OK") },
    { value: "NG", label: t("comCode.LIMIT_SAMPLE_TYPE.NG") },
  ], [t]);

  const setField = useCallback((key: keyof LimitSampleForm, value: string) => {
    setForm(prev => ({ ...prev, [key]: value }));
  }, []);

  const clearPending = useCallback(() => {
    setPendingImages(prev => {
      for (const item of prev) URL.revokeObjectURL(item.previewUrl);
      return [];
    });
  }, []);

  const openCreate = () => {
    setEditing(null);
    const blank = emptyLimitSampleForm();
    if (typeTab) blank.sampleType = typeTab;
    setForm(blank);
    initialFormRef.current = blank;
    setImages([]);
    initialImagesRef.current = [];
    clearPending();
    setPanelOpen(true);
  };

  const openEdit = (row: LimitSampleRow) => {
    setEditing(row);
    setSelectedRow(row);
    const next: LimitSampleForm = {
      sampleCode: row.sampleCode,
      sampleType: row.sampleType,
      sampleName: row.sampleName,
      itemCode: row.itemCode ?? "",
      processCode: row.processCode ?? "",
      defectCode: row.defectCode ?? "",
      inspectType: row.inspectType ?? "",
      location: row.location ?? "",
      validFrom: row.validFrom ?? "",
      validTo: row.validTo ?? "",
      approvedBy: row.approvedBy ?? "",
      // APPROVED_AT 은 TIMESTAMP(UTC ISO) 라 앞 10자리를 자르면 KST 오전 9시 이전 건이 전날로 나온다
      approvedAt: formatDateOnly(row.approvedAt, ""),
      status: row.status || "ACTIVE",
      requiredYn: row.requiredYn || "Y",
      sortOrder: String(row.sortOrder ?? 0),
      remark: row.remark ?? "",
      useYn: row.useYn || "Y",
    };
    setForm(next);
    initialFormRef.current = next;
    const nextImages = [...(row.images ?? [])];
    setImages(nextImages);
    initialImagesRef.current = nextImages;
    clearPending();
    setPanelOpen(true);
  };

  const closePanel = () => {
    setPanelOpen(false);
    setEditing(null);
    setImages([]);
    initialImagesRef.current = [];
    clearPending();
  };

  // 작성 중(저장 안 됨) 여부 — 폼 값, 사진 메타, 업로드 대기 사진 중 하나라도 바뀌면 dirty
  const dirty = useMemo(
    () => panelOpen && (
      JSON.stringify(form) !== JSON.stringify(initialFormRef.current) ||
      JSON.stringify(images) !== JSON.stringify(initialImagesRef.current) ||
      pendingImages.length > 0
    ),
    [panelOpen, form, images, pendingImages],
  );
  useEffect(() => { markDirty(dirty); }, [dirty, markDirty]);

  const handleAddFiles = (files: File[]) => {
    const hasPrimary = images.some(img => img.isPrimary === "Y") || pendingImages.some(p => p.isPrimary);
    setPendingImages(prev => [
      ...prev,
      ...files.map((file, index) => ({
        id: newLocalId(),
        file,
        previewUrl: URL.createObjectURL(file),
        caption: "",
        // 대표가 하나도 없으면 첫 장을 대표로 올린다(서버도 첫 사진을 자동 대표로 삼는다).
        isPrimary: !hasPrimary && prev.length === 0 && index === 0,
      })),
    ]);
  };

  const handleChangeSavedCaption = (seqNo: number, caption: string) => {
    setImages(prev => prev.map(img => (img.seqNo === seqNo ? { ...img, caption } : img)));
  };

  const handleChangePendingCaption = (id: string, caption: string) => {
    setPendingImages(prev => prev.map(item => (item.id === id ? { ...item, caption } : item)));
  };

  const handleSetSavedPrimary = (seqNo: number) => {
    setImages(prev => prev.map(img => ({ ...img, isPrimary: img.seqNo === seqNo ? "Y" : "N" })));
    setPendingImages(prev => prev.map(item => ({ ...item, isPrimary: false })));
  };

  const handleSetPendingPrimary = (id: string) => {
    setPendingImages(prev => prev.map(item => ({ ...item, isPrimary: item.id === id })));
    setImages(prev => prev.map(img => ({ ...img, isPrimary: "N" })));
  };

  const handleMoveSaved = (seqNo: number, direction: -1 | 1) => {
    setImages(prev => {
      const index = prev.findIndex(img => img.seqNo === seqNo);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      // 화면 순서를 그대로 sortOrder로 굳힌다 — 저장 시 서버에 반영된다.
      return next.map((img, i) => ({ ...img, sortOrder: i + 1 }));
    });
  };

  const handleRemovePending = (id: string) => {
    setPendingImages(prev => {
      const target = prev.find(item => item.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter(item => item.id !== id);
    });
  };

  /** 저장된 사진 삭제는 즉시 서버 반영 — 파일도 함께 지워진다. */
  const handleDeleteSavedImage = async () => {
    const seqNo = imageDeleteTarget;
    const sampleCode = editing?.sampleCode;
    setImageDeleteTarget(null);
    if (seqNo == null || !sampleCode) return;
    try {
      const res = await api.delete(`/master/limit-samples/${encodeURIComponent(sampleCode)}/images/${seqNo}`);
      const nextImages: LimitSampleImageRow[] = res.data?.data?.images ?? [];
      setImages(nextImages);
      initialImagesRef.current = nextImages;
      await fetchData();
    } catch {
      // 공통 API 레이어에서 오류 토스트 처리
    }
  };

  const uploadPendingImages = async (sampleCode: string) => {
    for (const item of pendingImages) {
      const formData = new FormData();
      formData.append("image", item.file);
      const res = await api.post(`/master/limit-samples/${encodeURIComponent(sampleCode)}/images`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const uploaded: LimitSampleImageRow[] = res.data?.data?.images ?? [];
      const created = uploaded[uploaded.length - 1];
      if (!created) continue;
      if (item.caption.trim() || item.isPrimary) {
        await api.put(`/master/limit-samples/${encodeURIComponent(sampleCode)}/images/${created.seqNo}`, {
          caption: item.caption.trim() || null,
          ...(item.isPrimary ? { isPrimary: "Y" } : {}),
        });
      }
    }
  };

  /** 저장된 사진의 캡션·대표·순서 변경분만 골라 보낸다. */
  const syncSavedImageMeta = async (sampleCode: string) => {
    const before = new Map(initialImagesRef.current.map(img => [img.seqNo, img]));
    for (const img of images) {
      const prev = before.get(img.seqNo);
      if (!prev) continue;
      const captionChanged = (prev.caption ?? "") !== (img.caption ?? "");
      const primaryChanged = prev.isPrimary !== img.isPrimary;
      const orderChanged = prev.sortOrder !== img.sortOrder;
      if (!captionChanged && !primaryChanged && !orderChanged) continue;
      await api.put(`/master/limit-samples/${encodeURIComponent(sampleCode)}/images/${img.seqNo}`, {
        ...(captionChanged ? { caption: img.caption || null } : {}),
        ...(primaryChanged ? { isPrimary: img.isPrimary } : {}),
        ...(orderChanged ? { sortOrder: img.sortOrder } : {}),
      });
    }
  };

  const handleSave = async () => {
    if (!validateLimitSampleForm(form)) return;
    setSaving(true);
    const payload = {
      sampleCode: form.sampleCode.trim(),
      sampleType: form.sampleType,
      sampleName: form.sampleName.trim(),
      itemCode: form.itemCode || null,
      processCode: form.processCode || null,
      defectCode: form.sampleType === "NG" ? (form.defectCode || null) : null,
      inspectType: form.inspectType || null,
      location: form.location.trim() || null,
      validFrom: form.validFrom || null,
      validTo: form.validTo || null,
      approvedBy: form.approvedBy.trim() || null,
      approvedAt: form.approvedAt || null,
      status: form.status,
      requiredYn: form.requiredYn,
      sortOrder: Number(form.sortOrder) || 0,
      remark: form.remark.trim() || null,
      useYn: form.useYn,
    };
    try {
      const sampleCode = editing?.sampleCode ?? payload.sampleCode;
      if (editing) {
        await api.put(`/master/limit-samples/${encodeURIComponent(editing.sampleCode)}`, payload);
        await syncSavedImageMeta(editing.sampleCode);
      } else {
        await api.post("/master/limit-samples", payload);
      }
      if (pendingImages.length > 0) await uploadPendingImages(sampleCode);
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
      await api.delete(`/master/limit-samples/${encodeURIComponent(deleteTarget.sampleCode)}`);
      if (editing?.sampleCode === deleteTarget.sampleCode) closePanel();
      await Promise.all([fetchData(), fetchExpiring()]);
    } catch {
      // 공통 API 레이어에서 오류 토스트 처리
    } finally {
      setDeleteTarget(null);
    }
  };

  const columns = useMemo(() => createLimitSampleGridColumns({
    t,
    onEditSample: (row) => guard(() => openEdit(row)),
    onDeleteSample: setDeleteTarget,
  }), [t, guard]);

  return (
    <div className="flex h-full overflow-hidden animate-fade-in">
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden p-6 gap-4">
        <div className="flex justify-between items-center flex-shrink-0">
          <div>
            <h1 className="text-xl font-bold text-text flex items-center gap-2">
              <ShieldCheck className="w-7 h-7 text-primary" />
              {t("master.limitSample.title")}
            </h1>
            <p className="text-text-muted mt-1">{t("master.limitSample.subtitle")}</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-xs text-text-muted flex items-center gap-3">
              <span>
                {t("master.limitSample.expired")}: <span className="font-semibold text-red-600 dark:text-red-400">{expiringSummary.expired}</span>
              </span>
              <span>
                {t("master.limitSample.expiringWithin", { days: EXPIRING_DAYS })}: <span className="font-semibold text-amber-700 dark:text-amber-300">{expiringSummary.expiring}</span>
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
              exportFileName={t("master.limitSample.title")}
              getRowId={(row) => (row as LimitSampleRow).sampleCode}
              selectedRowId={selectedRow?.sampleCode}
              onRowClick={(row) => {
                const sample = row as LimitSampleRow;
                if (panelOpen) guard(() => openEdit(sample));
                else setSelectedRow(sample);
              }}
              toolbarLeft={
                <div className="flex gap-3 items-center flex-1 min-w-0 flex-wrap">
                  <div className="w-64">
                    <Input placeholder={t("master.limitSample.searchPlaceholder")} value={searchText}
                      onChange={e => setSearchText(e.target.value)} leftIcon={<Search className="w-4 h-4" />} fullWidth />
                  </div>
                  <ComCodeSelect groupCode="LIMIT_SAMPLE_STATUS" value={statusFilter} onChange={setStatusFilter}
                    labelPrefix={t("common.status")} />
                  <UseYnSelect value={useYnFilter} onChange={setUseYnFilter} />
                  <ServerPager page={page} total={total} limit={PAGE_SIZE} onPageChange={setPage} disabled={loading} className="flex-shrink-0 ml-auto" />
                </div>
              }
              sqlQuery={`SELECT *\nFROM LIMIT_SAMPLES\nWHERE COMPANY = '40'\n  AND PLANT_CD = '1000'\nORDER BY SAMPLE_TYPE, SAMPLE_CODE`} />
          </CardContent>
        </Card>
      </div>

      {panelOpen && (
        <LimitSampleFormPanel
          t={t}
          editing={!!editing}
          saving={saving}
          form={form}
          defectCodeOptions={defectCodeOptions}
          images={images}
          pendingImages={pendingImages}
          onChange={setField}
          onAddFiles={handleAddFiles}
          onChangeSavedCaption={handleChangeSavedCaption}
          onChangePendingCaption={handleChangePendingCaption}
          onSetSavedPrimary={handleSetSavedPrimary}
          onSetPendingPrimary={handleSetPendingPrimary}
          onMoveSaved={handleMoveSaved}
          onRequestDeleteSaved={setImageDeleteTarget}
          onRemovePending={handleRemovePending}
          onSave={handleSave}
          onCancel={() => guard(closePanel)}
        />
      )}

      <ConfirmModal {...guardModalProps} />

      <ConfirmModal isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDeleteConfirm}
        variant="danger" title={t("common.delete")}
        message={`'${deleteTarget?.sampleName ?? ""}'${t("common.deleteConfirm")}`} />
      <ConfirmModal isOpen={imageDeleteTarget !== null} onClose={() => setImageDeleteTarget(null)} onConfirm={handleDeleteSavedImage}
        variant="danger" title={t("common.delete")}
        message={t("master.limitSample.imageDeleteConfirm")} />
    </div>
  );
}
