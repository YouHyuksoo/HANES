"use client";

/**
 * @file material/receive/components/ReceiveScanPanel.tsx
 * @description 우측 스캔 입고 패널 — ReceiveScanModal을 우측 고정 패널로 변환
 *
 * 레이아웃:
 *   상단(고정): 창고·위치 선택 + 스캔 방식 + 스캔 입력 + 단계 안내 + 에러 + 입고처리 버튼
 *   하단(스크롤): 스캔 매핑 목록 테이블
 *
 * 스캔 방식(화면에서 고른다, 기본 업체LOT):
 *   업체LOT: 자체바코드 → 업체바코드를 1:1 로 짝짓는다(업체바코드는 한 LOT 에만 쓸 수 있다).
 *   BL     : BL 번호를 한 번 찍고, 이어서 자체바코드만 연속으로 찍는다. 찍은 자재는 모두 그 BL 로 입고된다.
 *            [BL 변경]을 누르면 다음 BL 을 찍는다. BL 은 업체바코드가 아니라 BL_NO 로 저장된다.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  AlertTriangle, CheckCircle2, PackageCheck, ScanLine, Trash2, X,
} from "lucide-react";
import { Button, Input, Select } from "@/components/ui";
import { BarcodeScanInput } from "@/components/shared";
import WarehouseSelect from "@/components/shared/WarehouseSelect";
import { useLocationOptions } from "@/hooks/useMasterOptions";
import api from "@/services/api";
import type { ReceivableLot, ReceiveScanPair } from "./types";

interface ReceiveScanPanelProps {
  receivable: ReceivableLot[];
  onSuccess: () => void;
}

type ScanPhase = "vendor" | "own" | "bl";
type ScanMode = "vendor" | "bl";

export default function ReceiveScanPanel({ receivable, onSuccess }: ReceiveScanPanelProps) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);

  const [phase, setPhase] = useState<ScanPhase>("own");
  const [input, setInput] = useState("");
  const [pendingMatUid, setPendingMatUid] = useState("");
  const [pairs, setPairs] = useState<ReceiveScanPair[]>([]);
  const [scanMode, setScanMode] = useState<ScanMode>("vendor");
  const [currentBlNo, setCurrentBlNo] = useState("");
  const [warehouseCode, setWarehouseCode] = useState("");
  const [autoLocation, setAutoLocation] = useState(true);
  const [locationCode, setLocationCode] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const { options: locationOptions } = useLocationOptions(warehouseCode);

  const receivableByUid = useMemo(
    () => new Map(receivable.map((lot) => [lot.matUid, lot])),
    [receivable],
  );
  const scannedOwnBarcodes = useMemo(() => new Set(pairs.map((p) => p.matUid)), [pairs]);
  /** 업체바코드도 자체바코드처럼 중복을 막는다 — 같은 라벨을 두 LOT 에 매핑하면 추적이 깨진다. */
  const scannedVendorBarcodes = useMemo(
    () => new Set(pairs.map((p) => p.vendorBarcode).filter(Boolean)),
    [pairs],
  );
  const totalQty = pairs.reduce(
    (sum, p) => sum + (receivableByUid.get(p.matUid)?.remainingQty || 0),
    0,
  );

  const focusInput = useCallback(() => {
    setTimeout(() => inputRef.current?.focus(), 50);
  }, []);

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  /** 입고대기 목록에 없는 이유를 서버에 물어 사유까지 보여준다. */
  const showNotReceivableReason = useCallback(async (matUid: string) => {
    setError(t("material.receive.scan.notReceivable", "입고대기 대상이 아닙니다: {{matUid}}", { matUid }));
    try {
      const res = await api.get(`/material/receiving/reject-reason/${encodeURIComponent(matUid)}`);
      const reason = res.data?.data?.reason;
      if (reason) {
        setError(
          t("material.receive.scan.notReceivableReason", "입고대기 대상이 아닙니다(사유: {{reason}}): {{matUid}}", { reason, matUid }),
        );
      }
    } catch {
      // 사유 조회는 부가 정보다 — 실패해도 기본 메시지는 이미 떠 있다
    }
  }, [t]);

  const handleOwnScan = useCallback(
    (matUid: string) => {
      const lot = receivableByUid.get(matUid);
      if (!lot) {
        void showNotReceivableReason(matUid);
        setInput("");
        focusInput();
        return;
      }
      if (lot.receivingBlockedReason) {
        setError(`${matUid}: ${lot.receivingBlockedReason}`);
        setInput("");
        focusInput();
        return;
      }
      if (scannedOwnBarcodes.has(matUid)) {
        setError(t("material.receive.scan.alreadyScanned", "이미 스캔한 자체바코드입니다: {{matUid}}", { matUid }));
        setInput("");
        focusInput();
        return;
      }
      // BL 방식: 업체바코드 단계 없이 현재 BL 로 바로 목록에 넣는다
      if (scanMode === "bl") {
        setPairs((prev) => [{ vendorBarcode: "", matUid, blNo: currentBlNo }, ...prev]);
        setInput("");
        setError("");
        focusInput();
        return;
      }
      setPendingMatUid(matUid);
      setPhase("vendor");
      setInput("");
      setError("");
      focusInput();
    },
    [currentBlNo, focusInput, receivableByUid, scanMode, scannedOwnBarcodes, t],
  );

  const handleBlScan = useCallback(
    (blNo: string) => {
      setCurrentBlNo(blNo);
      setPhase("own");
      setInput("");
      setError("");
      focusInput();
    },
    [focusInput],
  );

  const changeScanMode = useCallback(
    (mode: ScanMode) => {
      setScanMode(mode);
      setPendingMatUid("");
      setInput("");
      setError("");
      setPhase(mode === "bl" && !currentBlNo ? "bl" : "own");
      focusInput();
    },
    [currentBlNo, focusInput],
  );

  const requestBlChange = useCallback(() => {
    setPhase("bl");
    setInput("");
    setError("");
    focusInput();
  }, [focusInput]);

  const handleVendorScan = useCallback(
    (barcode: string) => {
      if (scannedVendorBarcodes.has(barcode)) {
        const mapped = pairs.find((p) => p.vendorBarcode === barcode)?.matUid ?? "";
        setError(
          t(
            "material.receive.scan.vendorDuplicate",
            "이미 스캔한 업체 바코드입니다: {{barcode}} (매핑: {{matUid}})",
            { barcode, matUid: mapped },
          ),
        );
        setInput("");
        focusInput();
        return;
      }
      setPairs((prev) => [{ vendorBarcode: barcode, matUid: pendingMatUid }, ...prev]);
      setPendingMatUid("");
      setPhase("own");
      setInput("");
      setError("");
      focusInput();
    },
    [focusInput, pendingMatUid, scannedVendorBarcodes, pairs, t],
  );

  const handleScan = useCallback((rawBarcode?: string) => {
    const barcode = (rawBarcode ?? input).replace(/\r?\n|\r/g, "").trim();
    if (!barcode) return;
    if (phase === "bl") handleBlScan(barcode);
    else if (phase === "own") handleOwnScan(barcode);
    else handleVendorScan(barcode);
  }, [handleBlScan, handleOwnScan, handleVendorScan, input, phase]);

  const removePair = useCallback(
    (matUid: string) => {
      setPairs((prev) => prev.filter((p) => p.matUid !== matUid));
      focusInput();
    },
    [focusInput],
  );

  const resetPending = useCallback(() => {
    setPendingMatUid("");
    setPhase(scanMode === "bl" && !currentBlNo ? "bl" : "own");
    setInput("");
    setError("");
    focusInput();
  }, [currentBlNo, focusInput, scanMode]);

  const handleReceive = useCallback(async () => {
    if (pairs.length === 0) return;
    if (!warehouseCode) {
      setError(t("material.receive.scan.selectWarehouse", "입고 창고를 선택해 주세요."));
      return;
    }
    if (!autoLocation && !locationCode.trim()) {
      setError(t("material.receive.scan.selectLocation", "적재위치를 선택하거나 스캔해 주세요."));
      return;
    }
    const manualLocation = !autoLocation ? locationCode.trim() : "";
    setSaving(true);
    setError("");
    try {
      await api.post("/material/receiving", {
        items: pairs
          .slice()
          .reverse()
          .map((pair) => {
            const lot = receivableByUid.get(pair.matUid);
            return {
              matUid: pair.matUid,
              qty: lot?.remainingQty || 0,
              warehouseId: warehouseCode,
              vendorBarcode: pair.vendorBarcode || undefined,
              blNo: pair.blNo || undefined,
              ...(manualLocation ? { locationCode: manualLocation } : {}),
            };
          }),
      });
      // 입고 완료 후 초기화
      setPairs([]);
      // BL 방식이면 다음 입고는 새 BL 부터 찍는다
      setCurrentBlNo("");
      setPhase(scanMode === "bl" ? "bl" : "own");
      setPendingMatUid("");
      setInput("");
      onSuccess();
      focusInput();
    } catch {
      // API 인터셉터에서 상세 메시지 표시
    } finally {
      setSaving(false);
    }
  }, [autoLocation, focusInput, locationCode, onSuccess, pairs, receivableByUid, scanMode, t, warehouseCode]);

  const phaseHint =
    phase === "bl"
      ? t("material.receive.scan.blHint", "BL 번호를 스캔하세요. 이어서 찍는 자재는 모두 이 BL 로 입고됩니다.")
      : phase === "vendor"
        ? t("material.receive.scan.vendorHint", "{{matUid}}에 매핑할 거래처 바코드를 스캔하세요.", {
            matUid: pendingMatUid,
          })
        : scanMode === "bl"
          ? t("material.receive.scan.blOwnHint", "BL {{blNo}} 로 입고할 자체부착 바코드를 연속으로 스캔하세요.", { blNo: currentBlNo })
          : t("material.receive.scan.ownHint", "자체부착 바코드(자재 시리얼)를 먼저 스캔하세요.");
  const scanModes: Array<{ value: ScanMode; label: string }> = [
    { value: "vendor", label: t("material.receive.scan.modeVendor", "업체LOT") },
    { value: "bl", label: t("material.receive.scan.modeBl", "BL") },
  ];

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* 상단 고정 영역 */}
      <div className="flex-shrink-0 p-3 border-b border-border space-y-2.5">
        {/* 헤더 */}
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-text flex items-center gap-1.5">
            <ScanLine className="w-4 h-4 text-primary" />
            {t("material.receive.scan.modalTitle", "스캔 입고처리")}
          </h2>
          <Button
            size="sm"
            onClick={handleReceive}
            disabled={pairs.length === 0 || !warehouseCode || saving} disabledReason={saving ? t('material.disabledHelp.receiveSaving', '자재 입고를 처리하고 있습니다.') : !warehouseCode ? t('material.disabledHelp.receiveWarehouse', '자재를 입고할 창고를 선택하세요.') : t('material.disabledHelp.scanPair', '거래처 바코드와 자재시리얼을 짝으로 스캔하여 입고 목록에 추가하세요.')}
            isLoading={saving}
          >
            <PackageCheck className="w-3.5 h-3.5 mr-1" />
            {t("material.receive.scanReceive", "입고처리")}
            {pairs.length > 0 && ` (${pairs.length})`}
          </Button>
        </div>

        {/* 창고 선택 */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-text-muted whitespace-nowrap w-14 flex-shrink-0">
            {t("material.receive.warehouseLabel", "입고 창고")}
          </span>
          <WarehouseSelect
            warehouseType="RAW"
            autoSelectDefault
            value={warehouseCode}
            onChange={(v) => { setWarehouseCode(v); setLocationCode(""); }}
            fullWidth
          />
        </div>

        {/* 적재위치 */}
        <div className="space-y-1.5">
          <label className="flex items-center gap-2 text-xs text-text cursor-pointer select-none">
            <input
              type="checkbox"
              className="w-3.5 h-3.5 accent-primary"
              checked={autoLocation}
              onChange={(e) => { setAutoLocation(e.target.checked); setError(""); }}
            />
            {t("material.receive.autoLocation", "품목마스터 위치 자동 사용")}
          </label>
          {!autoLocation && (
            <div className="space-y-1.5">
              {locationOptions.length > 0 && (
                <Select
                  options={locationOptions}
                  value={locationCode}
                  onChange={(v) => { setLocationCode(v); setError(""); }}
                  placeholder={t("material.receive.selectLocation", "로케이션 선택")}
                  fullWidth
                />
              )}
              <BarcodeScanInput
                value={locationCode}
                onChange={(value) => { setLocationCode(value); setError(""); }}
                onScan={(value) => { setLocationCode(value); setError(""); focusInput(); }}
                placeholder={t("material.receive.scanLocation", "로케이션 바코드 스캔")}
                className="font-mono"
                maintainFocus={false}
                fullWidth
              />
            </div>
          )}
        </div>

        {/* 스캔 방식: 업체LOT(1:1) / BL(한 번 찍고 여러 자재) */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-text-muted whitespace-nowrap w-14 flex-shrink-0">
            {t("material.receive.scan.mode", "스캔 방식")}
          </span>
          <div className="flex rounded border border-border p-0.5" role="radiogroup" aria-label={t("material.receive.scan.mode", "스캔 방식")}>
            {scanModes.map((mode) => (
              <button
                key={mode.value}
                type="button"
                role="radio"
                aria-checked={scanMode === mode.value}
                data-testid={`receive-scan-mode-${mode.value}`}
                onClick={() => changeScanMode(mode.value)}
                className={`rounded px-3 py-1 text-xs font-medium transition-colors ${
                  scanMode === mode.value ? "bg-primary text-white" : "text-text-muted hover:text-text"
                }`}
              >
                {mode.label}
              </button>
            ))}
          </div>
          {scanMode === "bl" && currentBlNo && (
            <div className="flex min-w-0 flex-1 items-center justify-end gap-1.5 text-xs">
              <span className="text-text-muted">BL</span>
              <span className="truncate font-mono font-semibold text-primary" title={currentBlNo}>{currentBlNo}</span>
              <button type="button" onClick={requestBlChange} className="shrink-0 text-primary hover:underline" data-testid="receive-scan-bl-change">
                {t("material.receive.scan.blChange", "BL 변경")}
              </button>
            </div>
          )}
        </div>

        {/* 스캔 입력 */}
        <div className="space-y-1">
          <p className="text-xs text-text-muted">{phaseHint}</p>
          <div className="flex gap-1.5">
            <div className="flex-1 min-w-0">
              <BarcodeScanInput
                ref={inputRef}
                value={input}
                onChange={setInput}
                onScan={handleScan}
                placeholder={
                  phase === "bl"
                    ? t("material.receive.scan.blPlaceholder", "BL 번호")
                    : phase === "own"
                      ? t("material.receive.scan.ownPlaceholder", "자체부착 바코드")
                      : t("material.receive.scan.vendorPlaceholder", "거래처 바코드")
                }
                className={`h-9 text-sm ${phase !== "own" ? "border-primary" : ""}`}
                fullWidth
              />
            </div>
            <Button size="sm" onClick={() => handleScan()} disabled={!input.trim()} disabledReason={t('material.disabledHelp.scanBarcode', '자재 바코드를 입력하거나 스캔하세요.')} className="h-9 flex-shrink-0">
              {t("material.receive.scan.scanRegister", "스캔")}
            </Button>
          </div>
        </div>

        {/* 거래처 바코드 대기 안내 */}
        {phase === "vendor" && (
          <div className="flex items-center justify-between rounded border border-primary/30 bg-primary/5 px-2.5 py-1.5 text-xs">
            <span>
              <span className="text-text-muted">스캔됨:</span>{" "}
              <span className="font-mono font-semibold text-primary">{pendingMatUid}</span>
            </span>
            <button type="button" onClick={resetPending} className="text-text-muted hover:text-text">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* 에러 */}
        {error && (
          <div className="flex items-center gap-1.5 rounded border border-red-300 bg-red-50 px-2.5 py-1.5 text-xs text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300">
            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
            {error}
          </div>
        )}

        {/* 건수 요약 */}
        {pairs.length > 0 && (
          <div className="flex items-center gap-1.5 text-xs text-text-muted">
            <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
            <span>
              {t("material.receive.scan.countCases", "{{count}}건", { count: pairs.length })}{" "}
              /{" "}
              <span className="font-medium text-text">{totalQty.toLocaleString()}</span>{" "}
              {t("common.ea", "개")}
            </span>
          </div>
        )}
      </div>

      {/* 하단 스크롤: 매핑 목록 */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="px-3 py-1.5 border-b border-border bg-muted/50 sticky top-0">
          <span className="text-xs font-semibold text-text-muted">
            {t("material.receive.scan.mappingList", "스캔 매핑 목록")}
          </span>
        </div>
        {pairs.length === 0 ? (
          <div className="px-3 py-8 text-center text-xs text-text-muted">
            {t("material.receive.scan.noMapping", "스캔된 바코드 매핑이 없습니다.")}
          </div>
        ) : (
          <table className="w-full text-xs">
            <thead className="bg-muted dark:bg-slate-800 sticky top-8 z-10 text-left text-text-muted">
              <tr>
                <th className="px-2.5 py-1.5">{t("material.receive.scan.ownBarcode", "자체바코드")}</th>
                <th className="px-2.5 py-1.5">{t("material.receive.scan.vendorOrBl", "업체바코드 / BL")}</th>
                <th className="px-2.5 py-1.5">{t("common.partCode", "품번")}</th>
                <th className="px-2.5 py-1.5 text-right">{t("material.receive.col.inputQty", "수량")}</th>
                <th className="w-8 px-2.5 py-1.5" />
              </tr>
            </thead>
            <tbody>
              {pairs.map((pair) => {
                const lot = receivableByUid.get(pair.matUid);
                return (
                  <tr key={pair.matUid} className="border-t border-border hover:bg-muted/50">
                    <td className="px-2.5 py-1.5 font-mono truncate max-w-0" style={{ maxWidth: 150 }}>
                      {pair.matUid}
                    </td>
                    <td
                      className="px-2.5 py-1.5 font-mono truncate max-w-0"
                      style={{ maxWidth: 150 }}
                      title={pair.vendorBarcode || pair.blNo || undefined}
                    >
                      {pair.blNo ? <><span className="text-text-muted">BL </span>{pair.blNo}</> : pair.vendorBarcode || "-"}
                    </td>
                    <td className="px-2.5 py-1.5 truncate max-w-0" style={{ maxWidth: 110 }}>
                      {lot?.part?.itemCode || lot?.itemCode || "-"}
                    </td>
                    <td className="px-2.5 py-1.5 text-right font-medium text-text whitespace-nowrap">
                      {(lot?.remainingQty || 0).toLocaleString()}
                    </td>
                    <td className="px-2.5 py-1.5">
                      <button
                        type="button"
                        onClick={() => removePair(pair.matUid)}
                        className="text-text-muted hover:text-red-600 dark:hover:text-red-400"
                        aria-label={t("material.receive.scan.removeMapping", "삭제")}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
