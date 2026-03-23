"use client";

/**
 * @file inspection/result/components/InspectPanel.tsx
 * @description 통전검사 우측 패널 - 검사 정보, 통계, PASS/FAIL 버튼, FG 라벨 이력
 *
 * 초보자 가이드:
 * 1. 선택된 작업지시의 상세 정보 + 검사 통계를 상단에 표시
 * 2. PASS/FAIL 큰 버튼으로 1개씩 검사 등록
 * 3. PASS -> 즉시 API 호출 -> FG_BARCODE 생성, FAIL -> FailModal 열림
 * 4. 하단 DataGrid에 FG 바코드 발행 이력 표시
 * 5. FG_BARCODE_ISSUE_TIMING 설정에 따라 모드 분기:
 *    - ON_INSPECT: 기존 방식 (검사 시 바코드 자동 생성)
 *    - ON_PRODUCTION / PRE_ISSUE: 바코드 스캔 후 검사 등록
 */
import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { ColumnDef } from "@tanstack/react-table";
import {
  CheckCircle, XCircle, RefreshCw, Zap, ClipboardList, BarChart3, Package,
  ScanBarcode,
} from "lucide-react";
import { Card, CardContent, Button, Input, StatCard } from "@/components/ui";
import DataGrid from "@/components/data-grid/DataGrid";
import api from "@/services/api";
import { useSysConfigStore } from "@/stores/sysConfigStore";
import type { JobOrderRow, FgLabelRow, InspectStats } from "../types";
import FailModal from "./FailModal";

interface Props { order: JobOrderRow; }

const EMPTY_STATS: InspectStats = { total: 0, passed: 0, failed: 0, passRate: 0, planQty: 0, labelCount: 0 };

export default function InspectPanel({ order }: Props) {
  const { t } = useTranslation();
  const [stats, setStats] = useState<InspectStats>(EMPTY_STATS);
  const [labels, setLabels] = useState<FgLabelRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [inspecting, setInspecting] = useState(false);
  const [lastBarcode, setLastBarcode] = useState<string | null>(null);
  const [failModalOpen, setFailModalOpen] = useState(false);

  /** FG 바코드 발행 타이밍 설정 */
  const issueTiming = useSysConfigStore((s) => s.getConfig("FG_BARCODE_ISSUE_TIMING")) ?? "ON_INSPECT";
  const isScanMode = issueTiming !== "ON_INSPECT";

  /** 바코드 스캔 모드 상태 */
  const [scannedBarcode, setScannedBarcode] = useState("");
  const [pendingBarcodes, setPendingBarcodes] = useState<FgLabelRow[]>([]);
  const scanInputRef = useRef<HTMLInputElement>(null);

  /** 통계 + 라벨 목록 새로고침 */
  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [statsRes, labelsRes] = await Promise.all([
        api.get(`/quality/continuity-inspect/stats/${order.orderNo}`),
        api.get(`/quality/continuity-inspect/fg-labels/${order.orderNo}`),
      ]);
      setStats(statsRes.data?.data ?? EMPTY_STATS);
      setLabels(labelsRes.data?.data ?? []);
    } catch { /* 에러 무시 */ }
    finally { setLoading(false); }
  }, [order.orderNo]);

  /** PENDING 바코드 목록 조회 (스캔 모드) */
  const fetchPending = useCallback(async () => {
    if (!isScanMode) return;
    try {
      const res = await api.get(`/quality/continuity-inspect/pending/${order.orderNo}`);
      setPendingBarcodes(res.data?.data ?? []);
    } catch { /* 에러 무시 */ }
  }, [order.orderNo, isScanMode]);

  useEffect(() => {
    refresh();
    fetchPending();
    setLastBarcode(null);
    setScannedBarcode("");
  }, [refresh, fetchPending]);

  /** PASS 검사 등록 (ON_INSPECT 모드) */
  const handlePass = useCallback(async () => {
    setInspecting(true);
    try {
      const payload: Record<string, unknown> = {
        orderNo: order.orderNo, itemCode: order.itemCode, lineCode: order.lineCode, passYn: "Y",
      };
      if (isScanMode && scannedBarcode) {
        payload.fgBarcode = scannedBarcode;
      }
      const res = await api.post("/quality/continuity-inspect/inspect", payload);
      setLastBarcode(res.data?.data?.fgBarcode ?? (scannedBarcode || null));
      setScannedBarcode("");
      await Promise.all([refresh(), fetchPending()]);
      if (isScanMode) scanInputRef.current?.focus();
    } catch { /* 에러 무시 */ }
    finally { setInspecting(false); }
  }, [order, refresh, fetchPending, isScanMode, scannedBarcode]);

  /** FAIL 검사 등록 (모달에서 호출) */
  const handleFailSubmit = useCallback(async (errorCode: string, errorDetail: string) => {
    setInspecting(true);
    try {
      const payload: Record<string, unknown> = {
        orderNo: order.orderNo, itemCode: order.itemCode, lineCode: order.lineCode,
        passYn: "N", errorCode: errorCode || undefined, errorDetail: errorDetail || undefined,
      };
      if (isScanMode && scannedBarcode) {
        payload.fgBarcode = scannedBarcode;
      }
      await api.post("/quality/continuity-inspect/inspect", payload);
      setFailModalOpen(false);
      setScannedBarcode("");
      await Promise.all([refresh(), fetchPending()]);
      if (isScanMode) scanInputRef.current?.focus();
    } catch { /* 에러 무시 */ }
    finally { setInspecting(false); }
  }, [order, refresh, fetchPending, isScanMode, scannedBarcode]);

  /** 스캔 입력 Enter 핸들러 */
  const handleScanKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && scannedBarcode.trim()) {
      e.preventDefault();
    }
  }, [scannedBarcode]);

  const columns = useMemo<ColumnDef<FgLabelRow>[]>(() => [
    { accessorKey: "fgBarcode", header: t("inspection.result.fgBarcode"), size: 220,
      cell: ({ getValue }) => <span className="font-mono text-sm">{getValue() as string}</span> },
    { accessorKey: "issuedAt", header: t("inspection.result.issuedAt"), size: 160 },
    { accessorKey: "status", header: t("common.status"), size: 100 },
  ], [t]);

  const pendingColumns = useMemo<ColumnDef<FgLabelRow>[]>(() => [
    { accessorKey: "fgBarcode", header: t("inspection.result.fgBarcode"), size: 220,
      cell: ({ getValue }) => <span className="font-mono text-sm">{getValue() as string}</span> },
    { accessorKey: "issuedAt", header: t("inspection.result.issuedAt"), size: 160 },
  ], [t]);

  /** 스캔 모드에서 바코드 미입력 시 PASS/FAIL 비활성화 */
  const scanDisabled = isScanMode && !scannedBarcode.trim();

  return (
    <div className="flex flex-col gap-4 h-full overflow-auto">
      {/* 작업지시 정보 */}
      <Card padding="sm"><CardContent>
        <div className="flex items-center gap-2 mb-2">
          <ClipboardList className="w-4 h-4 text-primary" />
          <span className="font-semibold text-text">{order.orderNo}</span>
        </div>
        <div className="grid grid-cols-3 gap-2 text-sm text-text-muted">
          <span>{order.itemCode}</span>
          <span>{order.itemName ?? "-"}</span>
          <span>{t("inspection.result.planQty")}: {order.planQty}</span>
        </div>
      </CardContent></Card>

      {/* 통계 카드 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label={t("inspection.result.planQty")} value={order.planQty} icon={Package} color="blue" />
        <StatCard label={t("inspection.result.inspected")} value={stats.total} icon={BarChart3} color="green" />
        <StatCard label={t("inspection.result.pass")} value={stats.passed} icon={CheckCircle} color="green" />
        <StatCard label={t("inspection.result.fail")} value={stats.failed} icon={XCircle} color="red" />
      </div>

      {/* 바코드 스캔 입력 (ON_PRODUCTION / PRE_ISSUE 모드) */}
      {isScanMode && (
        <Card padding="sm" className="border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20">
          <CardContent>
            <div className="flex items-center gap-2 mb-2">
              <ScanBarcode className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span className="text-sm font-semibold text-blue-700 dark:text-blue-300">
                {t("inspection.result.scanBarcode")}
              </span>
            </div>
            <Input
              ref={scanInputRef}
              value={scannedBarcode}
              onChange={(e) => setScannedBarcode(e.target.value)}
              onKeyDown={handleScanKeyDown}
              placeholder={t("inspection.result.scanBarcode")}
              fullWidth
              autoFocus
            />
          </CardContent>
        </Card>
      )}

      {/* PENDING 바코드 목록 (스캔 모드) */}
      {isScanMode && pendingBarcodes.length > 0 && (
        <Card padding="sm"><CardContent>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-text">
              {t("inspection.result.pendingList")} ({pendingBarcodes.length})
            </span>
            <Button variant="ghost" size="sm" onClick={fetchPending}>
              <RefreshCw className="w-3.5 h-3.5" />
            </Button>
          </div>
          <div className="max-h-36 overflow-y-auto min-h-0">
            <DataGrid data={pendingBarcodes} columns={pendingColumns} isLoading={false} />
          </div>
        </CardContent></Card>
      )}

      {/* 검사 버튼 */}
      <div className="flex gap-4">
        <button onClick={handlePass} disabled={inspecting || scanDisabled}
          className="flex-1 flex items-center justify-center gap-3 py-5 rounded-xl
            bg-green-500 hover:bg-green-600 dark:bg-green-600 dark:hover:bg-green-700
            text-white font-bold text-lg transition-colors disabled:opacity-50">
          <CheckCircle className="w-7 h-7" />{t("inspection.result.passBtn")}
        </button>
        <button onClick={() => setFailModalOpen(true)} disabled={inspecting || scanDisabled}
          className="flex-1 flex items-center justify-center gap-3 py-5 rounded-xl
            bg-red-500 hover:bg-red-600 dark:bg-red-600 dark:hover:bg-red-700
            text-white font-bold text-lg transition-colors disabled:opacity-50">
          <XCircle className="w-7 h-7" />{t("inspection.result.failBtn")}
        </button>
      </div>

      {/* 최근 발행 바코드 */}
      {lastBarcode && (
        <Card padding="sm" className="border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-900/20">
          <CardContent>
            <div className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-green-600 dark:text-green-400" />
              <span className="text-sm text-green-700 dark:text-green-300 font-medium">
                {t("inspection.result.fgBarcodeIssued")}
              </span>
            </div>
            <p className="font-mono text-lg font-bold text-green-800 dark:text-green-200 mt-1">{lastBarcode}</p>
          </CardContent>
        </Card>
      )}

      {/* FG 라벨 이력 */}
      <Card className="flex-1 min-h-0 overflow-hidden" padding="none"><CardContent className="h-full p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold text-text">{t("inspection.result.fgLabelHistory")}</span>
          <Button variant="ghost" size="sm" onClick={refresh}>
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
        <DataGrid data={labels} columns={columns} isLoading={loading} />
      </CardContent></Card>

      <FailModal isOpen={failModalOpen} onClose={() => setFailModalOpen(false)}
        onSubmit={handleFailSubmit} submitting={inspecting} />
    </div>
  );
}
