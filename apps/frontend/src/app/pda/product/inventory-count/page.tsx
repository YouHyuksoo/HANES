"use client";

/**
 * @file src/app/pda/product/inventory-count/page.tsx
 * @description 제품 재고실사 PDA 페이지 - 옵션 설정 → 바코드 스캔 → 자동/수동 실사 순환
 *
 * 초보자 가이드:
 * 1. 옵션 설정: 실사기준월, 창고, 기본수량 1개, 실사구분(정상/취소)
 * 2. 기본수량 1개 ON: 바코드 스캔 즉시 수량 1로 자동 실사 → 다음 스캔
 * 3. 기본수량 1개 OFF: 스캔 → 수량 입력 → Enter 저장 → 다음 스캔
 * 4. 에러 발생 시 건너뛰기 버튼으로 다음 스캔 가능
 * 5. 실사 완료 이력이 하단에 누적 표시 (취소 건은 빨간 배지)
 */
import { useState, useCallback, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import PdaHeader from "@/components/pda/PdaHeader";
import ScanInput from "@/components/pda/ScanInput";
import type { ScanInputHandle } from "@/components/pda/ScanInput";
import ScanResultCard from "@/components/pda/ScanResultCard";
import type { ScanResultField } from "@/components/pda/ScanResultCard";
import ScanHistoryList from "@/components/pda/ScanHistoryList";
import { useSoundFeedback } from "@/components/pda/SoundFeedback";
import { useBarcodeDetector } from "@/hooks/pda/useBarcodeDetector";
import { BoxSelect, RotateCcw } from "lucide-react";
import ProductInvCountOptions, {
  getCurrentMonth,
  type CountType,
} from "@/components/pda/ProductInvCountOptions";
import {
  useProductInvCount,
  type ProductCountHistoryItem,
} from "@/hooks/pda/useProductInvCount";

export default function ProductInventoryCountPage() {
  const { t } = useTranslation();
  const { playSuccess, playError } = useSoundFeedback();
  const scanRef = useRef<ScanInputHandle>(null);

  /** 스캔 입력창으로 포커스 복원 */
  const refocusScan = useCallback(() => {
    setTimeout(() => scanRef.current?.focus(), 150);
  }, []);

  /* ─── 옵션 상태 ─── */
  const [countMonth, setCountMonth] = useState(getCurrentMonth);
  const [warehouseCode, setWarehouseId] = useState("");
  const [defaultQty1, setDefaultQty1] = useState(true);
  const [countType, setCountType] = useState<CountType>("NORMAL");
  const [actualQty, setActualQty] = useState("");

  /* ─── 훅 ─── */
  const {
    scannedProduct,
    isScanning,
    isCounting,
    error,
    history,
    handleScan,
    handleCount,
    handleReset,
  } = useProductInvCount({ countMonth, warehouseCode, countType });

  /** 바코드 스캔 (자동 모드 시 즉시 카운트 → 포커스 복원) */
  const onScan = useCallback(
    async (barcode: string) => {
      setActualQty("");
      const product = await handleScan(barcode);
      if (product && defaultQty1) {
        const ok = await handleCount(1);
        if (ok) playSuccess();
        else playError();
        refocusScan();
      }
    },
    [handleScan, handleCount, defaultQty1, playSuccess, playError, refocusScan],
  );

  /** 하드웨어 스캐너 감지 */
  useBarcodeDetector({
    onScan,
    enabled: !scannedProduct && !isCounting,
  });

  /** 수동 모드: 차이 계산 */
  const numActualQty = Number(actualQty);
  const hasValidQty =
    actualQty !== "" && !isNaN(numActualQty) && numActualQty >= 0;

  /** 수동 모드: 확인 처리 (Enter 또는 버튼) → 포커스 복원 */
  const onConfirm = useCallback(async () => {
    if (!hasValidQty) return;
    const ok = await handleCount(numActualQty);
    if (ok) {
      playSuccess();
      setActualQty("");
      refocusScan();
    } else {
      playError();
    }
  }, [hasValidQty, numActualQty, handleCount, playSuccess, playError, refocusScan]);

  /** Enter 키로 저장 */
  const onQtyKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") onConfirm();
    },
    [onConfirm],
  );

  /** 건너뛰기/리셋 → 포커스 복원 */
  const onSkip = useCallback(() => {
    handleReset();
    setActualQty("");
    refocusScan();
  }, [handleReset, refocusScan]);

  /** 스캔 결과 필드 */
  const resultFields: ScanResultField[] = useMemo(() => {
    if (!scannedProduct) return [];
    return [
      { label: t("pda.shipping.partCode"), value: scannedProduct.itemCode, highlight: true },
      { label: t("pda.shipping.partName"), value: scannedProduct.itemName },
      { label: t("pda.productInvCount.systemQty"), value: scannedProduct.systemQty },
      { label: t("pda.productInvCount.warehouse"), value: scannedProduct.warehouseName },
    ];
  }, [scannedProduct, t]);

  /** 차이 표시 */
  const difference = scannedProduct ? numActualQty - scannedProduct.systemQty : 0;
  const diffDisplay = useMemo(() => {
    if (!hasValidQty) return null;
    if (difference > 0)
      return { color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800", label: t("pda.productInvCount.surplus"), sign: "+" };
    if (difference < 0)
      return { color: "text-red-600 dark:text-red-400", bg: "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800", label: t("pda.productInvCount.shortage"), sign: "" };
    return { color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800", label: t("pda.productInvCount.match"), sign: "" };
  }, [hasValidQty, difference, t]);

  /** 이력 렌더 */
  const renderHistoryItem = useCallback(
    (item: ProductCountHistoryItem) => {
      const diff = item.difference;
      const diffColor =
        diff > 0 ? "text-blue-600 dark:text-blue-400" : diff < 0 ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400";
      return (
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-1.5">
              <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{item.itemCode}</p>
              {item.countType === "CANCEL" && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400">
                  {t("pda.productInvCount.countTypeCancel")}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">{item.itemName}</p>
          </div>
          <div className="text-right">
            <p className={`text-sm font-bold ${diffColor}`}>
              {diff > 0 ? "+" : ""}{diff}
            </p>
            <p className="text-xs text-slate-400">{item.systemQty} → {item.actualQty}</p>
            <p className="text-xs text-slate-400">{item.timestamp}</p>
          </div>
        </div>
      );
    },
    [t],
  );

  const optionsDisabled = !!scannedProduct || isScanning || isCounting;
  const showManualInput = !!scannedProduct && !defaultQty1 && !error;

  return (
    <>
      <PdaHeader titleKey="pda.productInvCount.title" backPath="/pda/menu" />

      {/* 옵션 패널 */}
      <ProductInvCountOptions
        countMonth={countMonth}
        onCountMonthChange={setCountMonth}
        warehouseCode={warehouseCode}
        onWarehouseIdChange={setWarehouseId}
        defaultQty1={defaultQty1}
        onDefaultQty1Change={setDefaultQty1}
        countType={countType}
        onCountTypeChange={setCountType}
        disabled={optionsDisabled}
      />

      {/* 바코드 스캔 (항상 포커스 유지) */}
      <ScanInput
        ref={scanRef}
        onScan={onScan}
        placeholderKey="pda.productInvCount.scanBarcode"
        disabled={!!scannedProduct}
        isLoading={isScanning || isCounting}
      />

      {/* 에러 표시 + 건너뛰기 */}
      {error && (
        <>
          <ScanResultCard fields={[]} variant="error" errorMessage={error} />
          <div className="px-4 mt-2">
            <button
              type="button"
              onClick={onSkip}
              className="w-full h-10 rounded-xl border-2 border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm font-bold text-slate-600 dark:text-slate-400 flex items-center justify-center gap-2 active:bg-slate-100 dark:active:bg-slate-800"
            >
              <RotateCcw className="w-4 h-4" />
              {t("pda.scan.nextScan")}
            </button>
          </div>
        </>
      )}

      {/* 수동 모드: 결과 + 수량 입력 */}
      {showManualInput && (
        <>
          <ScanResultCard
            fields={resultFields}
            variant="success"
            title={t("pda.scan.success")}
          />
          <div className="px-4 mt-3 space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                {t("pda.productInvCount.actualQty")}
              </label>
              <input
                type="number"
                inputMode="numeric"
                value={actualQty}
                onChange={(e) => setActualQty(e.target.value)}
                onKeyDown={onQtyKeyDown}
                placeholder={t("pda.productInvCount.actualQtyPlaceholder")}
                className="w-full h-12 px-4 text-lg font-bold bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-600 rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none text-slate-900 dark:text-white placeholder:text-slate-400"
                min={0}
                autoFocus
              />
            </div>
            {diffDisplay && (
              <div className={`p-3 rounded-xl border ${diffDisplay.bg} flex items-center justify-between`}>
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                  {t("pda.productInvCount.difference")}
                </span>
                <div className="flex items-center gap-2">
                  <span className={`text-lg font-bold ${diffDisplay.color}`}>
                    {diffDisplay.sign}{difference}
                  </span>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${diffDisplay.color} ${diffDisplay.bg}`}>
                    {diffDisplay.label}
                  </span>
                </div>
              </div>
            )}
            <button
              type="button"
              onClick={onSkip}
              className="w-full h-9 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-xs font-medium text-slate-500 dark:text-slate-400 flex items-center justify-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              {t("pda.productInvCount.skip")}
            </button>
          </div>
        </>
      )}

      {/* 스캔 전 안내 */}
      {!scannedProduct && !error && !isScanning && (
        <div className="mx-4 mt-4 p-8 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900">
          <div className="text-center">
            <BoxSelect className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
              {t("pda.productInvCount.scanBarcode")}
            </p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
              {defaultQty1
                ? t("pda.productInvCount.autoCountHint")
                : t("pda.productInvCount.manualCountHint")}
            </p>
          </div>
        </div>
      )}

      {/* 이력 */}
      <ScanHistoryList
        items={history}
        renderItem={renderHistoryItem}
        keyExtractor={(item, idx) => `${item.barcode}-${idx}`}
      />
    </>
  );
}
