"use client";

/**
 * @file material/receive/components/ReceiveScanPanel.tsx
 * @description 우측 스캔 입고 패널 — ReceiveScanModal을 우측 고정 패널로 변환
 *
 * 레이아웃:
 *   상단(고정): 창고·위치 선택 + 스캔 입력 + 단계 안내 + 에러 + 입고처리 버튼
 *   하단(스크롤): 스캔 매핑 목록 테이블
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

type ScanPhase = "vendor" | "own";

export default function ReceiveScanPanel({ receivable, onSuccess }: ReceiveScanPanelProps) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);

  const [phase, setPhase] = useState<ScanPhase>("own");
  const [input, setInput] = useState("");
  const [pendingMatUid, setPendingMatUid] = useState("");
  const [pairs, setPairs] = useState<ReceiveScanPair[]>([]);
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

  const handleOwnScan = useCallback(
    (matUid: string) => {
      const lot = receivableByUid.get(matUid);
      if (!lot) {
        setError(t("material.receive.scan.notReceivable", "입고대기 대상이 아닙니다: {{matUid}}", { matUid }));
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
      setPendingMatUid(matUid);
      setPhase("vendor");
      setInput("");
      setError("");
      focusInput();
    },
    [focusInput, receivableByUid, scannedOwnBarcodes, t],
  );

  const handleVendorScan = useCallback(
    (barcode: string) => {
      setPairs((prev) => [{ vendorBarcode: barcode, matUid: pendingMatUid }, ...prev]);
      setPendingMatUid("");
      setPhase("own");
      setInput("");
      setError("");
      focusInput();
    },
    [focusInput, pendingMatUid],
  );

  const handleScan = useCallback((rawBarcode?: string) => {
    const barcode = (rawBarcode ?? input).replace(/\r?\n|\r/g, "").trim();
    if (!barcode) return;
    if (phase === "own") handleOwnScan(barcode);
    else handleVendorScan(barcode);
  }, [handleOwnScan, handleVendorScan, input, phase]);

  const removePair = useCallback(
    (matUid: string) => {
      setPairs((prev) => prev.filter((p) => p.matUid !== matUid));
      focusInput();
    },
    [focusInput],
  );

  const resetPending = useCallback(() => {
    setPendingMatUid("");
    setPhase("own");
    setInput("");
    setError("");
    focusInput();
  }, [focusInput]);

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
              vendorBarcode: pair.vendorBarcode,
              ...(manualLocation ? { locationCode: manualLocation } : {}),
            };
          }),
      });
      // 입고 완료 후 초기화
      setPairs([]);
      setPhase("own");
      setPendingMatUid("");
      setInput("");
      onSuccess();
      focusInput();
    } catch {
      // API 인터셉터에서 상세 메시지 표시
    } finally {
      setSaving(false);
    }
  }, [autoLocation, focusInput, locationCode, onSuccess, pairs, receivableByUid, t, warehouseCode]);

  const phaseTitle =
    phase === "own"
      ? t("material.receive.scan.ownTitle", "자재 바코드 스캔")
      : t("material.receive.scan.vendorTitle", "거래처 바코드 스캔");
  const phaseHint =
    phase === "own"
      ? t("material.receive.scan.ownHint", "자체부착 바코드(자재 시리얼)를 먼저 스캔하세요.")
      : t("material.receive.scan.vendorHint", "{{matUid}}에 매핑할 거래처 바코드를 스캔하세요.", {
          matUid: pendingMatUid,
        });

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
            disabled={pairs.length === 0 || !warehouseCode || saving}
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
                  phase === "own"
                    ? t("material.receive.scan.ownPlaceholder", "자체부착 바코드")
                    : t("material.receive.scan.vendorPlaceholder", "거래처 바코드")
                }
                className={`h-9 text-sm ${phase === "vendor" ? "border-primary" : ""}`}
                fullWidth
              />
            </div>
            <Button size="sm" onClick={() => handleScan()} disabled={!input.trim()} className="h-9 flex-shrink-0">
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
                    <td className="px-2.5 py-1.5 font-mono truncate max-w-0" style={{ maxWidth: 100 }}>
                      {pair.matUid}
                    </td>
                    <td className="px-2.5 py-1.5 truncate max-w-0" style={{ maxWidth: 80 }}>
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
