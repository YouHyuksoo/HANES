"use client";

/**
 * @file src/app/(authenticated)/quality/defect/page.tsx
 * @description 불량관리 페이지 - 불량 등록, 상태 관리, 통계 조회 (백엔드 DEFECT_LOGS 계약 기준)
 *
 * 초보자 가이드:
 * 1. **불량 목록**: 발생시간, 작업지시, 불량코드/명, 수량, 상태, 작업자 표시
 * 2. **필터**: 날짜, 불량유형, 상태(DEFECT_LOG_STATUS)
 * 3. **불량 등록**: 우측 슬라이드 패널(검사불량 입력과 동일 패턴) — 작업지시/제품바코드 + 불량유형(등급/범위) + 수량 + 원인
 * 4. **상태 변경**: WAIT → REPAIR/REWORK → DONE/SCRAP
 * 5. API: GET/POST /quality/defect-logs, PATCH /quality/defect-logs/:id/status (id=발생시각|seq 복합식별자)
 */
import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Plus, RefreshCw, AlertTriangle, Search } from "lucide-react";
import { Card, CardContent, Button, Input, Modal, ComCodeBadge, Select } from "@/components/ui";
import { ComCodeSelect } from "@/components/shared";
import DateRangeFilter from "@/components/shared/DateRangeFilter";
import DataGrid from "@/components/data-grid/DataGrid";
import { useComCodeList } from "@/hooks/useComCode";
import api from "@/services/api";
import toast from "react-hot-toast";
import { getTodayLocal } from "@/utils/date";
import DefectFormPanel, { type DefectCodeOption } from "./components/DefectFormPanel";
import { createDefectGridColumns } from "./defectColumns";
import type { Defect, DefectStatus } from "./types";

/** API 에러에서 사용자용 메시지 추출 */
function errMessage(e: unknown, fallback: string): string {
  return (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? fallback;
}

export default function DefectPage() {
  const { t } = useTranslation();
  const [data, setData] = useState<Defect[]>([]);
  const [loading, setLoading] = useState(false);

  const [defectCodeOptions, setDefectCodeOptions] = useState<DefectCodeOption[]>([]);
  const [defectCodeLoading, setDefectCodeLoading] = useState(false);
  const statusCodes = useComCodeList("DEFECT_LOG_STATUS");

  const [searchText, setSearchText] = useState("");
  const [fromDate, setDateFrom] = useState(() => getTodayLocal());
  const [toDate, setDateTo] = useState(() => getTodayLocal());
  const [defectType, setDefectType] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [selectedDefect, setSelectedDefect] = useState<Defect | null>(null);
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [deletingDefect, setDeletingDefect] = useState<Defect | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  const fetchDefectCodeOptions = useCallback(async () => {
    setDefectCodeLoading(true);
    try {
      const res = await api.get("/quality/defect-codes/options", { params: { defectScope: "PROCESS" } });
      setDefectCodeOptions(Array.isArray(res.data?.data) ? res.data.data : []);
    } catch {
      setDefectCodeOptions([]);
    } finally {
      setDefectCodeLoading(false);
    }
  }, []);

  useEffect(() => { fetchDefectCodeOptions(); }, [fetchDefectCodeOptions]);

  const defectFilterOptions = useMemo(() => [
    { value: "", label: `${t("quality.defect.type", "불량유형")}: ${t("common.all", "전체")}` },
    ...defectCodeOptions.map((code) => ({
      value: code.defectCode,
      label: `${t("quality.defect.type", "불량유형")}: ${code.defectCode} - ${code.defectName}`,
    })),
  ], [defectCodeOptions, t]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { limit: "5000" };
      if (searchText) params.search = searchText;
      if (defectType) params.defectCode = defectType;
      if (statusFilter) params.status = statusFilter;
      if (fromDate) params.fromDate = fromDate;
      if (toDate) params.toDate = toDate;
      const res = await api.get("/quality/defect-logs", { params });
      setData(res.data?.data ?? []);
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [searchText, defectType, statusFilter, fromDate, toDate]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const openPanel = useCallback(() => { setIsPanelOpen(true); }, []);

  const handlePanelClose = useCallback(() => { setIsPanelOpen(false); }, []);

  const handlePanelSave = useCallback(() => {
    fetchData();
  }, [fetchData]);

  const handleDelete = useCallback(async () => {
    if (!deletingDefect) return;
    try {
      await api.delete(`/quality/defect-logs/${encodeURIComponent(deletingDefect.id)}`);
      toast.success(t("quality.defect.deleteSuccess", "불량 등록이 취소되었습니다."));
      fetchData();
    } catch (e) {
      toast.error(errMessage(e, t("common.error")));
    } finally {
      setIsDeleteModalOpen(false);
      setDeletingDefect(null);
    }
  }, [deletingDefect, fetchData, t]);

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

  const columns = useMemo(() => createDefectGridColumns({
    t,
    onOpenStatusModal: (defect) => {
      setSelectedDefect(defect);
      setIsStatusModalOpen(true);
    },
    onOpenDeleteModal: (defect) => {
      setDeletingDefect(defect);
      setIsDeleteModalOpen(true);
    },
  }), [t]);

  return (
    <div className="flex h-full animate-fade-in">
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden p-6 gap-4">
        <div className="flex justify-between items-center flex-shrink-0">
          <div>
            <h1 className="text-xl font-bold text-text flex items-center gap-2"><AlertTriangle className="w-7 h-7 text-primary" />{t("quality.defect.title")}</h1>
            <p className="text-text-muted mt-1">{t("quality.defect.description")}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={fetchData}>
              <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} />{t('common.refresh')}
            </Button>
            <Button size="sm" onClick={openPanel}>
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
                <DateRangeFilter
                  from={fromDate}
                  to={toDate}
                  onFromChange={setDateFrom}
                  onToChange={setDateTo}
                  className="shrink-0"
                />
                <div className="w-40 shrink-0">
                  <Select options={defectFilterOptions} value={defectType} onChange={setDefectType} className="w-full" disabled={defectCodeLoading} />
                </div>
                <div className="w-36 shrink-0">
                  <ComCodeSelect groupCode="DEFECT_LOG_STATUS" labelPrefix={t('common.status')} value={statusFilter} onChange={setStatusFilter} className="w-full" />
                </div>
              </div>
            }

          sqlQuery={`SELECT *\nFROM DEFECT_LOGS\nWHERE COMPANY = '40'\n  AND PLANT_CD = '1000'\nORDER BY OCCUR_TIME DESC`}/>
        </CardContent></Card>
      </div>

      {/* 우측: 불량 등록 패널 — 너비 트랜지션으로 열고 닫음 */}
      <DefectFormPanel
        isOpen={isPanelOpen}
        defectCodeOptions={defectCodeOptions}
        defectCodeLoading={defectCodeLoading}
        onClose={handlePanelClose}
        onSave={handlePanelSave}
      />

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

      <Modal isOpen={isDeleteModalOpen} onClose={() => { setIsDeleteModalOpen(false); setDeletingDefect(null); }} title={t("quality.defect.cancelRegistration", "등록취소")} size="md">
        {deletingDefect && (
          <div className="space-y-4">
            <p className="text-sm text-text">
              {t("quality.defect.deleteConfirm", "아래 불량 기록을 취소(삭제)합니다. 이 작업은 되돌릴 수 없습니다.")}
            </p>
            <div className="rounded-lg bg-surface p-3 text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-text-muted">{t("quality.defect.occurredAt", "발생시각")}</span>
                <span>{deletingDefect.occurAt ? new Date(deletingDefect.occurAt).toLocaleString() : "-"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">{t("quality.defect.defectCode", "불량코드")}</span>
                <span className="font-mono">{deletingDefect.defectCode}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">{t("quality.defect.defectName", "불량명")}</span>
                <span>{deletingDefect.defectName || "-"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">{t("quality.defect.quantity", "수량")}</span>
                <span className="font-mono">{deletingDefect.qty}</span>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => { setIsDeleteModalOpen(false); setDeletingDefect(null); }}>
                {t("common.cancel", "취소")}
              </Button>
              <Button variant="danger" onClick={handleDelete}>
                {t("quality.defect.confirmDelete", "등록 취소 확인")}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
