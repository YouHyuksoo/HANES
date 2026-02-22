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

import { useState, useMemo, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { ColumnDef } from "@tanstack/react-table";
import {
  Plus, Edit2, Trash2, Search, RefreshCw, Settings,
  Wifi, Monitor,
} from "lucide-react";
import { Card, CardContent, Button, Input, Select, Modal, ConfirmModal } from "@/components/ui";
import DataGrid from "@/components/data-grid/DataGrid";
import { EquipMaster, EquipType, CommType, COMM_TYPE_COLORS, COMM_TYPE_LABELS } from "../types";
import api from "@/services/api";

interface FormState {
  id?: string;
  equipCode: string;
  equipName: string;
  equipType: EquipType;
  lineCode: string;
  processCode: string;
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

const EMPTY_FORM: FormState = {
  equipCode: "",
  equipName: "",
  equipType: "SINGLE_CUT",
  lineCode: "",
  processCode: "",
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

interface LineOption { value: string; label: string; }
interface ProcessOption { value: string; label: string; }

export default function EquipMasterTab() {
  const { t } = useTranslation();
  const [equipments, setEquipments] = useState<EquipMaster[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [lineFilter, setLineFilter] = useState("");
  const [commFilter, setCommFilter] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<EquipMaster | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [lineOptions, setLineOptions] = useState<LineOption[]>([{ value: "", label: t("common.all") }]);
  const [processOptions, setProcessOptions] = useState<ProcessOption[]>([{ value: "", label: t("common.all") }]);
  const [deleteTarget, setDeleteTarget] = useState<EquipMaster | null>(null);

  // API에서 생산라인 목록 조회
  const fetchLines = useCallback(async () => {
    try {
      const res = await api.get("/equipment/equips/metadata/lines");
      if (res.data.success) {
        const opts: LineOption[] = [
          { value: "", label: t("common.all") },
          ...((res.data.data || []) as { lineCode: string; lineName: string }[]).map(
            (l) => ({ value: l.lineCode, label: `${l.lineCode} ${l.lineName}` })
          ),
        ];
        setLineOptions(opts);
      }
    } catch (e) {
      console.error("Failed to fetch lines:", e);
    }
  }, [t]);

  // API에서 공정 목록 조회
  const fetchProcesses = useCallback(async () => {
    try {
      const res = await api.get("/equipment/equips/metadata/processes");
      if (res.data.success) {
        const opts: ProcessOption[] = [
          { value: "", label: t("common.all") },
          ...((res.data.data || []) as { processCode: string; processName: string }[]).map(
            (p) => ({ value: p.processCode, label: `${p.processCode} ${p.processName}` })
          ),
        ];
        setProcessOptions(opts);
      }
    } catch (e) {
      console.error("Failed to fetch processes:", e);
    }
  }, [t]);

  useEffect(() => { fetchLines(); }, [fetchLines]);
  useEffect(() => { fetchProcesses(); }, [fetchProcesses]);

  // API에서 설비 목록 조회
  const fetchEquipments = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { limit: "100", company: "40" };
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

  const equipTypeOptions = useMemo(() => [
    { value: "", label: t("common.all") },
    { value: "SINGLE_CUT", label: t("master.equip.singleCut", "단선절단") },
    { value: "MULTI_CUT", label: t("master.equip.multiCut", "다선절단") },
    { value: "AUTO_CRIMP", label: t("master.equip.autoCrimp", "압착") },
    { value: "TWIST", label: t("master.equip.twist", "비틀기") },
    { value: "SOLDER", label: t("master.equip.solder", "납땜") },
    { value: "HOUSING", label: t("master.equip.housing", "하우징") },
    { value: "TESTER", label: t("master.equip.tester", "검사기") },
    { value: "LABEL_PRINTER", label: t("master.equip.labelPrinter", "라벨") },
    { value: "INSPECTION", label: t("master.equip.inspection", "검사") },
    { value: "PACKING", label: t("master.equip.packing", "포장") },
    { value: "OTHER", label: t("master.equip.other", "기타") },
  ], [t]);

  const commTypeOptions = useMemo(() => [
    { value: "", label: t("common.all") },
    { value: "NONE", label: "None" },
    { value: "TCP", label: "TCP/IP" },
    { value: "SERIAL", label: "Serial" },
    { value: "MQTT", label: "MQTT" },
  ], [t]);


  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  };

  const openEdit = (equip: EquipMaster) => {
    setEditing(equip);
    setForm({
      id: equip.id,
      equipCode: equip.equipCode,
      equipName: equip.equipName,
      equipType: equip.equipType,
      lineCode: equip.lineCode || "",
      processCode: equip.processCode || "",
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
    setModalOpen(true);
  };

  const handleSave = async () => {
    try {
      const body = {
        equipCode: form.equipCode,
        equipName: form.equipName,
        equipType: form.equipType,
        lineCode: form.lineCode || undefined,
        processCode: form.processCode || undefined,
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
        await api.put(`/equipment/equips/${editing.id}`, body);
      } else {
        await api.post("/equipment/equips", body);
      }
      setModalOpen(false);
      fetchEquipments();
    } catch (e: any) {
      console.error("Save failed:", e);
      alert(e.response?.data?.message || "저장에 실패했습니다.");
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    try {
      await api.delete(`/equipment/equips/${deleteTarget.id}`);
      fetchEquipments();
    } catch (e: any) {
      console.error("Delete failed:", e);
    } finally {
      setDeleteTarget(null);
    }
  };

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
    { accessorKey: "lineCode", header: t("master.equip.line", "라인"), size: 60 },
    { accessorKey: "processCode", header: t("master.equip.process", "공정"), size: 60 },
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
    <>
      <Card>
        <CardContent>
          <DataGrid data={equipments} columns={columns} pageSize={10} isLoading={loading} enableColumnPinning enableExport exportFileName={t("master.equip.title", "설비관리")}
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
                <Select options={equipTypeOptions} value={typeFilter} onChange={setTypeFilter} placeholder={t("master.equip.type", "유형")} />
                <Select options={lineOptions} value={lineFilter} onChange={setLineFilter} placeholder={t("master.equip.line", "라인")} />
                <Select options={commTypeOptions} value={commFilter} onChange={setCommFilter} placeholder={t("master.equip.commType", "통신")} />
                <Button variant="secondary" size="sm" onClick={fetchEquipments}>
                  <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} />
                  {t("common.refresh", "새로고침")}
                </Button>
                <Button size="sm" onClick={openCreate}>
                  <Plus className="w-4 h-4 mr-1" />
                  {t("master.equip.addEquip", "설비 추가")}
                </Button>
              </div>
            } />
        </CardContent>
      </Card>

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? t("master.equip.editEquip", "설비 수정") : t("master.equip.addEquip", "설비 추가")}
        size="lg"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input
              label={t("master.equip.equipCode", "설비코드")}
              value={form.equipCode}
              onChange={(e) => setForm({ ...form, equipCode: e.target.value })}
              placeholder="EQ-001"
              fullWidth
              disabled={!!editing}
            />
            <Input
              label={t("master.equip.equipName", "설비명")}
              value={form.equipName}
              onChange={(e) => setForm({ ...form, equipName: e.target.value })}
              placeholder={t("master.equip.equipName", "설비명")}
              fullWidth
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Select
              label={t("master.equip.type", "유형")}
              options={equipTypeOptions.filter(o => o.value)}
              value={form.equipType}
              onChange={(v) => setForm({ ...form, equipType: v as EquipType })}
              fullWidth
            />
            <Select
              label={t("master.equip.commType", "통신방식")}
              options={commTypeOptions.filter(o => o.value)}
              value={form.commType}
              onChange={(v) => setForm({ ...form, commType: v as CommType })}
              fullWidth
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Select
              label={t("master.equip.line", "라인")}
              options={lineOptions}
              value={form.lineCode}
              onChange={(v) => setForm({ ...form, lineCode: v })}
              fullWidth
            />
            <Select
              label={t("master.equip.process", "공정")}
              options={processOptions}
              value={form.processCode}
              onChange={(v) => setForm({ ...form, processCode: v })}
              fullWidth
            />
          </div>
          {(form.commType === "TCP" || form.commType === "MQTT") && (
            <div className="grid grid-cols-2 gap-4 p-4 bg-background rounded-lg border border-border">
              <Input
                label={t("master.equip.ipAddress", "IP 주소")}
                value={form.ipAddress}
                onChange={(e) => setForm({ ...form, ipAddress: e.target.value })}
                placeholder="192.168.1.100"
                fullWidth
                leftIcon={<Wifi className="w-4 h-4" />}
              />
              <Input
                label={t("master.equip.port", "포트")}
                value={form.port}
                onChange={(e) => setForm({ ...form, port: e.target.value })}
                placeholder={form.commType === "MQTT" ? "1883" : "5000"}
                fullWidth
              />
              {form.commType === "MQTT" && (
                <div className="col-span-2">
                  <Input
                    label="MQTT Topic"
                    value={form.mqttTopic}
                    onChange={(e) => setForm({ ...form, mqttTopic: e.target.value })}
                    placeholder="mes/equip/001"
                    fullWidth
                  />
                </div>
              )}
            </div>
          )}
          {form.commType === "SERIAL" && (
            <div className="grid grid-cols-2 gap-4 p-4 bg-background rounded-lg border border-border">
              <Input
                label={t("master.equip.serialPort", "시리얼 포트")}
                value={form.serialPort}
                onChange={(e) => setForm({ ...form, serialPort: e.target.value })}
                placeholder="COM3"
                fullWidth
                leftIcon={<Settings className="w-4 h-4" />}
              />
              <Input
                label="Baud Rate"
                value={form.baudRate}
                onChange={(e) => setForm({ ...form, baudRate: e.target.value })}
                placeholder="9600"
                fullWidth
              />
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <Input
              label={t("master.equip.maker", "제조사")}
              value={form.maker}
              onChange={(e) => setForm({ ...form, maker: e.target.value })}
              placeholder={t("master.equip.maker", "제조사")}
              fullWidth
            />
            <Input
              label={t("master.equip.model", "모델명")}
              value={form.modelName}
              onChange={(e) => setForm({ ...form, modelName: e.target.value })}
              placeholder={t("master.equip.model", "모델명")}
              fullWidth
            />
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              {t("common.cancel", "취소")}
            </Button>
            <Button onClick={handleSave}>
              {editing ? t("common.edit", "수정") : t("common.add", "등록")}
            </Button>
          </div>
        </div>
      </Modal>

      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        variant="danger"
        message={`'${deleteTarget?.equipName || ""}'을(를) 삭제하시겠습니까?`}
      />
    </>
  );
}
