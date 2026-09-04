"use client";

/**
 * @file src/app/(authenticated)/interface/log/page.tsx
 * @description ERP 인터페이스 이력 조회 페이지
 *
 * 초보자 가이드:
 * 1. **인터페이스 로그**: ERP ↔ MES 데이터 송수신 이력 조회
 * 2. **방향**: IN(수신), OUT(송신)
 * 3. **상태**: SUCCESS(성공), FAIL(실패), PENDING(대기), RETRY(재시도)
 * 4. API: GET /interface/logs, POST /interface/logs/{id}/retry
 */
import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { RefreshCw, Search, RotateCcw, ArrowDownCircle, ArrowUpCircle, Network } from "lucide-react";
import { Card, CardContent, Button, Input, Modal, Select } from "@/components/ui";
import DataGrid from "@/components/data-grid/DataGrid";
import DateRangeFilter from "@/components/shared/DateRangeFilter";
import ServerPager from "@/components/shared/ServerPager";
import api from "@/services/api";
import { getTodayLocal } from "@/utils/date";
import { createInterfaceLogGridColumns } from "./interfaceLogColumns";
import type { InterLog } from "./types";

/** 서버 페이지 크기 */
const PAGE_SIZE = 200;

const statusColors: Record<string, string> = {
  SUCCESS: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  FAIL: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
  PENDING: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
  RETRY: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
};

export default function InterfaceLogPage() {
  const { t } = useTranslation();
  const [data, setData] = useState<InterLog[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  const statusLabels: Record<string, string> = useMemo(() => ({
    SUCCESS: t("interface.log.statusSuccess"),
    FAIL: t("interface.log.statusFail"),
    PENDING: t("interface.log.statusPending"),
    RETRY: t("interface.log.statusRetry"),
  }), [t]);

  const messageTypeLabels: Record<string, string> = useMemo(() => ({
    JOB_ORDER: t("interface.dashboard.msgJobOrder"),
    PROD_RESULT: t("interface.dashboard.msgProdResult"),
    BOM_SYNC: t("interface.dashboard.msgBomSync"),
    PART_SYNC: t("interface.dashboard.msgPartSync"),
    STOCK_SYNC: t("interface.log.msgStockSync"),
  }), [t]);

  const [searchTerm, setSearchTerm] = useState("");
  const [directionFilter, setDirectionFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  // 송수신일 구간 — 이력성 화면은 날짜 구간이 필수, 기본 당일
  const [fromDate, setFromDate] = useState(() => getTodayLocal());
  const [toDate, setToDate] = useState(() => getTodayLocal());
  const [page, setPage] = useState(1);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedLog, setSelectedLog] = useState<InterLog | null>(null);

  useEffect(() => { setPage(1); }, [searchTerm, directionFilter, statusFilter, fromDate, toDate]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { page: String(page), limit: String(PAGE_SIZE) };
      if (searchTerm) params.search = searchTerm;
      if (directionFilter) params.direction = directionFilter;
      if (statusFilter) params.status = statusFilter;
      if (fromDate) params.fromDate = fromDate;
      if (toDate) params.toDate = toDate;
      const res = await api.get("/interface/logs", { params });
      setData(res.data?.data ?? []);
      setTotal(Number(res.data?.meta?.total ?? 0));
    } catch {
      setData([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, searchTerm, directionFilter, statusFilter, fromDate, toDate]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleRetry = useCallback(async (logId: string) => {
    try {
      await api.post(`/interface/logs/${logId}/retry`);
      fetchData();
    } catch (e) {
      console.error("Retry failed:", e);
    }
  }, [fetchData]);

  const columns = useMemo(() => createInterfaceLogGridColumns({
    t,
    messageTypeLabels,
    onShowDetail: (log) => {
      setSelectedLog(log);
      setIsDetailModalOpen(true);
    },
    onRetry: handleRetry,
  }), [t, messageTypeLabels, handleRetry]);

  return (
    <div className="h-full flex flex-col overflow-hidden p-6 gap-4 animate-fade-in">
      <div className="flex justify-between items-center flex-shrink-0">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2"><Network className="w-7 h-7 text-primary" />{t("interface.log.title")}</h1>
          <p className="text-text-muted mt-1">{t("interface.log.description")}</p>
        </div>
        <div className="flex items-center gap-3">
          <ServerPager page={page} limit={PAGE_SIZE} total={total} onPageChange={setPage} />
          <Button variant="secondary" size="sm" onClick={fetchData}>
            <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} />{t("common.refresh")}
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
          exportFileName={t("interface.log.title")}
          toolbarLeft={
            <div className="flex gap-3 flex-1 min-w-0">
              <DateRangeFilter
                from={fromDate}
                to={toDate}
                onFromChange={setFromDate}
                onToChange={setToDate}
                presets
                className="flex-shrink-0"
              />
              <div className="flex-1 min-w-0">
                <Input placeholder={t("interface.log.searchPlaceholder")} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} leftIcon={<Search className="w-4 h-4" />} fullWidth />
              </div>
              <Select options={[{ value: "", label: `${t("interface.log.direction")}: ${t("common.all")}` }, { value: "IN", label: `${t("interface.log.direction")}: ${t("interface.log.directionIn")}` }, { value: "OUT", label: `${t("interface.log.direction")}: ${t("interface.log.directionOut")}` }]} value={directionFilter} onChange={setDirectionFilter} placeholder={t("interface.log.direction")} />
              <Select options={[{ value: "", label: `${t("common.status")}: ${t("common.all")}` }, { value: "SUCCESS", label: `${t("common.status")}: ${t("interface.log.statusSuccess")}` }, { value: "FAIL", label: `${t("common.status")}: ${t("interface.log.statusFail")}` }, { value: "PENDING", label: `${t("common.status")}: ${t("interface.log.statusPending")}` }, { value: "RETRY", label: `${t("common.status")}: ${t("interface.log.statusRetry")}` }]} value={statusFilter} onChange={setStatusFilter} placeholder={t("common.status")} />
            </div>
          }
        
        sqlQuery={`SELECT *\nFROM IF_LOGS\nWHERE COMPANY = '40'\n  AND PLANT_CD = '1000'\nORDER BY CREATED_AT DESC`}/>
      </CardContent></Card>

      <Modal isOpen={isDetailModalOpen} onClose={() => setIsDetailModalOpen(false)} title={t("interface.log.detailTitle")} size="lg">
        {selectedLog && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-text-muted">{t("interface.log.direction")}</p>
                <p className="font-medium text-text flex items-center gap-2">
                  {selectedLog.direction === "IN" ? <><ArrowDownCircle className="w-5 h-5 text-blue-500" />{t("interface.log.directionInDetail")}</> : <><ArrowUpCircle className="w-5 h-5 text-purple-500" />{t("interface.log.directionOutDetail")}</>}
                </p>
              </div>
              <div><p className="text-sm text-text-muted">{t("interface.log.messageType")}</p><p className="font-medium text-text">{messageTypeLabels[selectedLog.messageType]}</p></div>
              <div><p className="text-sm text-text-muted">{t("interface.log.interfaceId")}</p><p className="font-medium text-text">{selectedLog.interfaceId}</p></div>
              <div><p className="text-sm text-text-muted">{t("common.status")}</p><span className={`px-2 py-1 text-xs rounded-full ${statusColors[selectedLog.status]}`}>{statusLabels[selectedLog.status]}</span></div>
              <div><p className="text-sm text-text-muted">{t("common.createdAt")}</p><p className="font-medium text-text">{selectedLog.createdAt}</p></div>
              <div><p className="text-sm text-text-muted">{t("interface.log.recvTime")}</p><p className="font-medium text-text">{selectedLog.recvAt || "-"}</p></div>
              <div><p className="text-sm text-text-muted">{t("interface.log.retryCount")}</p><p className="font-medium text-text">{selectedLog.retryCount}{t("common.count")}</p></div>
            </div>

            {selectedLog.errorMsg && (
              <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                <p className="text-sm font-medium text-red-700 dark:text-red-400">{t("interface.log.errorMsg")}</p>
                <p className="text-sm text-red-600 dark:text-red-300 mt-1">{selectedLog.errorMsg}</p>
              </div>
            )}

            {selectedLog.status === "FAIL" && (
              <div className="flex justify-end">
                <Button onClick={() => { handleRetry(selectedLog.id); setIsDetailModalOpen(false); }}>
                  <RotateCcw className="w-4 h-4 mr-1" /> {t("interface.log.retry")}
                </Button>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
