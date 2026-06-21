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

import { useState, useMemo, useEffect, useCallback, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { ColumnDef } from "@tanstack/react-table";
import {
  Plus, Edit2, Trash2, Search, RefreshCw, Settings,
  Wifi, Monitor,
} from "lucide-react";
import { Card, CardContent, Button, Input, Modal, ConfirmModal } from "@/components/ui";
import DataGrid from "@/components/data-grid/DataGrid";
import { EquipMaster, EquipType, CommType, COMM_TYPE_COLORS, COMM_TYPE_LABELS } from "../types";
import api from "@/services/api";
import { ComCodeSelect, LineSelect } from '@/components/shared';

interface FormState {
  equipCode: string;
  equipName: string;
  equipType: EquipType;
  lineCode: string;
  modelName: string;
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
  const [deleteTarget, setDeleteTarget] = useState<EquipMaster | null>(null);
  const [alertModal, setAlertModal] = useState({ open: false, title: '', message: '' });

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
    setPanelOpen(true);
  }, []);

  const openEdit = (equip: EquipMaster) => {
    setEditing(equip);
    setForm({
      equipCode: equip.equipCode,
      equipName: equip.equipName,
      equipType: equip.equipType,
      lineCode: equip.lineCode || "",
      modelName: equip.modelName || "",
      maker: equip.maker || "",
      commType: equip.commType,
      ipAddress: equip.ipAddress || "",
      port: equip.port?.toString() || "",
      mqttTopic: "",
      serialPort: "",
      baudRate: "9600",
      useYn: equip.useYn,
    });
    setPanelOpen(true);
  };

  const handleSave = async () => {
    try {
      const body = {
        equipCode: form.equipCode,
        equipName: form.equipName,
        equipType: form.equipType,
        lineCode: form.lineCode || undefined,
        modelName: form.modelName || undefined,
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
      } else {
        await api.post("/equipment/equips", body);
      }
      setPanelOpen(false);
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
        <Button size="sm" onClick={openCreate}>
          <Plus className="w-4 h-4 mr-1" />
          {t("master.equip.addEquip", "설비 추가")}
        </Button>
      </>,
    );
    return () => onHeaderActionsChange(null);
  }, [fetchEquipments, loading, onHeaderActionsChange, openCreate, t]);

  const columns = useMemo<ColumnDef<EquipMaster>[]>(() => [
    {
      id: "actions", header: t("common.actions", "작업"), size: 80,
      meta: { align: "center" as const },
      cell: ({ row }) => (
        <div className="flex gap-1">
          <button onClick={() => openEdit(row.original)} className="p-1 hover:bg-surface rounded">
            <Edit2 className="w-4 h-4 text-primary" />
          </button>
          <button onClick={() => setDeleteTarget(row.original)} className="p-1 hover:bg-surface rounded">
            <Trash2 className="w-4 h-4 text-red-500" />
          </button>
        </div>
      ),
    },
    { accessorKey: "equipCode", header: t("master.equip.equipCode", "설비코드"), size: 100 },
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
  ], [t]);

  return (
    <div className="h-full flex overflow-hidden">
      <div className="flex-1 min-w-0 flex flex-col">
        <Card className="flex-1 min-h-0 overflow-hidden">
          <CardContent className="h-full">
            <DataGrid data={equipments} columns={columns} pageSize={10} isLoading={loading} enableColumnPinning enableColumnFilter enableExport exportFileName={t("master.equip.title", "설비관리")}
              onRowClick={(row) => { if (panelOpen) openEdit(row); }}
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
              <Button size="sm" variant="secondary" onClick={() => setPanelOpen(false)}>
                {t("common.cancel", "취소")}
              </Button>
              <Button size="sm" onClick={handleSave} disabled={!form.equipCode.trim() || !form.equipName.trim()}>
                {editing ? t("common.edit", "수정") : t("common.add", "등록")}
              </Button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto px-5 py-3 space-y-4">
            <div>
              <h3 className="text-xs font-semibold text-text-muted mb-2">{t("master.equip.sectionBasic", "기본정보")}</h3>
              <div className="grid grid-cols-2 gap-3">
                <Input label={t("master.equip.equipCode", "설비코드")} value={form.equipCode} onChange={(e) => setForm({ ...form, equipCode: e.target.value })} fullWidth disabled={!!editing} required />
                <Input label={t("master.equip.equipName", "설비명")} value={form.equipName} onChange={(e) => setForm({ ...form, equipName: e.target.value })} fullWidth required />
                <ComCodeSelect groupCode="EQUIP_TYPE" includeAll={false} label={t("master.equip.type", "유형")} value={form.equipType} onChange={(v) => setForm({ ...form, equipType: v as EquipType })} fullWidth />
                <ComCodeSelect groupCode="COMM_TYPE" includeAll={false} label={t("master.equip.commType", "통신방식")} value={form.commType} onChange={(v) => setForm({ ...form, commType: v as CommType })} fullWidth />
                <div className="col-span-2">
                  <LineSelect label={t("master.equip.line", "라인")} value={form.lineCode} onChange={(v) => setForm({ ...form, lineCode: v })} fullWidth />
                </div>
              </div>
            </div>
            {(form.commType === "TCP" || form.commType === "MQTT") && (
              <div>
                <h3 className="text-xs font-semibold text-text-muted mb-2">{t("master.equip.sectionComm", "통신설정")}</h3>
                <div className="grid grid-cols-2 gap-3">
                  <Input label={t("master.equip.ipAddress", "IP 주소")} value={form.ipAddress} onChange={(e) => setForm({ ...form, ipAddress: e.target.value })} fullWidth leftIcon={<Wifi className="w-4 h-4" />} />
                  <Input label={t("master.equip.port", "포트")} value={form.port} onChange={(e) => setForm({ ...form, port: e.target.value })} fullWidth />
                  {form.commType === "MQTT" && (
                    <div className="col-span-2">
                      <Input label="MQTT Topic" value={form.mqttTopic} onChange={(e) => setForm({ ...form, mqttTopic: e.target.value })} fullWidth />
                    </div>
                  )}
                </div>
              </div>
            )}
            {form.commType === "SERIAL" && (
              <div>
                <h3 className="text-xs font-semibold text-text-muted mb-2">{t("master.equip.sectionComm", "통신설정")}</h3>
                <div className="grid grid-cols-2 gap-3">
                  <Input label={t("master.equip.serialPort", "시리얼 포트")} value={form.serialPort} onChange={(e) => setForm({ ...form, serialPort: e.target.value })} fullWidth leftIcon={<Settings className="w-4 h-4" />} />
                  <Input label="Baud Rate" value={form.baudRate} onChange={(e) => setForm({ ...form, baudRate: e.target.value })} fullWidth />
                </div>
              </div>
            )}
            <div>
              <h3 className="text-xs font-semibold text-text-muted mb-2">{t("master.equip.sectionMaker", "제조정보")}</h3>
              <div className="grid grid-cols-2 gap-3">
                <Input label={t("master.equip.maker", "제조사")} value={form.maker} onChange={(e) => setForm({ ...form, maker: e.target.value })} fullWidth />
                <Input label={t("master.equip.model", "모델명")} value={form.modelName} onChange={(e) => setForm({ ...form, modelName: e.target.value })} fullWidth />
              </div>
            </div>
          </div>
        </div>
      )}

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
    </div>
  );
}
