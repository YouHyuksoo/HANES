"use client";

/**
 * @file src/app/(pda)/material/issuing/page.tsx
 * @description 자재출고 PDA 페이지 - LOT 바코드 스캔 → 재고 확인 → 전량 출고
 *
 * 초보자 가이드:
 * 1. ScanInput: LOT 바코드 스캔 (LOT번호로 재고 조회)
 * 2. ScanResultCard: 스캔 결과 표시 (LOT번호, 품목, 잔여수량, 창고)
 * 3. PdaActionButton: 전량출고 + 다음스캔 버튼
 * 4. ScanHistoryList: 출고 완료 이력 표시
 * 5. useBarcodeDetector: 하드웨어 스캐너 키보드 이벤트 감지
 */
import { useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import PdaHeader from "@/components/pda/PdaHeader";
import ScanInput from "@/components/pda/ScanInput";
import ScanResultCard from "@/components/pda/ScanResultCard";
import type { ScanResultField } from "@/components/pda/ScanResultCard";
import ScanHistoryList from "@/components/pda/ScanHistoryList";
import PdaActionButton from "@/components/pda/PdaActionButton";
import { useSoundFeedback } from "@/components/pda/SoundFeedback";
import { useBarcodeDetector } from "@/hooks/pda/useBarcodeDetector";
import { PackageMinus } from "lucide-react";
import {
  useMatIssuingScan,
  type IssuingHistoryItem,
} from "@/hooks/pda/useMatIssuingScan";

export default function MaterialIssuingPage() {
  const { t } = useTranslation();
  const { playSuccess, playError } = useSoundFeedback();
  const {
    scannedLot,
    isScanning,
    isIssuing,
    error,
    history,
    handleScan,
    handleIssue,
    handleReset,
  } = useMatIssuingScan();

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
      { label: t("pda.issuing.partCode"), value: scannedLot.partCode },
      { label: t("pda.issuing.partName"), value: scannedLot.partName },
      {
        label: t("pda.issuing.remainQty"),
        value: `${scannedLot.remainQty} ${scannedLot.unit}`,
      },
      { label: t("pda.issuing.warehouse"), value: scannedLot.warehouse },
    ];
  }, [scannedLot, t]);

  /** 전량 출고 */
  const onIssue = useCallback(async () => {
    const success = await handleIssue();
    if (success) {
      playSuccess();
    } else {
      playError();
    }
  }, [handleIssue, playSuccess, playError]);

  /** 다음 스캔 */
  const onNextScan = useCallback(() => {
    handleReset();
  }, [handleReset]);

  /** 이력 렌더 */
  const renderHistoryItem = useCallback(
    (item: IssuingHistoryItem) => (
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
          <p className="text-sm font-bold text-amber-600 dark:text-amber-400">
            -{item.issuedQty}
          </p>
          <p className="text-xs text-slate-400">{item.timestamp}</p>
        </div>
      </div>
    ),
    [],
  );

  return (
    <>
      <PdaHeader titleKey="pda.issuing.title" backPath="/pda/material/menu" />

      {/* LOT 바코드 스캔 입력 */}
      <ScanInput
        onScan={onScan}
        placeholderKey="pda.issuing.scanLot"
        disabled={!!scannedLot}
        isLoading={isScanning}
      />

      {/* 스캔 결과 / 에러 */}
      {(scannedLot || error) && (
        <ScanResultCard
          fields={resultFields}
          variant={error ? "error" : "success"}
          title={error ? undefined : t("pda.scan.success")}
          errorMessage={error || undefined}
        />
      )}

      {/* 스캔 전 안내 */}
      {!scannedLot && !error && !isScanning && (
        <div className="mx-4 mt-4 p-8 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900">
          <div className="text-center">
            <PackageMinus className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
              {t("pda.issuing.scanLot")}
            </p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
              {t("pda.issuing.title")}
            </p>
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
              label: t("pda.issuing.issueAll"),
              onClick: onIssue,
              variant: "primary",
              isLoading: isIssuing,
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
