"use client";

/**
 * @file components/EquipMasterTab.tsx
 * @description 설비 마스터 관리 탭 — 설비 기본 정보 CRUD
 *
 * 초보자 가이드:
 * 1. API: GET/POST/PUT/DELETE /equipment/masters
 * 2. 통신 설정: MQTT, Serial, TCP 지원
 * 3. 라인, 설비유형, 상태 필터링 지원
 */

import { useState, useMemo, useEffect, useCallback, useRef, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { ColumnDef } from "@tanstack/react-table";
import {
  Plus, Edit2, Trash2, Search, RefreshCw, Settings, ImageIcon, Upload,
  Wifi, Monitor,
} from "lucide-react";
import { Card, CardContent, Button, Input, Modal, ConfirmModal } from "@/components/ui";
import DataGrid from "@/components/data-grid/DataGrid";
import { EquipMaster, EquipType, CommType, COMM_TYPE_COLORS, COMM_TYPE_LABELS } from "../types";
import api from "@/services/api";
import { useUnsavedGuard } from "@/hooks/useUnsavedGuard";
import { ComCodeSelect, LineSelect } from '@/components/shared';
import { FieldInput, FieldComCodeSelect, FieldLineSelect } from "./EquipFieldHelp";

function EquipImageThumb({ src, alt }: { src: string; alt: string }) {
  const [errored, setErrored] = useState(false);
  if (errored) return <ImageIcon className="w-4 h-4 text-text-muted mx-auto" />;
  return (
    <img
      src={src}
      alt={alt}
      onError={() => setErrored(true)}
      className="w-8 h-8 object-cover rounded border border-border bg-surface mx-auto"
    />
  );
}

interface FormState {
  equipCode: string;
  equipName: string;
  equipType: EquipType;
  lineCode: string;
  modelName: string;
  imageUrl?: string | null;
  maker: string;
  commType: CommType;
  ipAddress: string;
  port: string;
  mqttTopic: string;
  serialPort: string;
  baudRate: string;
  useYn: string;
}

interface EquipMasterTabProps {
  onHeaderActionsChange?: (actions: ReactNode | null) => void;
}

const EMPTY_FORM: FormState = {
  equipCode: "",
  equipName: "",
  equipType: "SINGLE_CUT",
  lineCode: "",
  modelName: "",
  maker: "",
  commType: "NONE",
  ipAddress: "",
  port: "",
  mqttTopic: "",
  serialPort: "",
  baudRate: "9600",
  useYn: "Y",
};

export default function EquipMasterTab({ onHeaderActionsChange }: EquipMasterTabProps) {
  const { t } = useTranslation();
  const [equipments, setEquipments] = useState<EquipMaster[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [lineFilter, setLineFilter] = useState("");
  const [commFilter, setCommFilter] = useState("");
  const [panelOpen, setPanelOpen] = useState(false);
  const [editing, setEditing] = useState<EquipMaster | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const initialFormRef = useRef<FormState>(EMPTY_FORM);
  const { markDirty, guard, guardModalProps } = useUnsavedGuard();
  const [deleteTarget, setDeleteTarget] = useState<EquipMaster | null>(null);
  const [alertModal, setAlertModal] = useState({ open: false, title: '', message: '' });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [imageError, setImageError] = useState(false);
  const [imageDeleteConfirmOpen, setImageDeleteConfirmOpen] = useState(false);

  // API에서 설비 목록 조회
  const fetchEquipments = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { limit: "100" };
      if (searchText) params.search = searchText;
      if (typeFilter) params.equipType = typeFilter;
      if (lineFilter) params.lineCode = lineFilter;
      if (commFilter) params.commType = commFilter;
      
      const res = await api.get("/equipment/equips", { params });
      if (res.data.success) {
        setEquipments(res.data.data || []);
      }
    } catch (e) {
      console.error("Failed to fetch equipments:", e);
      setEquipments([]);
    } finally {
      setLoading(false);
    }
  }, [searchText, typeFilter, lineFilter, commFilter]);

  useEffect(() => {
    fetchEquipments();
  }, [fetchEquipments]);

  const openCreate = useCallback(() => {
    setEditing(null);
    setForm(EMPTY_FORM);
    initialFormRef.current = EMPTY_FORM;
    setSelectedImageFile(null);
    setPreviewUrl(null);
    setImageError(false);
    setPanelOpen(true);
  }, []);

  const openEdit = (equip: EquipMaster) => {
    setEditing(equip);
    const nextForm: FormState = {
      equipCode: equip.equipCode,
      equipName: equip.equipName,
      equipType: equip.equipType,
      lineCode: equip.lineCode || "",
      modelName: equip.modelName || "",
      imageUrl: equip.imageUrl || null,
      maker: equip.maker || "",
      commType: equip.commType,
      ipAddress: equip.ipAddress || "",
      port: equip.port?.toString() || "",
      mqttTopic: "",
      serialPort: "",
      baudRate: "9600",
      useYn: equip.useYn,
    };
    setForm(nextForm);
    initialFormRef.current = nextForm;
    setSelectedImageFile(null);
    setPreviewUrl(equip.imageUrl || null);
    setImageError(false);
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

  useEffect(() => {
    if (previewUrl?.startsWith("blob:")) {
      return () => URL.revokeObjectURL(previewUrl);
    }
    return undefined;
  }, [previewUrl]);

  const handleImageSelect = (file: File) => {
    if (previewUrl?.startsWith("blob:")) {
      URL.revokeObjectURL(previewUrl);
    }
    setSelectedImageFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setImageError(false);
  };

  const handleImageClear = () => {
    if (previewUrl?.startsWith("blob:")) {
      URL.revokeObjectURL(previewUrl);
    }
    setSelectedImageFile(null);
    setPreviewUrl(null);
    setImageDeleteConfirmOpen(false);
  };

  const uploadImage = async (equipCode: string, file: File) => {
    const formData = new FormData();
    formData.append("image", file);
    await api.post(`/equipment/equips/${encodeURIComponent(equipCode)}/image`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  };

  const handleSave = async () => {
    try {
      const body = {
        equipCode: form.equipCode,
        equipName: form.equipName,
        equipType: form.equipType,
        lineCode: form.lineCode || undefined,
        modelName: form.modelName || undefined,
        imageUrl: form.imageUrl || undefined,
        maker: form.maker || undefined,
        commType: form.commType,
        ...(form.commType === "TCP" || form.commType === "MQTT" ? {
          ipAddress: form.ipAddress || undefined,
          port: form.port ? parseInt(form.port) : undefined,
        } : {}),
        useYn: form.useYn,
      };

      if (editing) {
        await api.put(`/equipment/equips/${editing.equipCode}`, body);
        if (selectedImageFile) {
          await uploadImage(editing.equipCode, selectedImageFile);
        } else if (!previewUrl && editing.imageUrl) {
          await api.delete(`/equipment/equips/${encodeURIComponent(editing.equipCode)}/image`);
        }
      } else {
        await api.post("/equipment/equips", body);
        if (selectedImageFile) {
          await uploadImage(form.equipCode, selectedImageFile);
        }
      }
      setPanelOpen(false);
      setSelectedImageFile(null);
      setPreviewUrl(null);
      fetchEquipments();
    } catch (e: any) {
      console.error("Save failed:", e);
      setAlertModal({ open: true, title: t("common.error"), message: e.response?.data?.message || t("common.saveFailed", "저장에 실패했습니다.") });
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    try {
      await api.delete(`/equipment/equips/${deleteTarget.equipCode}`);
      fetchEquipments();
    } catch (e: any) {
      console.error("Delete failed:", e);
    } finally {
      setDeleteTarget(null);
    }
  };

  useEffect(() => {
    if (!onHeaderActionsChange) return;
    onHeaderActionsChange(
      <>
        <Button variant="secondary" size="sm" onClick={fetchEquipments}>
          <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} />
          {t("common.refresh", "새로고침")}
        </Button>
        <Button size="sm" onClick={() => guard(openCreate)}>
          <Plus className="w-4 h-4 mr-1" />
          {t("master.equip.addEquip", "설비 추가")}
        </Button>
      </>,
    );
    return () => onHeaderActionsChange(null);
  }, [fetchEquipments, loading, onHeaderActionsChange, openCreate, guard, t]);

  const columns = useMemo<ColumnDef<EquipMaster>[]>(() => [
    {
      id: "actions", header: t("common.actions", "작업"), size: 80,
      meta: { align: "center" as const },
      cell: ({ row }) => (
        <div className="flex gap-1">
          <button onClick={() => guard(() => openEdit(row.original))} className="p-1 hover:bg-surface rounded">
            <Edit2 className="w-4 h-4 text-primary" />
          </button>
          <button onClick={() => setDeleteTarget(row.original)} className="p-1 hover:bg-surface rounded">
            <Trash2 className="w-4 h-4 text-red-500" />
          </button>
        </div>
      ),
    },
    { accessorKey: "equipCode", header: t("master.equip.equipCode", "설비코드"), size: 100 },
    {
      accessorKey: "imageUrl",
      header: t("master.equip.image", "사진"),
      size: 55,
      cell: ({ getValue, row }) => {
        const imageUrl = getValue() as string | null | undefined;
        return imageUrl ? <EquipImageThumb src={imageUrl} alt={row.original.equipName} /> : <ImageIcon className="w-4 h-4 text-text-muted mx-auto" />;
      },
    },
    { accessorKey: "equipName", header: t("master.equip.equipName", "설비명"), size: 150 },
    {
      accessorKey: "equipType", header: t("master.equip.type", "유형"), size: 80,
      cell: ({ getValue }) => {
        const v = getValue() as EquipType;
        return <span className="text-xs">{t(`master.equip.${v.toLowerCase()}`, v)}</span>;
      },
    },
    {
      accessorKey: "processCode", header: t("master.equip.process", "공정"), size: 110,
      cell: ({ row }) => {
        const e = row.original;
        if (!e.processCode) return <span className="text-text-muted">-</span>;
        return (
          <div className="leading-tight">
            <div className="text-xs">{e.processName || e.processCode}</div>
            {e.processName && <div className="text-[10px] text-text-muted font-mono">{e.processCode}</div>}
          </div>
        );
      },
    },
    {
      accessorKey: "commType", header: t("master.equip.commType", "통신"), size: 80,
      cell: ({ getValue }) => {
        const v = getValue() as CommType;
        return (
          <span className={`px-2 py-0.5 text-xs rounded-full ${COMM_TYPE_COLORS[v]}`}>
            {COMM_TYPE_LABELS[v]}
          </span>
        );
      },
    },
    {
      accessorKey: "ipAddress", header: t("master.equip.ipPort", "IP/Port"), size: 130,
      cell: ({ row }) => {
        const e = row.original;
        if (e.commType === "NONE") return "-";
        if (e.commType === "SERIAL") return e.lineCode || "-";
        return e.ipAddress ? `${e.ipAddress}:${e.port || "-"}` : "-";
      },
    },
    { accessorKey: "maker", header: t("master.equip.maker", "제조사"), size: 100 },
    { accessorKey: "modelName", header: t("master.equip.model", "모델"), size: 100 },
    {
      accessorKey: "useYn", header: t("common.use", "사용"), size: 50,
      cell: ({ getValue }) => (
        <span className={`w-2 h-2 rounded-full inline-block ${getValue() === "Y" ? "bg-green-500" : "bg-gray-400"}`} />
      ),
    },
  ], [t, guard]);

  return (
    <div className="h-full flex overflow-hidden">
      <div className="flex-1 min-w-0 flex flex-col">
        <Card className="flex-1 min-h-0 overflow-hidden">
          <CardContent className="h-full">
            <DataGrid data={equipments} columns={columns} pageSize={10} isLoading={loading} enableColumnPinning enableColumnFilter enableExport exportFileName={t("master.equip.title", "설비관리")}
              onRowClick={(row) => { if (panelOpen) guard(() => openEdit(row)); }}
              toolbarLeft={
                <div className="flex gap-3 flex-1 min-w-0">
                  <div className="flex-1 min-w-0">
                    <Input
                      placeholder={t("master.equip.searchPlaceholder", "설비코드/설비명 검색...")}
                      value={searchText}
                      onChange={(e) => setSearchText(e.target.value)}
                      leftIcon={<Search className="w-4 h-4" />}
                      fullWidth
                    />
                  </div>
                  <ComCodeSelect groupCode="EQUIP_TYPE" value={typeFilter} onChange={setTypeFilter} labelPrefix={t("master.equip.type", "유형")} />
                  <LineSelect value={lineFilter} onChange={setLineFilter} placeholder={t("master.equip.line", "라인")} />
                  <ComCodeSelect groupCode="COMM_TYPE" value={commFilter} onChange={setCommFilter} labelPrefix={t("master.equip.commTypeShort", "통신")} />
                </div>
              } 
              sqlQuery={`SELECT *\nFROM EQUIP_MASTERS\nWHERE COMPANY = '40'\n  AND PLANT_CD = '1000'\nORDER BY CREATED_AT DESC`}/>
          </CardContent>
        </Card>
      </div>

      {panelOpen && (
        <div className="w-[440px] ml-4 border-l border-border bg-background flex flex-col h-full overflow-hidden shadow-2xl text-xs animate-slide-in-right">
          <div className="px-5 py-3 border-b border-border flex items-center justify-between flex-shrink-0">
            <h2 className="text-sm font-bold text-text">
              {editing ? t("master.equip.editEquip", "설비 수정") : t("master.equip.addEquip", "설비 추가")}
            </h2>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="secondary" onClick={() => guard(() => setPanelOpen(false))}>
                {t("common.cancel", "취소")}
              </Button>
              <Button size="sm" onClick={handleSave} disabled={!form.equipCode.trim() || !form.equipName.trim()}>
                {t("common.save", "저장")}
              </Button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto px-5 py-3 space-y-4">
            <div>
              <h3 className="text-xs font-semibold text-text-muted mb-2">{t("master.equip.sectionBasic", "기본정보")}</h3>
              <div className="grid grid-cols-2 gap-3">
                <FieldInput field="equipCode" label={t("master.equip.equipCode", "설비코드")} value={form.equipCode} onChange={(e) => setForm({ ...form, equipCode: e.target.value })} disabled={!!editing} required />
                <FieldInput field="equipName" label={t("master.equip.equipName", "설비명")} value={form.equipName} onChange={(e) => setForm({ ...form, equipName: e.target.value })} required />
                <FieldComCodeSelect field="equipType" groupCode="EQUIP_TYPE" includeAll={false} label={t("master.equip.type", "유형")} value={form.equipType} onChange={(v) => setForm({ ...form, equipType: v as EquipType })} />
                <FieldComCodeSelect field="commType" groupCode="COMM_TYPE" includeAll={false} label={t("master.equip.commType", "통신방식")} value={form.commType} onChange={(v) => setForm({ ...form, commType: v as CommType })} />
                <FieldLineSelect field="lineCode" label={t("master.equip.line", "라인")} value={form.lineCode} onChange={(v) => setForm({ ...form, lineCode: v })} wrapperClassName="col-span-2" />
              </div>
            </div>
            {(form.commType === "TCP" || form.commType === "MQTT") && (
              <div>
                <h3 className="text-xs font-semibold text-text-muted mb-2">{t("master.equip.sectionComm", "통신설정")}</h3>
                <div className="grid grid-cols-2 gap-3">
                  <FieldInput field="ipAddress" label={t("master.equip.ipAddress", "IP 주소")} value={form.ipAddress} onChange={(e) => setForm({ ...form, ipAddress: e.target.value })} leftIcon={<Wifi className="w-4 h-4" />} />
                  <FieldInput field="port" label={t("master.equip.port", "포트")} value={form.port} onChange={(e) => setForm({ ...form, port: e.target.value })} />
                  {form.commType === "MQTT" && (
                    <FieldInput field="mqttTopic" label="MQTT Topic" value={form.mqttTopic} onChange={(e) => setForm({ ...form, mqttTopic: e.target.value })} wrapperClassName="col-span-2" />
                  )}
                </div>
              </div>
            )}
            {form.commType === "SERIAL" && (
              <div>
                <h3 className="text-xs font-semibold text-text-muted mb-2">{t("master.equip.sectionComm", "통신설정")}</h3>
                <div className="grid grid-cols-2 gap-3">
                  <FieldInput field="serialPort" label={t("master.equip.serialPort", "시리얼 포트")} value={form.serialPort} onChange={(e) => setForm({ ...form, serialPort: e.target.value })} leftIcon={<Settings className="w-4 h-4" />} />
                  <FieldInput field="baudRate" label="Baud Rate" value={form.baudRate} onChange={(e) => setForm({ ...form, baudRate: e.target.value })} />
                </div>
              </div>
            )}
            <div>
              <h3 className="text-xs font-semibold text-text-muted mb-2">{t("master.equip.sectionMaker", "제조정보")}</h3>
              <div className="grid grid-cols-2 gap-3">
                <FieldInput field="maker" label={t("master.equip.maker", "제조사")} value={form.maker} onChange={(e) => setForm({ ...form, maker: e.target.value })} />
                <FieldInput field="modelName" label={t("master.equip.model", "모델명")} value={form.modelName} onChange={(e) => setForm({ ...form, modelName: e.target.value })} />
              </div>
            </div>
            <div>
              <h3 className="text-xs font-semibold text-text-muted mb-2">{t("master.equip.sectionImage", "사진")}</h3>
              {previewUrl ? (
                <div className="relative group">
                  {imageError ? (
                    <div className="w-full h-44 rounded-lg border border-border bg-surface flex flex-col items-center justify-center gap-2">
                      <ImageIcon className="w-8 h-8 text-text-muted" />
                      <span className="text-xs text-text-muted">{t("master.equip.imageLoadFailed", "이미지를 불러올 수 없습니다")}</span>
                    </div>
                  ) : (
                    <img
                      src={previewUrl}
                      alt={form.equipName || form.equipCode}
                      onError={() => setImageError(true)}
                      className="w-full h-44 object-contain rounded-lg border border-border bg-surface"
                    />
                  )}
                  <button
                    type="button"
                    onClick={() => setImageDeleteConfirmOpen(true)}
                    className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full h-28 border-2 border-dashed border-border rounded-lg flex flex-col items-center justify-center gap-2 hover:border-primary hover:bg-primary/5 transition-colors"
                >
                  <ImageIcon className="w-8 h-8 text-text-muted" />
                  <span className="text-xs text-text-muted">{t("master.equip.imageUploadHint", "클릭하여 설비 사진 선택")}</span>
                </button>
              )}
              {previewUrl && (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="mt-2 w-full text-xs text-primary hover:text-primary/80 flex items-center justify-center gap-1"
                >
                  <Upload className="w-3.5 h-3.5" />
                  {t("master.equip.imageChange", "사진 변경")}
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
          </div>
        </div>
      )}

      <ConfirmModal {...guardModalProps} />

      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        variant="danger"
        message={t("common.deleteConfirmMessage", "{{name}} 을(를) 삭제하시겠습니까?", { name: `'${deleteTarget?.equipName || ""}'` })}
      />

      <Modal isOpen={alertModal.open} onClose={() => setAlertModal({ ...alertModal, open: false })} title={alertModal.title} size="sm">
        <p className="text-text">{alertModal.message}</p>
        <div className="flex justify-end pt-4">
          <Button onClick={() => setAlertModal({ ...alertModal, open: false })}>{t("common.confirm")}</Button>
        </div>
      </Modal>

      <ConfirmModal
        isOpen={imageDeleteConfirmOpen}
        onClose={() => setImageDeleteConfirmOpen(false)}
        onConfirm={handleImageClear}
        title={t("common.deleteConfirm", "삭제 확인")}
        message={t("master.equip.imageDeleteConfirm", "설비 사진을 삭제하시겠습니까?")}
        variant="danger"
      />
    </div>
  );
}
