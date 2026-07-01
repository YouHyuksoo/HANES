"use client";

/**
 * @file quality/inspect/components/VisualInspectPanel.tsx
 * @description 외관검사 우측 패널 - 제품 바코드 스캔 → PASS/FAIL 판정 + 검사 이력
 *
 * 초보자 가이드:
 * 1. 제품(FG) 바코드를 스캔하면 라벨 정보를 조회해 표시
 * 2. PASS/FAIL 큰 버튼으로 1개씩 외관검사 등록 (visual-inspect API)
 * 3. PASS -> 즉시 등록, FAIL -> FailModal(VISUAL_DEFECT) 열림
 * 4. 하단 DataGrid에 작업지시별 외관검사 이력 표시
 *
 * 통전검사(inspection/result)와 달리 회로라벨 스캔 절차가 없다.
 */
import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { ColumnDef } from "@tanstack/react-table";
import {
  CheckCircle, XCircle, RefreshCw, ScanBarcode, AlertTriangle,
} from "lucide-react";
import { Card, CardContent, Button } from "@/components/ui";
import { BarcodeScanInput } from "@/components/shared";
import DataGrid from "@/components/data-grid/DataGrid";
import api from "@/services/api";
import type { JobOrderRow, InspectHistoryRow, FgLabelInfo } from "../types";
import FailModal from "./FailModal";

interface Props {
  order: JobOrderRow;
}

export default function VisualInspectPanel({ order }: Props) {
  const { t } = useTranslation();
  const [history, setHistory] = useState<InspectHistoryRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [inspecting, setInspecting] = useState(false);
  const [failModalOpen, setFailModalOpen] = useState(false);

  /** 바코드 스캔 상태 */
  const [scannedBarcode, setScannedBarcode] = useState("");
  const [scannedLabel, setScannedLabel] = useState<FgLabelInfo | null>(null);
  const [scanError, setScanError] = useState("");
  const [lastResult, setLastResult] = useState<{ fgBarcode: string; passYn: string } | null>(null);
  const scanInputRef = useRef<HTMLInputElement>(null);

  /** 검사 이력 새로고침 (작업지시별, VISUAL 타입) */
  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/quality/continuity-inspect/inspect-history/${order.orderNo}`, {
        params: { inspectType: "VISUAL" },
      });
      setHistory(res.data?.data ?? []);
    } catch { /* 에러 무시 */ }
    finally { setLoading(false); }
  }, [order.orderNo]);

  useEffect(() => {
    refresh();
    setScannedBarcode("");
    setScannedLabel(null);
    setScanError("");
    setLastResult(null);
    scanInputRef.current?.focus();
  }, [refresh]);

  /** 검사 대상 여부 — ISSUED 라벨만 외관검사 가능 */
  const alreadyInspected = scannedLabel ? scannedLabel.status !== "ISSUED" : false;

  /** 바코드 스캔 → 라벨 조회 */
  const lookupLabel = useCallback(async (rawBarcode: string) => {
    const barcode = rawBarcode.replace(/\r?\n|\r/g, "").trim();
    if (!barcode) return;
    setScanError("");
    setScannedLabel(null);
    try {
      const res = await api.get(`/quality/continuity-inspect/fg-label/${barcode}`);
      const label: FgLabelInfo = res.data?.data;
      if (!label) {
        setScanError(t("quality.inspect.barcodeNotFound"));
        return;
      }
      // 선택한 작업지시에 속한 라벨인지 검증
      if (label.orderNo && label.orderNo !== order.orderNo) {
        setScanError(t("quality.inspect.wrongOrder", { orderNo: label.orderNo }));
        return;
      }
      setScannedLabel(label);
    } catch {
      setScanError(t("quality.inspect.barcodeNotFound"));
    }
  }, [order.orderNo, t]);

  /** 스캔 입력 초기화 + 재포커스 */
  const resetScan = useCallback(() => {
    setScannedBarcode("");
    setScannedLabel(null);
    setScanError("");
    scanInputRef.current?.focus();
  }, []);

  /** PASS 검사 등록 */
  const handlePass = useCallback(async () => {
    if (!scannedLabel) return;
    setInspecting(true);
    try {
      await api.post(`/quality/continuity-inspect/visual-inspect/${scannedLabel.fgBarcode}`, {
        passYn: "Y",
        errorCode: null,
        errorDetail: null,
        inspectData: null,
      });
      setLastResult({ fgBarcode: scannedLabel.fgBarcode, passYn: "Y" });
      resetScan();
      await refresh();
    } catch { /* API 인터셉터 처리 */ }
    finally { setInspecting(false); }
  }, [scannedLabel, refresh, resetScan]);

  /** FAIL 검사 등록 (모달에서 호출) */
  const handleFailSubmit = useCallback(async (errorCode: string, errorDetail: string) => {
    if (!scannedLabel) return;
    setInspecting(true);
    try {
      await api.post(`/quality/continuity-inspect/visual-inspect/${scannedLabel.fgBarcode}`, {
        passYn: "N",
        errorCode: errorCode || null,
        errorDetail: errorDetail || null,
        inspectData: null,
      });
      setLastResult({ fgBarcode: scannedLabel.fgBarcode, passYn: "N" });
      setFailModalOpen(false);
      resetScan();
      await refresh();
    } catch { /* API 인터셉터 처리 */ }
    finally { setInspecting(false); }
  }, [scannedLabel, refresh, resetScan]);

  const columns = useMemo<ColumnDef<InspectHistoryRow>[]>(() => [
    {
      accessorKey: "inspectAt", header: t("inspection.result.inspectedAt"), size: 140,
      cell: ({ getValue }) => {
        const v = getValue() as string;
        if (!v) return "-";
        const d = new Date(v);
        return <span className="tabular-nums text-xs">{d.toLocaleString("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span>;
      },
    },
    {
      accessorKey: "passYn", header: t("inspection.result.resultCol"), size: 70,
      cell: ({ getValue }) => {
        const v = getValue() as string;
        return v === "Y"
          ? <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-600 dark:text-green-400"><CheckCircle className="w-3.5 h-3.5" />PASS</span>
          : <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 dark:text-red-400"><XCircle className="w-3.5 h-3.5" />FAIL</span>;
      },
    },
    { accessorKey: "fgBarcode", header: t("inspection.result.fgBarcode"), size: 180,
      cell: ({ getValue }) => <span className="font-mono text-xs">{(getValue() as string | null) ?? "-"}</span> },
    { accessorKey: "errorCode", header: t("inspection.result.errorCode"), size: 110,
      cell: ({ getValue }) => <span className="text-xs text-red-500">{(getValue() as string | null) ?? "-"}</span> },
    { accessorKey: "errorDetail", header: t("inspection.result.errorDesc"), size: 200,
      cell: ({ getValue }) => <span className="text-xs">{(getValue() as string | null) ?? "-"}</span> },
  ], [t]);

  const passDisabled = inspecting || !scannedLabel || alreadyInspected;

  return (
    <div className="flex flex-col gap-4 h-full overflow-auto">
      {/* 바코드 스캔 입력 */}
      <Card padding="sm" className="border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20">
        <CardContent>
          <div className="flex items-center gap-2 mb-2">
            <ScanBarcode className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <span className="text-sm font-semibold text-blue-700 dark:text-blue-300">
              {t("quality.inspect.scanPlaceholder")}
            </span>
          </div>
          <BarcodeScanInput
            ref={scanInputRef}
            value={scannedBarcode}
            onChange={(value) => { setScannedBarcode(value); setScanError(""); }}
            onScan={lookupLabel}
            placeholder={t("quality.inspect.scanPlaceholder")}
            fullWidth
            autoFocus
            maintainFocus
          />
          {scanError && (
            <p className="mt-2 text-sm text-red-500">{scanError}</p>
          )}
        </CardContent>
      </Card>

      {/* 스캔된 라벨 정보 */}
      {scannedLabel && (
        <Card padding="sm">
          <CardContent>
            <h3 className="text-xs font-semibold text-text-muted mb-2">{t("quality.inspect.inspectInfo")}</h3>
            <div className="bg-surface rounded-lg p-3 space-y-1 text-xs">
              <InfoRow label="FG Barcode" value={scannedLabel.fgBarcode} mono />
              <InfoRow label={t("master.part.partCode", "품목코드")} value={scannedLabel.itemCode} />
              <InfoRow label={t("production.result.orderNo", "작업지시")} value={scannedLabel.orderNo || "-"} />
              <InfoRow label={t("common.status", "상태")} value={scannedLabel.status} />
            </div>
            {alreadyInspected && (
              <div className="mt-2 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-300 dark:border-yellow-700 rounded-lg p-2 text-center">
                <p className="text-sm text-yellow-700 dark:text-yellow-300 font-medium">
                  {t("quality.inspect.alreadyInspected")} ({scannedLabel.status})
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* 안내 (바코드 미스캔) */}
      {!scannedLabel && !scanError && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-orange-300 bg-orange-50 dark:border-orange-700 dark:bg-orange-900/20">
          <AlertTriangle className="w-4 h-4 text-orange-500 shrink-0" />
          <span className="text-sm font-medium text-orange-700 dark:text-orange-300">{t("inspection.result.scanRequired")}</span>
        </div>
      )}

      {/* 검사 버튼 */}
      <div className="flex gap-4">
        <button
          onClick={handlePass}
          disabled={passDisabled}
          title={inspecting ? t("common.saving") : !scannedLabel ? t("inspection.result.scanRequired") : t("quality.inspect.pass")}
          className="flex-1 flex items-center justify-center gap-3 py-5 rounded-xl
            bg-green-500 hover:bg-green-600 dark:bg-green-600 dark:hover:bg-green-700
            text-white font-bold text-lg transition-colors disabled:opacity-50">
          <CheckCircle className="w-7 h-7" />{t("quality.inspect.pass")}
        </button>
        <button
          onClick={() => setFailModalOpen(true)}
          disabled={passDisabled}
          title={inspecting ? t("common.saving") : !scannedLabel ? t("inspection.result.scanRequired") : t("quality.inspect.fail")}
          className="flex-1 flex items-center justify-center gap-3 py-5 rounded-xl
            bg-red-500 hover:bg-red-600 dark:bg-red-600 dark:hover:bg-red-700
            text-white font-bold text-lg transition-colors disabled:opacity-50">
          <XCircle className="w-7 h-7" />{t("quality.inspect.fail")}
        </button>
      </div>

      {/* 최근 검사 결과 */}
      {lastResult && (
        <Card padding="sm" className={lastResult.passYn === "Y"
          ? "border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-900/20"
          : "border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/20"}>
          <CardContent>
            <div className="flex items-center gap-2">
              {lastResult.passYn === "Y"
                ? <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
                : <XCircle className="w-5 h-5 text-red-600 dark:text-red-400" />}
              <span className={`text-sm font-medium ${lastResult.passYn === "Y" ? "text-green-700 dark:text-green-300" : "text-red-700 dark:text-red-300"}`}>
                {lastResult.passYn === "Y" ? t("quality.inspect.pass") : t("quality.inspect.fail")}
              </span>
              <span className="font-mono text-sm font-bold text-text">{lastResult.fgBarcode}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 검사 이력 */}
      <Card className="flex-1 min-h-0 overflow-hidden" padding="none"><CardContent className="h-full p-3">
        <p className="text-sm font-semibold text-text mb-1">{t("inspection.result.inspectHistory")}</p>
        <DataGrid
          data={history}
          columns={columns}
          isLoading={loading}
          toolbarLeft={
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-text-muted">{t("inspection.result.inspectHistory")}</span>
              <Button variant="ghost" size="sm" onClick={refresh}>
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              </Button>
            </div>
          }
          sqlQuery={`SELECT *\nFROM INSPECT_RESULTS\nWHERE COMPANY = '40'\n  AND PLANT_CD = '1000'\n  AND INSPECT_TYPE = 'VISUAL'\nORDER BY INSPECT_TIME DESC`}
        />
      </CardContent></Card>

      <FailModal isOpen={failModalOpen} onClose={() => setFailModalOpen(false)}
        onSubmit={handleFailSubmit} submitting={inspecting} />
    </div>
  );
}

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between">
      <span className="text-text-muted">{label}</span>
      <span className={`text-text font-medium ${mono ? "font-mono text-primary" : ""}`}>{value}</span>
    </div>
  );
}
