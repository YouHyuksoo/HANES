"use client";

/**
 * @file src/app/(authenticated)/master/gauge/page.tsx
 * @description 계측기 마스터 관리 페이지 — IATF 16949 7.1.5 측정시스템분석(MSA)
 *
 * 초보자 가이드:
 * 1. **DataGrid**: 계측기 목록 (코드, 명칭, 유형, 교정주기, 상태 등)
 * 2. **Modal**: 등록/수정 폼 (계측기 정보 + 교정 정보)
 * 3. **ComCodeBadge**: GAUGE_TYPE(유형), GAUGE_STATUS(상태) 코드값 표시
 * 4. API: GET/POST /quality/msa/gauges, PUT/DELETE /quality/msa/gauges/:id
 */
import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { ColumnDef } from "@tanstack/react-table";
import {
  Plus, RefreshCw, Ruler, Edit2, Trash2,
} from "lucide-react";
import { Card, CardContent, Button, Input, ComCodeBadge, ConfirmModal } from "@/components/ui";
import DataGrid from "@/components/data-grid/DataGrid";
import { ComCodeSelect } from "@/components/shared";
import api from "@/services/api";

/** 계측기 데이터 타입 */
interface Gauge {
  id: number;
  gaugeCode: string;
  gaugeName: string;
  gaugeType: string;
  manufacturer: string;
  model: string;
  serialNo: string;
  resolution: number;
  measureRange: string;
  calibrationCycle: number;
  lastCalibrationDate: string;
  nextCalibrationDate: string;
  status: string;
  location: string;
  responsiblePerson: string;
  createdAt: string;
}

/** 폼 데이터 */
interface FormState {
  gaugeCode: string;
  gaugeName: string;
  gaugeType: string;
  manufacturer: string;
  model: string;
  serialNo: string;
  resolution: string;
  measureRange: string;
  calibrationCycle: string;
  lastCalibrationDate: string;
  nextCalibrationDate: string;
  status: string;
  location: string;
  responsiblePerson: string;
}

const EMPTY_FORM: FormState = {
  gaugeCode: "", gaugeName: "", gaugeType: "", manufacturer: "",
  model: "", serialNo: "", resolution: "", measureRange: "",
  calibrationCycle: "12", lastCalibrationDate: "", nextCalibrationDate: "",
  status: "ACTIVE", location: "", responsiblePerson: "",
};

export default function GaugeMasterPage() {
  const { t } = useTranslation();
  const [data, setData] = useState<Gauge[]>([]);
  const [loading, setLoading] = useState(false);
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [panelOpen, setPanelOpen] = useState(false);
  const [editing, setEditing] = useState<Gauge | null>(null);
  const [selectedRow, setSelectedRow] = useState<Gauge | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [deleteTarget, setDeleteTarget] = useState<Gauge | null>(null);

  /* -- 데이터 조회 -- */
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { limit: "5000" };
      if (typeFilter) params.gaugeType = typeFilter;
      if (statusFilter) params.status = statusFilter;
      const res = await api.get("/quality/msa/gauges", { params });
      setData(res.data?.data ?? []);
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [typeFilter, statusFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  /* -- 등록/수정 패널 -- */
  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setPanelOpen(true);
  };

  const openEdit = (gauge: Gauge) => {
    setEditing(gauge);
    setForm({
      gaugeCode: gauge.gaugeCode,
      gaugeName: gauge.gaugeName,
      gaugeType: gauge.gaugeType,
      manufacturer: gauge.manufacturer ?? "",
      model: gauge.model ?? "",
      serialNo: gauge.serialNo ?? "",
      resolution: gauge.resolution?.toString() ?? "",
      measureRange: gauge.measureRange ?? "",
      calibrationCycle: gauge.calibrationCycle?.toString() ?? "12",
      lastCalibrationDate: gauge.lastCalibrationDate?.slice(0, 10) ?? "",
      nextCalibrationDate: gauge.nextCalibrationDate?.slice(0, 10) ?? "",
      status: gauge.status ?? "ACTIVE",
      location: gauge.location ?? "",
      responsiblePerson: gauge.responsiblePerson ?? "",
    });
    setPanelOpen(true);
  };

  const handleSave = async () => {
    try {
      const payload = {
        gaugeCode: form.gaugeCode,
        gaugeName: form.gaugeName,
        gaugeType: form.gaugeType,
        manufacturer: form.manufacturer || undefined,
        model: form.model || undefined,
        serialNo: form.serialNo || undefined,
        resolution: form.resolution ? Number(form.resolution) : undefined,
        measureRange: form.measureRange || undefined,
        calibrationCycle: Number(form.calibrationCycle) || 12,
        lastCalibrationDate: form.lastCalibrationDate || undefined,
        nextCalibrationDate: form.nextCalibrationDate || undefined,
        status: form.status,
        location: form.location || undefined,
        responsiblePerson: form.responsiblePerson || undefined,
      };
      if (editing) {
        await api.put(`/quality/msa/gauges/${editing.gaugeCode}`, payload);
      } else {
        await api.post("/quality/msa/gauges", payload);
      }
      setPanelOpen(false);
      setEditing(null);
      fetchData();
    } catch (e: unknown) {
      console.error("Save failed:", e);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    try {
      await api.delete(`/quality/msa/gauges/${deleteTarget.gaugeCode}`);
      fetchData();
    } catch (e: unknown) {
      console.error("Delete failed:", e);
    } finally {
      setDeleteTarget(null);
    }
  };

  /* -- 컬럼 정의 -- */
  const columns = useMemo<ColumnDef<Gauge>[]>(() => [
    {
      id: "actions", header: t("common.actions"), size: 80,
      meta: { align: "center" as const },
      cell: ({ row }) => (
        <div className="flex gap-1">
          <button onClick={() => openEdit(row.original)}
            className="p-1 hover:bg-surface rounded">
            <Edit2 className="w-4 h-4 text-primary" />
          </button>
          <button onClick={() => setDeleteTarget(row.original)}
            className="p-1 hover:bg-surface rounded">
            <Trash2 className="w-4 h-4 text-red-500" />
          </button>
        </div>
      ),
    },
    {
      accessorKey: "gaugeCode", header: t("master.gauge.gaugeCode"), size: 130,
      meta: { filterType: "text" as const },
      cell: ({ getValue }) => (
        <span className="text-primary font-medium">{getValue() as string}</span>
      ),
    },
    {
      accessorKey: "gaugeName", header: t("master.gauge.gaugeName"), size: 200,
      meta: { filterType: "text" as const },
    },
    {
      accessorKey: "gaugeType", header: t("master.gauge.gaugeType"), size: 120,
      meta: { filterType: "multi" as const },
      cell: ({ getValue }) => (
        <ComCodeBadge groupCode="GAUGE_TYPE" code={getValue() as string} />
      ),
    },
    {
      accessorKey: "manufacturer", header: t("master.gauge.manufacturer"), size: 120,
      meta: { filterType: "text" as const },
    },
    { accessorKey: "serialNo", header: t("master.gauge.serialNo"), size: 130 },
    { accessorKey: "measureRange", header: t("master.gauge.measureRange"), size: 110 },
    {
      accessorKey: "calibrationCycle", header: t("master.gauge.calibrationCycle"), size: 90,
      cell: ({ getValue }) => (
        <span className="font-mono text-right block">
          {getValue() as number}{t("master.gauge.months")}
        </span>
      ),
    },
    {
      accessorKey: "nextCalibrationDate", header: t("master.gauge.nextCalibrationDate"), size: 120,
      meta: { filterType: "date" as const },
      cell: ({ getValue }) => (getValue() as string)?.slice(0, 10) ?? "-",
    },
    {
      accessorKey: "status", header: t("common.status"), size: 110,
      meta: { filterType: "multi" as const },
      cell: ({ getValue }) => (
        <ComCodeBadge groupCode="GAUGE_STATUS" code={getValue() as string} />
      ),
    },
    { accessorKey: "location", header: t("master.gauge.location"), size: 120 },
  ], [t]);

  const setField = (key: keyof FormState, value: string) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  return (
    <div className="flex h-full">
      {/* 메인 영역 */}
      <div className="flex-1 flex flex-col overflow-hidden p-6 gap-4 animate-fade-in">
        {/* 헤더 */}
        <div className="flex justify-between items-center flex-shrink-0">
          <div>
            <h1 className="text-xl font-bold text-text flex items-center gap-2">
              <Ruler className="w-7 h-7 text-primary" />
              {t("master.gauge.title")}
            </h1>
            <p className="text-text-muted mt-1">{t("master.gauge.subtitle")}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={fetchData}>
              <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} />
              {t("common.refresh")}
            </Button>
            <Button size="sm" onClick={openCreate}>
              <Plus className="w-4 h-4 mr-1" />{t("common.add")}
            </Button>
          </div>
        </div>

        {/* DataGrid */}
        <Card className="flex-1 min-h-0 overflow-hidden" padding="none">
          <CardContent className="h-full p-4">
            <DataGrid data={data} columns={columns} isLoading={loading}
              enableColumnFilter enableExport
              exportFileName={t("master.gauge.title")}
              onRowClick={(row) => {
                const gauge = row as Gauge;
                setSelectedRow(gauge);
                if (panelOpen) openEdit(gauge);
              }}
              getRowId={(row) => (row as Gauge).gaugeCode}
              selectedRowId={selectedRow?.gaugeCode}
              toolbarLeft={
                <div className="flex gap-3 items-center flex-1 min-w-0 flex-wrap">
                  <ComCodeSelect groupCode="GAUGE_TYPE" value={typeFilter}
                    onChange={setTypeFilter}
                    labelPrefix={t("master.gauge.gaugeType")} />
                  <ComCodeSelect groupCode="GAUGE_STATUS" value={statusFilter}
                    onChange={setStatusFilter}
                    labelPrefix={t("common.status")} />
                </div>
              }
            />
          </CardContent>
        </Card>
      </div>

      {/* 우측 슬라이드 패널 */}
      {panelOpen && (
        <div className="w-[480px] border-l border-border bg-background flex flex-col h-full overflow-hidden shadow-2xl text-xs animate-slide-in-right">
          {/* 패널 헤더 */}
          <div className="px-5 py-3 border-b border-border flex items-center justify-between flex-shrink-0">
            <h2 className="text-sm font-bold text-text">
              {editing ? t("common.edit") : t("common.add")}
            </h2>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="secondary" onClick={() => { setPanelOpen(false); setEditing(null); }}>
                {t("common.cancel")}
              </Button>
              <Button size="sm" onClick={handleSave}
                disabled={!form.gaugeCode || !form.gaugeName || !form.gaugeType}>
                {t("common.save")}
              </Button>
            </div>
          </div>
          {/* 패널 본문 */}
          <div className="flex-1 overflow-y-auto min-h-0 px-5 py-3 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Input label={t("master.gauge.gaugeCode")} value={form.gaugeCode}
                onChange={e => setField("gaugeCode", e.target.value)}
                disabled={!!editing} fullWidth />
              <Input label={t("master.gauge.gaugeName")} value={form.gaugeName}
                onChange={e => setField("gaugeName", e.target.value)} fullWidth />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <ComCodeSelect groupCode="GAUGE_TYPE" includeAll={false}
                label={t("master.gauge.gaugeType")} value={form.gaugeType}
                onChange={v => setField("gaugeType", v)} fullWidth />
              <ComCodeSelect groupCode="GAUGE_STATUS" includeAll={false}
                label={t("common.status")} value={form.status}
                onChange={v => setField("status", v)} fullWidth />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input label={t("master.gauge.manufacturer")} value={form.manufacturer}
                onChange={e => setField("manufacturer", e.target.value)} fullWidth />
              <Input label={t("master.gauge.model")} value={form.model}
                onChange={e => setField("model", e.target.value)} fullWidth />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input label={t("master.gauge.serialNo")} value={form.serialNo}
                onChange={e => setField("serialNo", e.target.value)} fullWidth />
              <Input label={t("master.gauge.measureRange")} value={form.measureRange}
                onChange={e => setField("measureRange", e.target.value)}
                placeholder="0~150mm" fullWidth />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input label={t("master.gauge.resolution")} value={form.resolution}
                onChange={e => setField("resolution", e.target.value)}
                placeholder="0.01" type="number" fullWidth />
              <Input label={t("master.gauge.calibrationCycle")} value={form.calibrationCycle}
                onChange={e => setField("calibrationCycle", e.target.value)}
                type="number" fullWidth />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input label={t("master.gauge.lastCalibrationDate")} type="date"
                value={form.lastCalibrationDate}
                onChange={e => setField("lastCalibrationDate", e.target.value)} fullWidth />
              <Input label={t("master.gauge.nextCalibrationDate")} type="date"
                value={form.nextCalibrationDate}
                onChange={e => setField("nextCalibrationDate", e.target.value)} fullWidth />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input label={t("master.gauge.location")} value={form.location}
                onChange={e => setField("location", e.target.value)} fullWidth />
              <Input label={t("master.gauge.responsiblePerson")} value={form.responsiblePerson}
                onChange={e => setField("responsiblePerson", e.target.value)} fullWidth />
            </div>
          </div>
        </div>
      )}

      {/* 삭제 확인 */}
      <ConfirmModal isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm} variant="danger"
        message={`'${deleteTarget?.gaugeName ?? ""}'${t("common.deleteConfirm")}`} />
    </div>
  );
}
