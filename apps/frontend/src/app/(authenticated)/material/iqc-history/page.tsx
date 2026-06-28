"use client";

/**
 * @file src/app/(authenticated)/material/iqc-history/page.tsx
 * @description IQC 이력조회 페이지 - 수입검사 결과 조회 + 판정 취소
 *
 * 초보자 가이드:
 * 1. **IQC**: Incoming Quality Control (수입검사)
 * 2. **결과**: PASS(합격), FAIL(불합격)
 * 3. **취소**: DONE 상태만 취소 가능 → LOT iqcStatus가 PENDING으로 복원
 * 4. API: GET /material/iqc-history, POST /material/iqc-history/cancel?inspectDate=...&seq=...
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { ClipboardCheck, Search, RefreshCw } from "lucide-react";
import IqcDetailModal, { type IqcDetailRecord } from "./IqcDetailModal";
import { Card, CardContent, Button, Input, Modal } from "@/components/ui";
import ComCodeSelect from "@/components/shared/ComCodeSelect";
import DateRangeFilter from "@/components/shared/DateRangeFilter";
import DataGrid from "@/components/data-grid/DataGrid";
import api from "@/services/api";
import { getTodayLocal } from "@/utils/date";
import { createIqcHistoryGridColumns, getLotNoDisplay, type IqcHistoryItem } from "./iqcHistoryColumns";

const resultColors: Record<string, string> = {
  PASS: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
  FAIL: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
};

export default function IqcHistoryPage() {
  const { t } = useTranslation();

  const [data, setData] = useState<IqcHistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [resultFilter, setResultFilter] = useState("");
  // IQC 이력은 기본적으로 수입검사(INITIAL)만 조회한다. 유수명 재검사(RETEST)는
  // 전용 화면(/material/shelf-life-history)에서 조회하며, 여기서는 검사유형 필터로 선택 시에만 노출한다.
  const [typeFilter, setTypeFilter] = useState("INITIAL");
  const [startDate, setStartDate] = useState(() => getTodayLocal());
  const [endDate, setEndDate] = useState(() => getTodayLocal());

  /** 상세 모달 상태 */
  const [detailRecord, setDetailRecord] = useState<IqcDetailRecord | null>(null);

  /** 취소 모달 상태 */
  const [cancelTarget, setCancelTarget] = useState<IqcHistoryItem | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { limit: "200" };
      if (searchText) params.search = searchText;
      if (resultFilter) params.result = resultFilter;
      if (typeFilter) params.inspectType = typeFilter;
      if (startDate) params.fromDate = startDate;
      if (endDate) params.toDate = endDate;
      const res = await api.get("/material/iqc-history", { params });
      setData(res.data?.data ?? []);
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [searchText, resultFilter, typeFilter, startDate, endDate]);

  useEffect(() => { fetchData(); }, [fetchData]);

  /** 판정 취소 실행 */
  const handleCancel = useCallback(async () => {
    if (!cancelTarget || !cancelReason.trim()) return;
    setCancelling(true);
    try {
      await api.post(
        `/material/iqc-history/cancel?inspectDate=${encodeURIComponent(cancelTarget.inspectDate)}&seq=${cancelTarget.seq}`,
        { reason: cancelReason.trim() },
      );
      setCancelTarget(null);
      setCancelReason("");
      fetchData();
    } catch (err) {
      console.error("IQC 판정 취소 실패:", err);
    } finally {
      setCancelling(false);
    }
  }, [cancelTarget, cancelReason, fetchData]);

  const handleCloseModal = () => {
    setCancelTarget(null);
    setCancelReason("");
  };

  const handleCertUpload = useCallback(async (record: IqcHistoryItem, file: File | null) => {
    if (!file || !record.seq) return;
    const key = `${record.inspectDate}:${record.seq}`;
    setUploadingKey(key);
    try {
      const formData = new FormData();
      formData.append("file", file);
      await api.post(
        `/material/iqc-history/${encodeURIComponent(record.inspectDate)}/${record.seq}/upload-cert`,
        formData,
        { headers: { "Content-Type": "multipart/form-data" } },
      );
      fetchData();
    } finally {
      setUploadingKey(null);
    }
  }, [fetchData]);

  const resultOptions = useMemo(() => [
    { value: "PASS", label: t("material.iqcHistory.pass") },
    { value: "FAIL", label: t("material.iqcHistory.fail") },
  ], [t]);

  const columns = useMemo(() => createIqcHistoryGridColumns({
    t,
    uploadingKey,
    onViewDetail: setDetailRecord,
    onCancel: setCancelTarget,
    onCertUpload: handleCertUpload,
  }), [t, handleCertUpload, uploadingKey]);

  return (
    <div className="h-full flex flex-col overflow-hidden p-6 gap-4 animate-fade-in">
      <div className="flex justify-between items-center flex-shrink-0">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2">
            <ClipboardCheck className="w-7 h-7 text-primary" />
            {t("material.iqcHistory.title")}
          </h1>
          <p className="text-text-muted mt-1">{t("material.iqcHistory.subtitle")}</p>
        </div>
        <Button variant="secondary" size="sm" onClick={fetchData}>
          <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} />{t("common.refresh")}
        </Button>
      </div>

      <Card className="flex-1 min-h-0 overflow-hidden" padding="none"><CardContent className="h-full p-4">
        <DataGrid data={data} columns={columns} isLoading={loading} enableColumnFilter enableExport exportFileName={t("material.iqcHistory.title")}
          toolbarLeft={
            <div className="flex gap-3 flex-1 min-w-0 items-center">
              <div className="w-48 min-w-0 flex-shrink-0">
                <Input placeholder={t("material.iqcHistory.searchPlaceholder")}
                  value={searchText} onChange={e => setSearchText(e.target.value)}
                  leftIcon={<Search className="w-4 h-4" />} fullWidth />
              </div>
              <div className="w-32 flex-shrink-0">
                <ComCodeSelect groupCode="INSPECT_RESULT" labelPrefix={t("material.iqcHistory.result")}
                  value={resultFilter} onChange={setResultFilter} fullWidth />
              </div>
              <div className="w-32 flex-shrink-0">
                <ComCodeSelect groupCode="IQC_INSPECT_TYPE" labelPrefix={t("material.iqcHistory.inspectType")}
                  value={typeFilter} onChange={setTypeFilter} fullWidth />
              </div>
              <DateRangeFilter
                from={startDate}
                to={endDate}
                onFromChange={setStartDate}
                onToChange={setEndDate}
                className="flex-shrink-0"
              />
            </div>
          } 
          sqlQuery={`SELECT *\nFROM IQC_HISTORIES\nWHERE COMPANY = '40'\n  AND PLANT_CD = '1000'\nORDER BY CREATED_AT DESC`}/>
      </CardContent></Card>

      {/* 검사 상세 모달 */}
      <IqcDetailModal record={detailRecord} onClose={() => setDetailRecord(null)} />

      {/* 판정 취소 모달  */}
      <Modal
        isOpen={!!cancelTarget}
        onClose={handleCloseModal}
        title={t("material.iqcHistory.cancelTitle")}
        size="lg"
      >
        <div className="space-y-4">
          {cancelTarget && (
            <div className="p-3 bg-surface-secondary rounded-lg space-y-1 text-sm">
              <p>
                <span className="text-text-muted">LOT No.:</span>{" "}
                {getLotNoDisplay(cancelTarget)}
              </p>
              <p>
                <span className="text-text-muted">{t("common.partName")}:</span>{" "}
                {cancelTarget.itemName}
              </p>
              <p>
                <span className="text-text-muted">{t("material.iqcHistory.result")}:</span>{" "}
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${resultColors[cancelTarget.result] || ""}`}>
                  {cancelTarget.result}
                </span>
              </p>
              <p>
                <span className="text-text-muted">{t("material.iqcHistory.inspector")}:</span>{" "}
                {cancelTarget.inspectorName || "-"}
              </p>
            </div>
          )}
          <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
            <p className="text-sm text-red-700 dark:text-red-400">
              {t("material.iqcHistory.cancelWarning")}
            </p>
          </div>
          <Input
            label={t("material.iqcHistory.cancelReason")}
            placeholder={t("material.iqcHistory.cancelReasonPlaceholder")}
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            fullWidth
          />
          <div className="flex justify-end gap-2 pt-4 border-t border-border">
            <Button variant="secondary" onClick={handleCloseModal}>
              {t("common.cancel")}
            </Button>
            <Button
              variant="danger"
              onClick={handleCancel}
              disabled={!cancelReason.trim() || cancelling}
            >
              {cancelling ? t("common.processing") : t("material.iqcHistory.confirmCancel")}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
