"use client";

/**
 * @file src/app/(pda)/material/adjustment/page.tsx
 * @description 재고조정 PDA 페이지 - LOT 스캔 → 현재 수량 확인 → 조정 수량/사유 입력 → 확인
 *
 * 초보자 가이드:
 * 1. ScanInput: LOT 바코드 스캔 (LOT번호로 현재 재고 조회)
 * 2. ScanResultCard: 현재 재고 정보 표시
 * 3. 조정수량 입력: 양수(+) = 재고 증가, 음수(-) = 재고 감소
 * 4. 조정사유 입력: 필수 입력 (예: 파손, 오입고 보정, 재검수)
 * 5. PdaActionButton: 조정확인 버튼
 * 6. useBarcodeDetector: 하드웨어 스캐너 키보드 이벤트 감지
 */
import { useState, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import PdaHeader from "@/components/pda/PdaHeader";
import ScanInput from "@/components/pda/ScanInput";
import ScanResultCard from "@/components/pda/ScanResultCard";
import type { ScanResultField } from "@/components/pda/ScanResultCard";
import ScanHistoryList from "@/components/pda/ScanHistoryList";
import PdaActionButton from "@/components/pda/PdaActionButton";
import { useSoundFeedback } from "@/components/pda/SoundFeedback";
import { useBarcodeDetector } from "@/hooks/pda/useBarcodeDetector";
import { RefreshCw } from "lucide-react";
import {
  useMatAdjustment,
  type AdjustmentHistoryItem,
} from "@/hooks/pda/useMatAdjustment";

export default function MaterialAdjustmentPage() {
  const { t } = useTranslation();
  const { playSuccess, playError } = useSoundFeedback();
  const {
    scannedLot,
    isScanning,
    isAdjusting,
    error,
    history,
    handleScan,
    handleAdjust,
    handleReset,
  } = useMatAdjustment();

  /** 조정수량 */
  const [adjustQty, setAdjustQty] = useState<string>("");
  /** 조정사유 */
  const [reason, setReason] = useState<string>("");

  /** 바코드 스캔 처리 */
  const onScan = useCallback(
    async (lotNo: string) => {
      await handleScan(lotNo);
    },
    [handleScan],
  );

  /** 하드웨어 스캐너 감지 */
  useBarcodeDetector({
    onScan,
    enabled: !scannedLot,
  });

  /** 스캔 결과 필드 구성 */
  const resultFields: ScanResultField[] = useMemo(() => {
    if (!scannedLot) return [];
    return [
      {
        label: t("pda.issuing.lotNo"),
        value: scannedLot.lotNo,
        highlight: true,
      },
      { label: t("pda.receiving.partCode"), value: scannedLot.partCode },
      { label: t("pda.receiving.partName"), value: scannedLot.partName },
      {
        label: t("pda.adjustment.currentQty"),
        value: `${scannedLot.currentQty} ${scannedLot.unit}`,
      },
    ];
  }, [scannedLot, t]);

  /** 사유 유효성 */
  const isReasonValid = reason.trim().length > 0;
  /** 수량 유효성 */
  const isQtyValid = adjustQty !== "" && Number(adjustQty) !== 0;

  /** 조정 확인 */
  const onConfirm = useCallback(async () => {
    if (!isQtyValid || !isReasonValid) return;
    const success = await handleAdjust(Number(adjustQty), reason.trim());
    if (success) {
      playSuccess();
      setAdjustQty("");
      setReason("");
    } else {
      playError();
    }
  }, [adjustQty, reason, isQtyValid, isReasonValid, handleAdjust, playSuccess, playError]);

  /** 다음 스캔 */
  const onNextScan = useCallback(() => {
    handleReset();
    setAdjustQty("");
    setReason("");
  }, [handleReset]);

  /** 이력 렌더 */
  const renderHistoryItem = useCallback(
    (item: AdjustmentHistoryItem) => (
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
            {item.partCode}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {item.lotNo}
          </p>
        </div>
        <div className="text-right">
          <p
            className={`text-sm font-bold ${
              item.adjustQty > 0
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-red-600 dark:text-red-400"
            }`}
          >
            {item.adjustQty > 0 ? `+${item.adjustQty}` : item.adjustQty}
          </p>
          <p className="text-xs text-slate-400">{item.timestamp}</p>
        </div>
      </div>
    ),
    [],
  );

  return (
    <>
      <PdaHeader
        titleKey="pda.adjustment.title"
        backPath="/pda/material/menu"
      />

      {/* LOT 바코드 스캔 */}
      <ScanInput
        onScan={onScan}
        placeholderKey="pda.adjustment.scanLot"
        disabled={!!scannedLot}
        isLoading={isScanning}
      />

      {/* 스캔 결과 / 에러 */}
      {(scannedLot || error) && (
        <ScanResultCard
          fields={resultFields}
          variant={error ? "error" : "info"}
          title={error ? undefined : t("pda.scan.success")}
          errorMessage={error || undefined}
        />
      )}

      {/* 스캔 전 안내 */}
      {!scannedLot && !error && !isScanning && (
        <div className="mx-4 mt-4 p-8 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900">
          <div className="text-center">
            <RefreshCw className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
              {t("pda.adjustment.scanLot")}
            </p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
              {t("pda.adjustment.title")}
            </p>
          </div>
        </div>
      )}

      {/* 조정수량 / 사유 입력 */}
      {scannedLot && (
        <div className="px-4 mt-3 space-y-3">
          {/* 조정수량 */}
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
              {t("pda.adjustment.adjustQty")}
            </label>
            <input
              type="number"
              inputMode="numeric"
              value={adjustQty}
              onChange={(e) => setAdjustQty(e.target.value)}
              placeholder="+10 / -5"
              className="w-full h-12 px-4 text-lg font-bold bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-600 rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none text-slate-900 dark:text-white placeholder:text-slate-400"
            />
          </div>

          {/* 조정사유 */}
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
              {t("pda.adjustment.reason")}
              <span className="text-red-500 ml-0.5">*</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={t("pda.adjustment.reasonRequired")}
              rows={2}
              className="w-full px-4 py-3 text-base bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-600 rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none resize-none text-slate-900 dark:text-white placeholder:text-slate-400"
            />
          </div>
        </div>
      )}

      {/* 이력 */}
      <ScanHistoryList
        items={history}
        renderItem={renderHistoryItem}
        keyExtractor={(item, idx) => `${item.lotNo}-${idx}`}
      />

      {/* 하단 버튼 */}
      {scannedLot && (
        <PdaActionButton
          buttons={[
            {
              label: t("pda.adjustment.confirmAdjust"),
              onClick: onConfirm,
              variant: "primary",
              isLoading: isAdjusting,
              disabled: !isQtyValid || !isReasonValid,
            },
            {
              label: t("pda.scan.nextScan"),
              onClick: onNextScan,
              variant: "secondary",
            },
          ]}
        />
      )}
    </>
  );
}
