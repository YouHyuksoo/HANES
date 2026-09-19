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
import { BarcodeScanInput } from "@/components/shared";
import DataGrid from "@/components/data-grid/DataGrid";
import api from "@/services/api";
import {
  EMPTY_MEASURE_FORM, MEASURE_FIELDS, formatMeasuredSummary, isMeasuredInspectType,
  type InspectMeasureForm, type JobOrderRow, type InspectHistoryRow,
} from "../types";
import type { InspectPrepState } from "../hooks/useInspectPrepStatus";
import FailModal from "./FailModal";

interface Props {
  order: JobOrderRow;
  inspectType?: "CONTINUITY" | "TERMINAL" | "HIPOT" | "LEAK";
  /** 선택된 검사기(설비) 코드 — 검사 실적 기록 + 미선택 시 검사 차단 */
  equipCode?: string;
  /** 준비 상태 단일 객체 — 작업자/설비점검/양불대조/소모품을 모두 포함한다 */
  prep: InspectPrepState;
}

export default function InspectPanel({
  order,
  inspectType = "CONTINUITY",
  equipCode,
  prep,
}: Props) {
  const { t } = useTranslation();
  const [history, setHistory] = useState<InspectHistoryRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [inspecting, setInspecting] = useState(false);
  const [lastBarcode, setLastBarcode] = useState<string | null>(null);
  const [failModalOpen, setFailModalOpen] = useState(false);

  /** 검사는 조립(서브공정) 키팅에서 발행된 FG 라벨을 스캔해 판정한다. (항상 스캔 모드) */
  const isScanMode = true;
  /** 내전압·리크는 회로라벨 대신 측정값이 판정 근거다 — 서버가 품목 스펙과 대조해 합/불을 확정한다 */
  const isMeasured = isMeasuredInspectType(inspectType);
  const [measure, setMeasure] = useState<InspectMeasureForm>(EMPTY_MEASURE_FORM);
  const measureFields = isMeasured ? MEASURE_FIELDS[inspectType as "HIPOT" | "LEAK"] : [];
  const measureReady = measureFields.every(({ key, required }) => !required || measure[key].trim() !== "");
  /** 빈 칸은 보내지 않고, 채운 칸만 숫자로 바꿔 보낸다 */
  const measurePayload = (): Record<string, number> => Object.fromEntries(
    measureFields
      .map(({ key }) => [key, measure[key].trim()] as const)
      .filter(([, v]) => v !== "" && Number.isFinite(Number(v)))
      .map(([k, v]) => [k, Number(v)]),
  );

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
      // 검사유형별 대기 — 이 유형의 결과가 아직 없는 ISSUED 라벨
      const res = await api.get(`/quality/continuity-inspect/pending/${order.orderNo}`, { params: { inspectType } });
      setPendingBarcodes(res.data?.data ?? []);
    } catch { /* 에러 무시 */ }
  }, [order.orderNo, isScanMode, inspectType]);

  useEffect(() => {
    refresh();
    fetchPending();
    setLastBarcode(null);
    setScannedBarcode("");
    setCircuitLabel("");
    setMeasure(EMPTY_MEASURE_FORM);
  }, [refresh, fetchPending]);

  /** PASS 검사 등록 (제품 라벨 스캔 → 판정 갱신) */
  const handlePass = useCallback(async () => {
    setInspecting(true);
    try {
      const payload: Record<string, unknown> = {
        orderNo: order.orderNo, itemCode: order.itemCode, lineCode: order.lineCode, passYn: "Y", inspectType,
        ...(equipCode ? { equipCode } : {}),
        ...(prep.workers[0]?.id ? { workerId: prep.workers[0].id } : {}),
      };
      if (isScanMode && scannedBarcode) {
        payload.fgBarcode = scannedBarcode;
        if (!isMeasured) payload.circuitLabel = circuitLabel;
      }
      if (isMeasured) Object.assign(payload, measurePayload());
      const res = await api.post("/quality/continuity-inspect/inspect", payload);
      setLastBarcode(res.data?.data?.fgBarcode ?? (scannedBarcode || null));
      setScannedBarcode("");
      setCircuitLabel("");
      setMeasure(EMPTY_MEASURE_FORM);
      await Promise.all([refresh(), fetchPending()]);
      if (isScanMode) scanInputRef.current?.focus();
    } catch { /* 에러 무시 */ }
    finally { setInspecting(false); }
  }, [order, refresh, fetchPending, isScanMode, scannedBarcode, circuitLabel, inspectType, equipCode, prep.workers, isMeasured, measure]);

  /** FAIL 검사 등록 (모달에서 호출) */
  const handleFailSubmit = useCallback(async (errorCode: string, errorDetail: string) => {
    setInspecting(true);
    try {
      const payload: Record<string, unknown> = {
        orderNo: order.orderNo, itemCode: order.itemCode, lineCode: order.lineCode,
        passYn: "N", inspectType, errorCode: errorCode || undefined, errorDetail: errorDetail || undefined,
        ...(equipCode ? { equipCode } : {}),
        ...(prep.workers[0]?.id ? { workerId: prep.workers[0].id } : {}),
      };
      if (isScanMode && scannedBarcode) {
        payload.fgBarcode = scannedBarcode;
      }
      if (isMeasured) Object.assign(payload, measurePayload());
      await api.post("/quality/continuity-inspect/inspect", payload);
      setFailModalOpen(false);
      setScannedBarcode("");
      setCircuitLabel("");
      setMeasure(EMPTY_MEASURE_FORM);
      await Promise.all([refresh(), fetchPending()]);
      if (isScanMode) scanInputRef.current?.focus();
    } catch { /* 에러 무시 */ }
    finally { setInspecting(false); }
  }, [order, refresh, fetchPending, isScanMode, scannedBarcode, inspectType, equipCode, prep.workers, isMeasured, measure]);

  /** 제품 바코드 입력 Enter → 회로라벨(통전·단자) 또는 첫 측정칸(내전압·리크)으로 포커스 이동 */
  const firstMeasureRef = useRef<HTMLInputElement>(null);
  const handleFgBarcodeScan = useCallback((rawBarcode: string) => {
    const barcode = rawBarcode.replace(/\r?\n|\r/g, "").trim();
    if (barcode) {
      setScannedBarcode(barcode);
      if (isMeasured) firstMeasureRef.current?.focus();
      else circuitInputRef.current?.focus();
    }
  }, [isMeasured]);

  const handleCircuitLabelScan = useCallback((rawLabel: string) => {
    setCircuitLabel(rawLabel.replace(/\r?\n|\r/g, "").trim());
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
    ...(isMeasured ? [{
      id: "measured", header: t("inspection.result.measuredCol", "측정값"), size: 200,
      cell: ({ row }: { row: { original: InspectHistoryRow } }) => (
        <span className="font-mono text-xs">{formatMeasuredSummary(row.original.inspectType, row.original.inspectData)}</span>
      ),
    }] : []),
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
  const consumableBlocked = !equipRequired && !prep.consumablesReady;
  /**
   * 준비 4단계(설비일상점검/작업자설비점검/양불마스터 대조/소모품) 미완료 시 판정 차단.
   * 서버도 같은 규칙으로 등록을 막는다(화면 우회 호출 방지).
   */
  const prepBlocked = !prep.ready;
  /** 스캔 모드에서 제품 바코드 미입력 시 PASS/FAIL 비활성화 */
  const scanDisabled = (isScanMode && !scannedBarcode.trim()) || equipRequired || consumableBlocked || prepBlocked;
  /** 스캔 모드 PASS는 회로라벨(통전·단자) 또는 필수 측정값(내전압·리크)까지 필수 */
  const passDisabled = scanDisabled || (isScanMode && (isMeasured ? !measureReady : !circuitLabel.trim()));
  const measurementRequiredReason = t("inspection.result.measurementRequired", "측정값을 입력하세요");
  const scanDisabledReason = t(
    "inspection.result.scanRequired",
    "바코드를 먼저 스캔해주세요."
  );
  const circuitRequiredReason = t(
    "inspection.result.circuitRequired",
    "합격하려면 회로라벨을 스캔해주세요."
  );
  const consumableRequiredReason = t("inspection.result.consumableMountRequired", {
    count: prep.unmountedConsumCount,
  });
  const equipRequiredReason = t("inspection.result.equipRequired");
  /** 인터락 안내 — 검사기 미선택 > 소모품 미장착 > 준비 미완료(점검·대조) 순 */
  const interlockReason = equipRequired
    ? equipRequiredReason
    : consumableBlocked
      ? consumableRequiredReason
      : prepBlocked
        ? (prep.blockReason ?? t("inspection.result.prep.notReady"))
        : "";

  return (
    <div className="flex flex-col gap-4 h-full overflow-auto">
      {/* 제품 라벨(FG) 스캔 입력 — 조립 발행 라벨을 스캔해 판정 */}
      {isScanMode && (
        <Card padding="sm" className="border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20">
          <CardContent>
            {/* 제품 라벨과 회로라벨을 한 줄에 나란히 둔다. 좁은 화면에서는 자동으로 접힌다 */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 mb-1">
                  <ScanBarcode className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                  <span className="text-xs font-semibold text-blue-700 dark:text-blue-300 truncate">
                    {t("inspection.result.scanBarcode")}
                  </span>
                </div>
                <BarcodeScanInput
                  ref={scanInputRef}
                  value={scannedBarcode}
                  onChange={setScannedBarcode}
                  onScan={handleFgBarcodeScan}
                  placeholder={t("inspection.result.scanBarcode")}
                  refocusAfterScan={false}
                  fullWidth
                  autoFocus
                />
              </div>

              {/* 내전압·리크: 회로라벨 대신 측정값 입력 — 서버가 품목 스펙과 대조해 판정한다 */}
              {isMeasured && (
                <div className="min-w-0 grid grid-cols-2 gap-2" data-testid="inspect-measure-inputs">
                  {measureFields.map(({ key, required }, index) => (
                    <Input
                      key={key}
                      ref={index === 0 ? firstMeasureRef : undefined}
                      label={`${t(`inspection.result.measure.${key}`)}${required ? " *" : ""}`}
                      value={measure[key]}
                      onChange={(e) => setMeasure((prev) => ({ ...prev, [key]: e.target.value }))}
                      inputMode="decimal"
                      fullWidth
                    />
                  ))}
                </div>
              )}
              {/* 회로라벨 스캔 (통전·단자 합격 시 필수) */}
              {!isMeasured && <div className="min-w-0">
                <div className="flex items-center gap-1.5 mb-1">
                  <ScanBarcode className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                  <span className="text-xs font-semibold text-blue-700 dark:text-blue-300 truncate">
                    {t("inspection.result.scanCircuitLabel")}
                  </span>
                </div>
                <BarcodeScanInput
                  ref={circuitInputRef}
                  value={circuitLabel}
                  onChange={setCircuitLabel}
                  onScan={handleCircuitLabelScan}
                  placeholder={t("inspection.result.scanCircuitLabel")}
                  fullWidth
                />
              </div>}
            </div>
            {!isMeasured && (
              <p className="mt-1.5 text-xs text-text-muted">
                {t("inspection.result.circuitSourceHelp", "현장 회로라벨 바코드를 스캔하세요. 이미 사용한 라벨은 중복 등록되지 않습니다.")}
              </p>
            )}
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
                  : isScanMode && isMeasured && !measureReady
                    ? measurementRequiredReason
                    : isScanMode && !isMeasured && !circuitLabel.trim()
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
