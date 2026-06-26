"use client";

/**
 * @file inspection/result/components/InspectPanel.tsx
 * @description 통전검사 우측 패널 - PASS/FAIL 버튼, FG 라벨 이력
 *
 * 초보자 가이드:
 * 1. PASS/FAIL 큰 버튼으로 1개씩 검사 등록
 * 2. 제품(FG) 라벨은 조립(서브공정) 키팅 공정에서 발행되므로, 검사 단계는 발행된 ISSUED 라벨을 스캔만 한다.
 * 3. PASS -> 제품 라벨 + 회로라벨 스캔 후 API 호출(판정 갱신), FAIL -> FailModal 열림
 * 4. 하단 DataGrid에 FG 바코드 검사 이력 표시
 */
import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { ColumnDef } from "@tanstack/react-table";
import {
  CheckCircle, XCircle, RefreshCw, Zap,
  ScanBarcode, AlertTriangle,
} from "lucide-react";
import { Card, CardContent, Button, Input } from "@/components/ui";
import DataGrid from "@/components/data-grid/DataGrid";
import api from "@/services/api";
import type { JobOrderRow, InspectHistoryRow } from "../types";
import FailModal from "./FailModal";

interface Props {
  order: JobOrderRow;
  inspectType?: "CONTINUITY" | "TERMINAL";
  /** 선택된 검사기(설비) 코드 — 검사 실적 기록 + 미선택 시 검사 차단 */
  equipCode?: string;
  /** 소모성 설비부품 장착 완료 여부(상위에서 주입, 매핑 0건이면 true) */
  consumablesReady?: boolean;
  /** 미장착 소모품 수량(인터락 안내 메시지용) */
  unmountedConsumCount?: number;
}

export default function InspectPanel({
  order,
  inspectType = "CONTINUITY",
  equipCode,
  consumablesReady = true,
  unmountedConsumCount = 0,
}: Props) {
  const { t } = useTranslation();
  const [history, setHistory] = useState<InspectHistoryRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [inspecting, setInspecting] = useState(false);
  const [lastBarcode, setLastBarcode] = useState<string | null>(null);
  const [failModalOpen, setFailModalOpen] = useState(false);

  /** 검사는 조립(서브공정) 키팅에서 발행된 FG 라벨을 스캔해 판정한다. (항상 스캔 모드) */
  const isScanMode = true;

  /** 바코드 스캔 모드 상태 */
  const [scannedBarcode, setScannedBarcode] = useState("");
  const [circuitLabel, setCircuitLabel] = useState("");
  const [pendingBarcodes, setPendingBarcodes] = useState<{ fgBarcode: string; issuedAt: string }[]>([]);
  const scanInputRef = useRef<HTMLInputElement>(null);
  const circuitInputRef = useRef<HTMLInputElement>(null);

  /** 검사이력 새로고침 */
  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/quality/continuity-inspect/inspect-history/${order.orderNo}`, { params: { inspectType } });
      setHistory(res.data?.data ?? []);
    } catch { /* 에러 무시 */ }
    finally { setLoading(false); }
  }, [order.orderNo, inspectType]);

  /** 검사 대기 FG 라벨 목록 조회 (조립 발행 ISSUED + 미검사) */
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
    setCircuitLabel("");
  }, [refresh, fetchPending]);

  /** PASS 검사 등록 (제품 라벨 스캔 → 판정 갱신) */
  const handlePass = useCallback(async () => {
    setInspecting(true);
    try {
      const payload: Record<string, unknown> = {
        orderNo: order.orderNo, itemCode: order.itemCode, lineCode: order.lineCode, passYn: "Y", inspectType,
        ...(equipCode ? { equipCode } : {}),
      };
      if (isScanMode && scannedBarcode) {
        payload.fgBarcode = scannedBarcode;
        payload.circuitLabel = circuitLabel;
      }
      const res = await api.post("/quality/continuity-inspect/inspect", payload);
      setLastBarcode(res.data?.data?.fgBarcode ?? (scannedBarcode || null));
      setScannedBarcode("");
      setCircuitLabel("");
      await Promise.all([refresh(), fetchPending()]);
      if (isScanMode) scanInputRef.current?.focus();
    } catch { /* 에러 무시 */ }
    finally { setInspecting(false); }
  }, [order, refresh, fetchPending, isScanMode, scannedBarcode, circuitLabel, inspectType, equipCode]);

  /** FAIL 검사 등록 (모달에서 호출) */
  const handleFailSubmit = useCallback(async (errorCode: string, errorDetail: string) => {
    setInspecting(true);
    try {
      const payload: Record<string, unknown> = {
        orderNo: order.orderNo, itemCode: order.itemCode, lineCode: order.lineCode,
        passYn: "N", inspectType, errorCode: errorCode || undefined, errorDetail: errorDetail || undefined,
        ...(equipCode ? { equipCode } : {}),
      };
      if (isScanMode && scannedBarcode) {
        payload.fgBarcode = scannedBarcode;
      }
      await api.post("/quality/continuity-inspect/inspect", payload);
      setFailModalOpen(false);
      setScannedBarcode("");
      setCircuitLabel("");
      await Promise.all([refresh(), fetchPending()]);
      if (isScanMode) scanInputRef.current?.focus();
    } catch { /* 에러 무시 */ }
    finally { setInspecting(false); }
  }, [order, refresh, fetchPending, isScanMode, scannedBarcode, inspectType, equipCode]);

  /** 제품 바코드 입력 Enter → 회로라벨 입력칸으로 포커스 이동 */
  const handleScanKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && scannedBarcode.trim()) {
      e.preventDefault();
      circuitInputRef.current?.focus();
    }
  }, [scannedBarcode]);

  /** 회로라벨 입력 Enter → 입력값 확정만 (PASS는 버튼으로) */
  const handleCircuitKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
    }
  }, []);

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
    { accessorKey: "fgBarcode", header: t("inspection.result.fgBarcode"), size: 170,
      cell: ({ getValue }) => <span className="font-mono text-xs">{(getValue() as string | null) ?? "-"}</span> },
    { accessorKey: "circuitLabel", header: t("inspection.result.circuitLabel"), size: 140,
      cell: ({ getValue }) => <span className="font-mono text-xs">{(getValue() as string | null) ?? "-"}</span> },
    { accessorKey: "errorCode", header: t("inspection.result.errorCode"), size: 100,
      cell: ({ getValue }) => <span className="text-xs text-red-500">{(getValue() as string | null) ?? "-"}</span> },
    { accessorKey: "errorDetail", header: t("inspection.result.errorDesc"), size: 180,
      cell: ({ getValue }) => <span className="text-xs">{(getValue() as string | null) ?? "-"}</span> },
  ], [t]);

  const pendingColumns = useMemo<ColumnDef<{ fgBarcode: string; issuedAt: string }>[]>(() => [
    { accessorKey: "fgBarcode", header: t("inspection.result.fgBarcode"), size: 220,
      cell: ({ getValue }) => <span className="font-mono text-sm">{getValue() as string}</span> },
    { accessorKey: "issuedAt", header: t("inspection.result.issuedAt"), size: 160 },
  ], [t]);

  /** 검사기 미선택 시 검사 차단(인터락) — 소모품보다 우선 */
  const equipRequired = !equipCode;
  /** 소모성 설비부품 미장착 시 검사 차단(인터락) */
  const consumableBlocked = !equipRequired && !consumablesReady;
  /** 스캔 모드에서 제품 바코드 미입력 시 PASS/FAIL 비활성화 */
  const scanDisabled = (isScanMode && !scannedBarcode.trim()) || equipRequired || consumableBlocked;
  /** 스캔 모드 PASS는 회로라벨까지 필수 */
  const passDisabled = scanDisabled || (isScanMode && !circuitLabel.trim());
  const scanDisabledReason = t(
    "inspection.result.scanRequired",
    "바코드를 먼저 스캔해주세요."
  );
  const circuitRequiredReason = t(
    "inspection.result.circuitRequired",
    "합격하려면 회로라벨을 스캔해주세요."
  );
  const consumableRequiredReason = t("inspection.result.consumableMountRequired", {
    count: unmountedConsumCount,
  });
  const equipRequiredReason = t("inspection.result.equipRequired");
  /** 인터락 안내 — 검사기 미선택 우선, 다음 소모품 미장착 */
  const interlockReason = equipRequired ? equipRequiredReason : consumableBlocked ? consumableRequiredReason : "";

  return (
    <div className="flex flex-col gap-4 h-full overflow-auto">
      {/* 제품 라벨(FG) 스캔 입력 — 조립 발행 라벨을 스캔해 판정 */}
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
            {/* 회로라벨 스캔 (합격 시 필수) */}
            <div className="flex items-center gap-2 mt-3 mb-2">
              <ScanBarcode className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span className="text-sm font-semibold text-blue-700 dark:text-blue-300">
                {t("inspection.result.scanCircuitLabel")}
              </span>
            </div>
            <Input
              ref={circuitInputRef}
              value={circuitLabel}
              onChange={(e) => setCircuitLabel(e.target.value)}
              onKeyDown={handleCircuitKeyDown}
              placeholder={t("inspection.result.scanCircuitLabel")}
              fullWidth
            />
          </CardContent>
        </Card>
      )}

      {/* 검사 대기 FG 라벨 목록 (조립 발행 ISSUED + 미검사) */}
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
            <DataGrid data={pendingBarcodes} columns={pendingColumns} isLoading={false} 
            sqlQuery={`SELECT *\nFROM INSPECT_RESULTS\nWHERE COMPANY = '40'\n  AND PLANT_CD = '1000'\nORDER BY CREATED_AT DESC`}/>
          </div>
        </CardContent></Card>
      )}

      {/* 인터락 안내 (검사기 미선택 / 소모품 미장착) */}
      {interlockReason && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-orange-300 bg-orange-50 dark:border-orange-700 dark:bg-orange-900/20">
          <AlertTriangle className="w-4 h-4 text-orange-500 shrink-0" />
          <span className="text-sm font-medium text-orange-700 dark:text-orange-300">{interlockReason}</span>
        </div>
      )}

      {/* 검사 버튼 */}
      <div className="flex gap-4">
        <button
          onClick={handlePass}
          disabled={inspecting || passDisabled}
          title={
            inspecting
              ? t("common.saving")
              : interlockReason
                ? interlockReason
                : scanDisabled
                  ? scanDisabledReason
                  : isScanMode && !circuitLabel.trim()
                    ? circuitRequiredReason
                    : t("inspection.result.passBtn")
          }
          className="flex-1 flex items-center justify-center gap-3 py-5 rounded-xl
            bg-green-500 hover:bg-green-600 dark:bg-green-600 dark:hover:bg-green-700
            text-white font-bold text-lg transition-colors disabled:opacity-50">
          <CheckCircle className="w-7 h-7" />{t("inspection.result.passBtn")}
        </button>
        <button
          onClick={() => setFailModalOpen(true)}
          disabled={inspecting || scanDisabled}
          title={inspecting ? t("common.saving") : interlockReason ? interlockReason : scanDisabled ? scanDisabledReason : t("inspection.result.failBtn")}
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

      {/* 검사 이력 */}
      <Card className="flex-1 min-h-0 overflow-hidden" padding="none"><CardContent className="h-full p-3">
        <p className="text-sm font-semibold text-text mb-1">{t("inspection.result.inspectHistory", "검사 이력")}</p>
        <DataGrid
          data={history}
          columns={columns}
          isLoading={loading}
          toolbarLeft={
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-text-muted">최근 20건</span>
              <Button variant="ghost" size="sm" onClick={refresh}>
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              </Button>
            </div>
          }
          sqlQuery={`SELECT *\nFROM INSPECT_RESULTS\nWHERE COMPANY = '40'\n  AND PLANT_CD = '1000'\nORDER BY INSPECT_TIME DESC`}
        />
      </CardContent></Card>

      <FailModal isOpen={failModalOpen} onClose={() => setFailModalOpen(false)}
        onSubmit={handleFailSubmit} submitting={inspecting} />
    </div>
  );
}
