"use client";

/**
 * @file src/app/(pda)/material/inventory-count/page.tsx
 * @description 자재 재고실사 PDA 페이지 - LOT 스캔 → 시스템수량 확인 → 실사수량 입력 → 차이 표시
 *
 * 초보자 가이드:
 * 1. ScanInput: LOT 바코드 스캔 (LOT번호로 시스템 재고 조회)
 * 2. ScanResultCard: 스캔 결과 표시 (LOT번호, 품목, 시스템수량)
 * 3. 실사수량 입력: 실제 실물 수량을 입력
 * 4. 차이 표시: actualQty - systemQty (색상 코딩: 일치=초록, 불일치=빨강)
 * 5. PdaActionButton: 실사확인 + 다음스캔 버튼
 * 6. ScanHistoryList: 실사 완료 이력 (차이 포함)
 * 7. useBarcodeDetector: 하드웨어 스캐너 키보드 이벤트 감지
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
import { ClipboardList } from "lucide-react";
import {
  useMatInventoryCount,
  type CountHistoryItem,
} from "@/hooks/pda/useMatInventoryCount";

export default function MaterialInventoryCountPage() {
  const { t } = useTranslation();
  const { playSuccess, playError } = useSoundFeedback();
  const {
    scannedLot,
    isScanning,
    isCounting,
    error,
    history,
    handleScan,
    handleCount,
    handleReset,
  } = useMatInventoryCount();

  /** 실사수량 */
  const [actualQty, setActualQty] = useState<string>("");

  /** 바코드 스캔 처리 */
  const onScan = useCallback(
    async (matUid: string) => {
      await handleScan(matUid);
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
        label: t("pda.issuing.matUid"),
        value: scannedLot.matUid,
        highlight: true,
      },
      { label: t("pda.receiving.partCode"), value: scannedLot.itemCode },
      { label: t("pda.receiving.partName"), value: scannedLot.itemName },
      {
        label: t("pda.inventoryCount.systemQty"),
        value: `${scannedLot.systemQty} ${scannedLot.unit}`,
      },
    ];
  }, [scannedLot, t]);

  /** 차이 계산 */
  const difference = useMemo(() => {
    if (!scannedLot || actualQty === "") return null;
    return Number(actualQty) - scannedLot.systemQty;
  }, [scannedLot, actualQty]);

  /** 수량 유효성 */
  const isQtyValid = actualQty !== "" && Number(actualQty) >= 0;

  /** 실사 확인 */
  const onConfirm = useCallback(async () => {
    if (!isQtyValid) return;
    const success = await handleCount(Number(actualQty));
    if (success) {
      playSuccess();
      setActualQty("");
    } else {
      playError();
    }
  }, [actualQty, isQtyValid, handleCount, playSuccess, playError]);

  /** 다음 스캔 */
  const onNextScan = useCallback(() => {
    handleReset();
    setActualQty("");
  }, [handleReset]);

  /** 차이 색상 */
  const getDifferenceColor = (diff: number) => {
    if (diff === 0) return "text-emerald-600 dark:text-emerald-400";
    return "text-red-600 dark:text-red-400";
  };

  /** 차이 텍스트 */
  const getDifferenceText = (diff: number) => {
    if (diff === 0) return "0";
    return diff > 0 ? `+${diff}` : `${diff}`;
  };

  /** 이력 렌더 */
  const renderHistoryItem = useCallback(
    (item: CountHistoryItem) => (
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
            {item.itemCode}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {item.matUid}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {item.systemQty} → {item.actualQty}
          </p>
          <p className={`text-sm font-bold ${getDifferenceColor(item.difference)}`}>
            {getDifferenceText(item.difference)}
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
        titleKey="pda.inventoryCount.title"
        backPath="/pda/material/menu"
      />

      {/* LOT 바코드 스캔 */}
      <ScanInput
        onScan={onScan}
        placeholderKey="pda.inventoryCount.scanLot"
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
            <ClipboardList className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
              {t("pda.inventoryCount.scanLot")}
            </p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
              {t("pda.inventoryCount.title")}
            </p>
          </div>
        </div>
      )}

      {/* 실사수량 입력 + 차이 표시 */}
      {scannedLot && (
        <div className="px-4 mt-3 space-y-3">
          {/* 실사수량 */}
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
              {t("pda.inventoryCount.actualQty")}
            </label>
            <input
              type="number"
              inputMode="numeric"
              value={actualQty}
              onChange={(e) => setActualQty(e.target.value)}
              className="w-full h-12 px-4 text-lg font-bold bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-600 rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none text-slate-900 dark:text-white"
              min={0}
            />
          </div>

          {/* 차이 표시 */}
          {difference !== null && (
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
              <span className="text-sm font-medium text-slate-600 dark:text-slate-400">
                {t("pda.inventoryCount.difference")}
              </span>
              <span
                className={`text-xl font-bold ${getDifferenceColor(difference)}`}
              >
                {getDifferenceText(difference)}
              </span>
            </div>
          )}
        </div>
      )}

      {/* 이력 */}
      <ScanHistoryList
        items={history}
        renderItem={renderHistoryItem}
        keyExtractor={(item, idx) => `${item.matUid}-${idx}`}
      />

      {/* 하단 버튼 */}
      {scannedLot && (
        <PdaActionButton
          buttons={[
            {
              label: t("pda.inventoryCount.confirmCount"),
              onClick: onConfirm,
              variant: "primary",
              isLoading: isCounting,
              disabled: !isQtyValid,
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
