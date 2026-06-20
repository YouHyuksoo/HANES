"use client";

/**
 * @file src/app/(authenticated)/quality/defect/page.tsx
 * @description 불량관리 페이지 - 불량 등록, 상태 관리, 통계 조회 (백엔드 DEFECT_LOGS 계약 기준)
 *
 * 초보자 가이드:
 * 1. **불량 목록**: 발생시간, 작업지시, 불량코드/명, 수량, 상태, 작업자 표시
 * 2. **필터**: 날짜, 불량유형, 상태(DEFECT_LOG_STATUS)
 * 3. **불량 등록**: 작업지시 + 불량유형 + 수량 + 원인 → 해당 작업지시의 최신 생산실적에 자동 연결
 * 4. **상태 변경**: WAIT → REPAIR/REWORK → DONE/SCRAP
 * 5. API: GET/POST /quality/defect-logs, PATCH /quality/defect-logs/:id/status (id=발생시각|seq 복합식별자)
 */
import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { ColumnDef } from "@tanstack/react-table";
import { Plus, RefreshCw, AlertTriangle, Search, ScanLine } from "lucide-react";
import { Card, CardContent, Button, Input, Modal, ComCodeBadge } from "@/components/ui";
import { ComCodeSelect } from "@/components/shared";
import DataGrid from "@/components/data-grid/DataGrid";
import { useComCodeList } from "@/hooks/useComCode";
import api from "@/services/api";
import toast from "react-hot-toast";
import type { DefectLogStatusValue } from "@harness/shared";

/** API 에러에서 사용자용 메시지 추출 */
function errMessage(e: unknown, fallback: string): string {
  return (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? fallback;
}

type DefectStatus = DefectLogStatusValue;

interface Defect {
  id: string;
  occurAt: string;
  workOrderNo: string | null;
  prodResultNo: string;
  defectCode: string;
  defectName: string | null;
  qty: number;
  status: DefectStatus;
  cause: string | null;
  operator: string | null;
  equipmentNo: string | null;
}

export default function DefectPage() {
  const { t } = useTranslation();
  const [data, setData] = useState<Defect[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const defectTypeCodes = useComCodeList("DEFECT_TYPE");
  const statusCodes = useComCodeList("DEFECT_LOG_STATUS");

  const [searchText, setSearchText] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [defectType, setDefectType] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedDefect, setSelectedDefect] = useState<Defect | null>(null);
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [form, setForm] = useState({ prdUid: "", workOrderNo: "", defectCode: "", qty: "", cause: "" });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { limit: "5000" };
      if (searchText) params.search = searchText;
      if (defectType) params.defectCode = defectType;
      if (statusFilter) params.status = statusFilter;
      if (dateFrom) params.startDate = dateFrom;
      if (dateTo) params.endDate = dateTo;
      const res = await api.get("/quality/defect-logs", { params });
      setData(res.data?.data ?? []);
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [searchText, defectType, statusFilter, dateFrom, dateTo]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const canSave = (form.prdUid.trim() !== "" || form.workOrderNo.trim() !== "") && form.defectCode !== "";

  const handleSave = useCallback(async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      const defectName = defectTypeCodes.find((c) => c.detailCode === form.defectCode)?.codeName;
      await api.post("/quality/defect-logs", {
        ...(form.prdUid.trim() && { prdUid: form.prdUid.trim() }),
        ...(form.workOrderNo.trim() && { workOrderNo: form.workOrderNo.trim() }),
        defectCode: form.defectCode,
        ...(defectName && { defectName }),
        qty: Number(form.qty) || 1,
        ...(form.cause.trim() && { cause: form.cause.trim() }),
      });
      setIsModalOpen(false);
      setForm({ prdUid: "", workOrderNo: "", defectCode: "", qty: "", cause: "" });
      toast.success(t("common.register"));
      fetchData();
    } catch (e) {
      toast.error(errMessage(e, t("common.error")));
    } finally {
      setSaving(false);
    }
  }, [form, canSave, defectTypeCodes, fetchData, t]);

  const handleStatusChange = useCallback(async (newStatus: DefectStatus) => {
    if (!selectedDefect) return;
    try {
      await api.patch(`/quality/defect-logs/${encodeURIComponent(selectedDefect.id)}/status`, { status: newStatus });
      fetchData();
      setIsStatusModalOpen(false);
      setSelectedDefect(null);
    } catch (e) {
      toast.error(errMessage(e, t("common.error")));
    }
  }, [selectedDefect, fetchData, t]);

const columns = useMemo<ColumnDef<Defect>[]>(() => [
    {
      id: "actions", header: t("common.manage"), size: 100, meta: { align: "center" as const, filterType: "none" as const },
      cell: ({ row }) => (
        <button className="p-1 hover:bg-surface rounded text-xs text-primary" onClick={() => { setSelectedDefect(row.original); setIsStatusModalOpen(true); }}>
          {t("quality.defect.changeStatus")}
        </button>
      ),
    },
    { accessorKey: "occurAt", header: t("quality.defect.occurredAt"), size: 150, meta: { filterType: "date" as const }, cell: ({ getValue }) => { const v = getValue() as string; return v ? new Date(v).toLocaleString() : "-"; } },
    { accessorKey: "workOrderNo", header: t("quality.defect.workOrder"), size: 150, meta: { filterType: "text" as const }, cell: ({ getValue }) => <span className="text-primary font-medium">{(getValue() as string) || "-"}</span> },
    { accessorKey: "defectCode", header: t("quality.defect.defectCode"), size: 90, meta: { filterType: "text" as const }, cell: ({ getValue }) => <span className="font-mono text-sm">{(getValue() as string) || "-"}</span> },
    { accessorKey: "defectName", header: t("quality.defect.defectName"), size: 120, meta: { filterType: "text" as const }, cell: ({ getValue }) => (getValue() as string) || "-" },
    { accessorKey: "qty", header: t("quality.defect.quantity"), size: 70, meta: { filterType: "number" as const, align: "right" as const }, cell: ({ getValue }) => <span className="font-mono">{(getValue() as number)?.toLocaleString() ?? 0}</span> },
    { accessorKey: "status", header: t("common.status"), size: 100, meta: { filterType: "multi" as const }, cell: ({ getValue }) => <ComCodeBadge groupCode="DEFECT_LOG_STATUS" code={getValue() as string} /> },
    { accessorKey: "operator", header: t("quality.defect.operator"), size: 90, meta: { filterType: "text" as const }, cell: ({ getValue }) => (getValue() as string) || "-" },
    { accessorKey: "cause", header: t("quality.defect.cause"), size: 140, meta: { filterType: "text" as const }, cell: ({ getValue }) => (getValue() as string) || "-" },
  ], [t]);

  return (
    <div className="h-full flex flex-col overflow-hidden p-6 gap-4 animate-fade-in">
      <div className="flex justify-between items-center flex-shrink-0">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2"><AlertTriangle className="w-7 h-7 text-primary" />{t("quality.defect.title")}</h1>
          <p className="text-text-muted mt-1">{t("quality.defect.description")}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={fetchData}>
            <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} />{t('common.refresh')}
          </Button>
          <Button size="sm" onClick={() => setIsModalOpen(true)}>
            <Plus className="w-4 h-4 mr-1" /> {t("quality.defect.register")}
          </Button>
        </div>
      </div>

<Card className="flex-1 min-h-0 overflow-hidden" padding="none"><CardContent className="h-full p-4">
        <DataGrid
          data={data}
          columns={columns}
          isLoading={loading}
          enableColumnFilter
          enableExport
          exportFileName={t("quality.defect.title")}
          toolbarLeft={
            <div className="flex w-full min-w-0 items-center gap-2 overflow-x-auto whitespace-nowrap">
              <div className="min-w-[180px] flex-1">
                <Input placeholder={t("quality.defect.searchPlaceholder")} value={searchText} onChange={(e) => setSearchText(e.target.value)} leftIcon={<Search className="w-4 h-4" />} fullWidth />
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-32" />
                <span className="text-text-muted">~</span>
                <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-32" />
              </div>
              <div className="w-40 shrink-0">
                <ComCodeSelect groupCode="DEFECT_TYPE" labelPrefix={t('quality.defect.type', '불량유형')} value={defectType} onChange={setDefectType} className="w-full" />
              </div>
              <div className="w-36 shrink-0">
                <ComCodeSelect groupCode="DEFECT_LOG_STATUS" labelPrefix={t('common.status')} value={statusFilter} onChange={setStatusFilter} className="w-full" />
              </div>
            </div>
          }

        sqlQuery={`SELECT *\nFROM DEFECT_LOGS\nWHERE COMPANY = '40'\n  AND PLANT_CD = '1000'\nORDER BY OCCUR_TIME DESC`}/>
      </CardContent></Card>

      <Modal isOpen={isModalOpen} onClose={() => { setIsModalOpen(false); setForm({ prdUid: "", workOrderNo: "", defectCode: "", qty: "", cause: "" }); }} title={t("quality.defect.register")} size="lg">
        <div className="space-y-4">
          {/* 제품 바코드 스캔 (주 식별자) */}
          <div>
            <label className="block text-sm font-medium text-text mb-1">{t("quality.defect.productBarcode")}</label>
            <Input
              autoFocus
              placeholder={t("quality.defect.productBarcodePlaceholder")}
              value={form.prdUid}
              onChange={(e) => setForm((p) => ({ ...p, prdUid: e.target.value }))}
              onKeyDown={(e) => { if (e.key === "Enter") e.preventDefault(); }}
              leftIcon={<ScanLine className="w-4 h-4" />}
              className="font-mono"
              fullWidth
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label={t("quality.defect.workOrderNoOptional")} placeholder="WO-XXXX" value={form.workOrderNo} onChange={(e) => setForm((p) => ({ ...p, workOrderNo: e.target.value }))} fullWidth />
            <ComCodeSelect label={t("quality.defect.defectType")} groupCode="DEFECT_TYPE" includeAll={false} value={form.defectCode} onChange={(v) => setForm((p) => ({ ...p, defectCode: v }))} fullWidth />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label={t("quality.defect.quantity")} type="number" min="1" placeholder="1" value={form.qty} onChange={(e) => setForm((p) => ({ ...p, qty: e.target.value }))} fullWidth />
            <Input label={t("quality.defect.cause")} placeholder={t("quality.defect.causePlaceholder")} value={form.cause} onChange={(e) => setForm((p) => ({ ...p, cause: e.target.value }))} fullWidth />
          </div>
          <p className="text-xs text-text-muted bg-surface/50 border border-border/50 rounded p-2">
            {t("quality.defect.registerHint")}
          </p>
          <div className="flex justify-end gap-2 pt-4 mt-4 border-t border-border">
            <Button variant="secondary" onClick={() => { setIsModalOpen(false); setForm({ prdUid: "", workOrderNo: "", defectCode: "", qty: "", cause: "" }); }}>{t("common.cancel")}</Button>
            <Button onClick={handleSave} disabled={saving || !canSave}>{saving ? t("common.saving") : t("common.register")}</Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={isStatusModalOpen} onClose={() => { setIsStatusModalOpen(false); setSelectedDefect(null); }} title={t("quality.defect.changeStatus")} size="md">
        {selectedDefect && (
          <div className="space-y-4">
            <div className="p-4 bg-background rounded-lg">
              <div className="text-sm text-text-muted">{t("quality.defect.selectedDefect")}</div>
              <div className="text-base font-semibold text-text mt-1">{selectedDefect.workOrderNo || selectedDefect.prodResultNo}</div>
              <div className="text-sm text-text-muted mt-2">{selectedDefect.defectName || selectedDefect.defectCode} / {t("quality.defect.quantity")}: {selectedDefect.qty}{t("common.ea")}</div>
              <div className="mt-2"><ComCodeBadge groupCode="DEFECT_LOG_STATUS" code={selectedDefect.status} /></div>
            </div>
            <div className="text-sm font-medium text-text mb-2">{t("quality.defect.selectStatus")}</div>
            <div className="grid grid-cols-2 gap-2">
              {statusCodes.map((s) => (
                <Button key={s.detailCode} variant="secondary"
                  onClick={() => handleStatusChange(s.detailCode as DefectStatus)}
                  disabled={selectedDefect.status === s.detailCode}>
                  {s.codeName}
                </Button>
              ))}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
