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
import { ClipboardCheck, Search, RefreshCw, XCircle, Upload, ExternalLink, Eye } from "lucide-react";
import IqcDetailModal, { type IqcDetailRecord } from "./IqcDetailModal";
import { Card, CardContent, Button, Input, Modal } from "@/components/ui";
import ComCodeSelect from "@/components/shared/ComCodeSelect";
import DateRangeFilter from "@/components/shared/DateRangeFilter";
import DataGrid from "@/components/data-grid/DataGrid";
import { ColumnDef } from "@tanstack/react-table";
import { useComCodeMap } from "@/hooks/useComCode";
import api from "@/services/api";
import { getTodayLocal } from "@/utils/date";

interface IqcHistoryItem {
  id: string;
  matUid?: string;
  arrivalNo?: string | null;
  itemCode?: string;
  itemName?: string;
  unit?: string;
  vendorCode?: string | null;
  vendorName?: string | null;
  inspectType: string;
  result: string;
  status: string;
  inspectorName?: string;
  inspectDate: string;
  seq?: number;
  remark?: string;
  received?: boolean;
  certFilePath?: string | null;
  sampleBarcode?: string | null;
  details?: string | null;
}

function getCertFileUrl(certFilePath: string | null | undefined): string | null {
  if (!certFilePath) return null;
  const filename = certFilePath.replace(/\\/g, '/').split('/').pop();
  return filename ? `/uploads/iqc-certs/${filename}` : null;
}

const resultColors: Record<string, string> = {
  PASS: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
  FAIL: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
};

const typeColors: Record<string, string> = {
  INITIAL: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
  RETEST: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300",
};

const formatDateTime = (value?: string | null) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
};

const getLotNoDisplay = (record: Pick<IqcHistoryItem, "matUid" | "sampleBarcode">) =>
  record.matUid || record.sampleBarcode || "-";

export default function IqcHistoryPage() {
  const { t } = useTranslation();
  const iqcInspectTypeMap = useComCodeMap("IQC_INSPECT_TYPE");

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

  const columns = useMemo<ColumnDef<IqcHistoryItem>[]>(() => [
    {
      id: "actions",
      header: t("common.actions"),
      size: 140,
      meta: { filterType: "none" as const },
      cell: ({ row }) => {
        const record = row.original;
        const uploadKey = `${record.inspectDate}:${record.seq}`;
        const certUrl = getCertFileUrl(record.certFilePath);
        return (
          <div className="flex items-center gap-1">
            <button
              type="button"
              className="inline-flex h-8 w-8 items-center justify-center rounded text-text-muted hover:bg-surface hover:text-primary"
              title={t("material.iqcHistory.viewDetail", "검사 상세보기")}
              onClick={(e) => { e.stopPropagation(); setDetailRecord(record as IqcDetailRecord); }}
            >
              <Eye className="w-4 h-4" />
            </button>
            {certUrl && (
              <a
                href={certUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-8 w-8 items-center justify-center rounded text-blue-600 hover:bg-surface hover:text-blue-800"
                title={t("material.iqcHistory.viewCert", "검사성적서 열람")}
                onClick={(e) => e.stopPropagation()}
              >
                <ExternalLink className="w-4 h-4" />
              </a>
            )}
            {record.status === "DONE" && record.result === "PASS" && (
              <label
                className={`inline-flex h-8 w-8 items-center justify-center rounded cursor-pointer hover:bg-surface ${
                  record.certFilePath ? "text-green-600" : "text-primary"
                } ${uploadingKey === uploadKey ? "opacity-50 pointer-events-none" : ""}`}
                title={record.certFilePath ? t("material.iqcHistory.reuploadCert", "검사성적서 재업로드") : t("material.iqcHistory.uploadCert", "검사성적서 업로드")}
                onClick={(e) => e.stopPropagation()}
              >
                <Upload className="w-4 h-4" />
                <input
                  type="file"
                  className="hidden"
                  onChange={(e) => {
                    handleCertUpload(record, e.target.files?.[0] ?? null);
                    e.currentTarget.value = "";
                  }}
                />
              </label>
            )}
            {record.status === "DONE" && !record.received && (
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => { e.stopPropagation(); setCancelTarget(record); }}
                className="text-red-500 hover:text-red-700"
                title={t("material.iqcHistory.cancelAction")}
              >
                <XCircle className="w-4 h-4" />
              </Button>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: "inspectDate", header: t("material.iqcHistory.inspectDate"), size: 140, meta: { filterType: "date" as const },
      cell: ({ getValue }) => {
        const d = getValue() as string;
        return formatDateTime(d);
      },
    },
    {
      accessorKey: "certFilePath",
      header: t("material.iqcHistory.cert", "성적서"),
      size: 80,
      meta: { filterType: "multi" as const },
      cell: ({ getValue }) => {
        const url = getCertFileUrl(getValue() as string | null);
        return url
          ? (
            <a href={url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}
              className="px-2 py-0.5 rounded text-xs bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300 hover:bg-green-200 cursor-pointer">
              {t("material.iqcHistory.attached", "첨부")}
            </a>
          )
          : <span className="text-xs text-text-muted">{t("material.iqcHistory.notAttached", "미첨부")}</span>;
      },
    },
    {
      accessorKey: "arrivalNo",
      header: t("material.iqcHistory.arrivalNo", "입하번호"),
      size: 140,
      meta: { filterType: "text" as const },
      cell: ({ getValue }) => <span className="font-mono text-sm">{(getValue() as string) || "-"}</span>,
    },
    {
      id: "lotNo", accessorFn: getLotNoDisplay, header: "LOT No.", size: 180,
      meta: { filterType: "text" as const },
      cell: ({ row }) => {
        const lotNo = getLotNoDisplay(row.original);
        return <span className="font-mono text-sm">{lotNo}</span>;
      },
    },
    {
      accessorKey: "itemCode", header: t("common.partCode"), size: 110,
      meta: { filterType: "text" as const },
      cell: ({ getValue }) => <span className="font-mono text-sm">{(getValue() as string) || "-"}</span>,
    },
    {
      accessorKey: "itemName", header: t("common.partName"), size: 140,
      meta: { filterType: "text" as const },
    },
    {
      accessorKey: "vendorName", header: t("material.arrivalResult.supplier", "공급사"), size: 140,
      meta: { filterType: "text" as const },
      cell: ({ row }) => row.original.vendorName || "-",
    },
    {
      accessorKey: "inspectType", header: t("material.iqcHistory.inspectType"), size: 100, meta: { filterType: "multi" as const },
      cell: ({ getValue }) => {
        const v = getValue() as string;
        const label = iqcInspectTypeMap[v]?.codeName ?? (
          v === "INITIAL" ? t("material.iqcHistory.initial") :
          v === "RETEST" ? t("material.iqcHistory.retest") : v
        );
        return <span className={`px-2 py-0.5 rounded text-xs font-medium ${typeColors[v] || ""}`}>{label}</span>;
      },
    },
    {
      accessorKey: "result", header: t("material.iqcHistory.result"), size: 80, meta: { filterType: "multi" as const },
      cell: ({ getValue }) => {
        const r = getValue() as string;
        return <span className={`px-2 py-0.5 rounded text-xs font-medium ${resultColors[r] || ""}`}>{r}</span>;
      },
    },
    {
      accessorKey: "status", header: t("common.status"), size: 90, meta: { filterType: "multi" as const },
      cell: ({ getValue }) => {
        const s = getValue() as string;
        const isCanceled = s === "CANCELED";
        return (
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
            isCanceled
              ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
              : "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
          }`}>
            {isCanceled ? t("material.iqcHistory.statusCanceled") : t("material.iqcHistory.statusDone")}
          </span>
        );
      },
    },
    {
      accessorKey: "inspectorName", header: t("material.iqcHistory.inspector"), size: 90, meta: { filterType: "text" as const },
      cell: ({ getValue }) => (getValue() as string) || "-",
    },
    {
      accessorKey: "remark", header: t("common.remark"), size: 160,
      meta: { filterType: "text" as const },
      cell: ({ getValue }) => (getValue() as string) || "-",
    },
  ], [t, handleCertUpload, uploadingKey, iqcInspectTypeMap]);

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
