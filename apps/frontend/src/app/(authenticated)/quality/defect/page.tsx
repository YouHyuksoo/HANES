"use client";

/**
 * @file src/app/(authenticated)/quality/defect/page.tsx
 * @description 불량관리 페이지 - 불량 등록, 상태 관리, 통계 조회
 *
 * 초보자 가이드:
 * 1. **불량 목록**: DataGrid로 발생시간, 작업지시, 불량코드 등 표시
 * 2. **필터**: 날짜, 불량유형, 상태로 필터링
 * 3. **불량 등록**: 모달을 통해 새 불량 등록
 * 4. **상태 변경**: 수리대기 -> 수리중 -> 완료/폐기
 * 5. API: GET/POST/PUT /quality/defects
 */
import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { ColumnDef } from "@tanstack/react-table";
import { Plus, RefreshCw, AlertTriangle, Wrench, CheckCircle, XCircle, Trash2, Calendar, Clock, Search } from "lucide-react";
import { Card, CardContent, Button, Input, Modal, Select, ComCodeBadge, StatCard } from "@/components/ui";
import DataGrid from "@/components/data-grid/DataGrid";
import { useComCodeOptions } from "@/hooks/useComCode";
import api from "@/services/api";

type DefectStatus = "PENDING" | "REPAIRING" | "COMPLETED" | "SCRAPPED";

interface Defect {
  id: string;
  occurredAt: string;
  workOrderNo: string;
  defectCode: string;
  defectName: string;
  quantity: number;
  status: DefectStatus;
  partNo: string;
  equipmentNo: string;
  operator: string;
  remark?: string;
}

export default function DefectPage() {
  const { t } = useTranslation();
  const [data, setData] = useState<Defect[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const defectTypes = useMemo(() => [
    { value: "", label: t("quality.defect.allTypes") },
    { value: "D001", label: t("quality.defect.typeCoating") },
    { value: "D002", label: t("quality.defect.typeCrimping") },
    { value: "D003", label: t("quality.defect.typeContinuity") },
    { value: "D004", label: t("quality.defect.typeAppearance") },
  ], [t]);

  const comCodeStatusOptions = useComCodeOptions("DEFECT_STATUS");
  const statusOptions = useMemo(() => [{ value: "", label: t("common.allStatus") }, ...comCodeStatusOptions], [t, comCodeStatusOptions]);

  const [searchText, setSearchText] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [defectType, setDefectType] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedDefect, setSelectedDefect] = useState<Defect | null>(null);
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [form, setForm] = useState({ workOrderNo: "", defectCode: "", quantity: "", partNo: "", equipmentNo: "", operator: "", remark: "" });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { limit: "5000" };
      if (searchText) params.search = searchText;
      if (defectType) params.defectCode = defectType;
      if (statusFilter) params.status = statusFilter;
      if (dateFrom) params.dateFrom = dateFrom;
      if (dateTo) params.dateTo = dateTo;
      const res = await api.get("/quality/defects", { params });
      setData(res.data?.data ?? []);
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [searchText, defectType, statusFilter, dateFrom, dateTo]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await api.post("/quality/defects", form);
      setIsModalOpen(false);
      setForm({ workOrderNo: "", defectCode: "", quantity: "", partNo: "", equipmentNo: "", operator: "", remark: "" });
      fetchData();
    } catch (e) {
      console.error("Save failed:", e);
    } finally {
      setSaving(false);
    }
  }, [form, fetchData]);

  const handleStatusChange = useCallback(async (newStatus: DefectStatus) => {
    if (!selectedDefect) return;
    try {
      await api.put(`/quality/defects/${selectedDefect.id}/status`, { status: newStatus });
      fetchData();
    } catch (e) {
      console.error("Status change failed:", e);
    }
    setIsStatusModalOpen(false);
    setSelectedDefect(null);
  }, [selectedDefect, fetchData]);

  const stats = useMemo(() => {
    const total = data.length;
    const pending = data.filter((d) => d.status === "PENDING").length;
    const repairing = data.filter((d) => d.status === "REPAIRING").length;
    const completed = data.filter((d) => d.status === "COMPLETED").length;
    const totalQty = data.reduce((sum, d) => sum + d.quantity, 0);
    return { total, pending, repairing, completed, totalQty };
  }, [data]);

  const columns = useMemo<ColumnDef<Defect>[]>(() => [
    { accessorKey: "occurredAt", header: t("quality.defect.occurredAt"), size: 140 },
    { accessorKey: "workOrderNo", header: t("quality.defect.workOrder"), size: 160, meta: { filterType: "text" as const }, cell: ({ getValue }) => <span className="text-primary font-medium">{getValue() as string}</span> },
    { accessorKey: "defectCode", header: t("quality.defect.defectCode"), size: 80 },
    { accessorKey: "defectName", header: t("quality.defect.defectName"), size: 100, meta: { filterType: "text" as const } },
    { accessorKey: "quantity", header: t("quality.defect.quantity"), size: 60, cell: ({ getValue }) => <span className="font-mono text-right block">{getValue() as number}</span> },
    { accessorKey: "status", header: t("common.status"), size: 100, cell: ({ getValue }) => <ComCodeBadge groupCode="DEFECT_STATUS" code={getValue() as string} /> },
    { accessorKey: "operator", header: t("quality.defect.operator"), size: 80 },
    {
      id: "actions", header: t("common.manage"), size: 100,
      cell: ({ row }) => (
        <button className="p-1 hover:bg-surface rounded text-xs text-primary" onClick={() => { setSelectedDefect(row.original); setIsStatusModalOpen(true); }}>
          {t("quality.defect.changeStatus")}
        </button>
      ),
    },
  ], [t]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2"><AlertTriangle className="w-7 h-7 text-primary" />{t("quality.defect.title")}</h1>
          <p className="text-text-muted mt-1">{t("quality.defect.description")}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={fetchData}>
            <RefreshCw className="w-4 h-4 mr-1" />{t('common.refresh')}
          </Button>
          <Button size="sm" onClick={() => setIsModalOpen(true)}>
            <Plus className="w-4 h-4 mr-1" /> {t("quality.defect.register")}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatCard label={t("quality.defect.totalCount")} value={stats.total} icon={AlertTriangle} color="blue" />
        <StatCard label={t("quality.defect.pending")} value={stats.pending} icon={Clock} color="yellow" />
        <StatCard label={t("quality.defect.repairing")} value={stats.repairing} icon={Wrench} color="blue" />
        <StatCard label={t("quality.defect.completedStat")} value={stats.completed} icon={CheckCircle} color="green" />
        <StatCard label={t("quality.defect.totalDefectQty")} value={stats.totalQty} icon={XCircle} color="red" />
      </div>

      <Card><CardContent>
        <DataGrid
          data={data}
          columns={columns}
          isLoading={loading}
          enableColumnFilter
          enableExport
          exportFileName={t("quality.defect.title")}
          toolbarLeft={
            <div className="flex gap-3 items-center flex-1 min-w-0 flex-wrap">
              <div className="flex-1 min-w-[200px]">
                <Input placeholder={t("quality.defect.searchPlaceholder")} value={searchText} onChange={(e) => setSearchText(e.target.value)} leftIcon={<Search className="w-4 h-4" />} fullWidth />
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-text-muted" />
                <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-36" />
                <span className="text-text-muted">~</span>
                <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-36" />
              </div>
              <Select options={defectTypes} value={defectType} onChange={setDefectType} placeholder={t("quality.defect.defectType")} />
              <Select options={statusOptions} value={statusFilter} onChange={setStatusFilter} placeholder={t("common.status")} />
            </div>
          }
        />
      </CardContent></Card>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={t("quality.defect.register")} size="lg">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label={t("quality.defect.workOrderNo")} placeholder="WO-2024-XXXX" value={form.workOrderNo} onChange={(e) => setForm((p) => ({ ...p, workOrderNo: e.target.value }))} fullWidth />
            <Select label={t("quality.defect.defectType")} options={defectTypes.filter((d) => d.value !== "")} value={form.defectCode} onChange={(v) => setForm((p) => ({ ...p, defectCode: v }))} fullWidth />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label={t("quality.defect.partNo")} placeholder={t("quality.defect.partNoPlaceholder")} value={form.partNo} onChange={(e) => setForm((p) => ({ ...p, partNo: e.target.value }))} fullWidth />
            <Input label={t("quality.defect.quantity")} type="number" placeholder="0" value={form.quantity} onChange={(e) => setForm((p) => ({ ...p, quantity: e.target.value }))} fullWidth />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label={t("quality.defect.equipmentNo")} placeholder={t("quality.defect.equipmentNo")} value={form.equipmentNo} onChange={(e) => setForm((p) => ({ ...p, equipmentNo: e.target.value }))} fullWidth />
            <Input label={t("quality.defect.operator")} placeholder={t("quality.defect.operatorPlaceholder")} value={form.operator} onChange={(e) => setForm((p) => ({ ...p, operator: e.target.value }))} fullWidth />
          </div>
          <Input label={t("common.remark")} placeholder={t("quality.defect.remarkPlaceholder")} value={form.remark} onChange={(e) => setForm((p) => ({ ...p, remark: e.target.value }))} fullWidth />
          <div className="flex justify-end gap-2 pt-4 mt-4 border-t border-border">
            <Button variant="secondary" onClick={() => setIsModalOpen(false)}>{t("common.cancel")}</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? t("common.saving") : t("common.register")}</Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={isStatusModalOpen} onClose={() => { setIsStatusModalOpen(false); setSelectedDefect(null); }} title={t("quality.defect.changeStatus")} size="md">
        {selectedDefect && (
          <div className="space-y-4">
            <div className="p-4 bg-background rounded-lg">
              <div className="text-sm text-text-muted">{t("quality.defect.selectedDefect")}</div>
              <div className="text-lg font-semibold text-text mt-1">{selectedDefect.id}</div>
              <div className="text-sm text-text-muted mt-2">{selectedDefect.defectName} / {t("quality.defect.quantity")}: {selectedDefect.quantity}{t("common.ea")}</div>
              <div className="mt-2"><ComCodeBadge groupCode="DEFECT_STATUS" code={selectedDefect.status} /></div>
            </div>
            <div className="text-sm font-medium text-text mb-2">{t("quality.defect.selectStatus")}</div>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="secondary" onClick={() => handleStatusChange("PENDING")} disabled={selectedDefect.status === "PENDING"}>
                <AlertTriangle className="w-4 h-4 mr-1 text-yellow-500" />{t("quality.defect.pending")}
              </Button>
              <Button variant="secondary" onClick={() => handleStatusChange("REPAIRING")} disabled={selectedDefect.status === "REPAIRING"}>
                <Wrench className="w-4 h-4 mr-1 text-blue-500" />{t("quality.defect.repairing")}
              </Button>
              <Button variant="secondary" onClick={() => handleStatusChange("COMPLETED")} disabled={selectedDefect.status === "COMPLETED"}>
                <CheckCircle className="w-4 h-4 mr-1 text-green-500" />{t("quality.defect.completedStat")}
              </Button>
              <Button variant="secondary" onClick={() => handleStatusChange("SCRAPPED")} disabled={selectedDefect.status === "SCRAPPED"}>
                <Trash2 className="w-4 h-4 mr-1 text-red-500" />{t("quality.defect.scrapped")}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
