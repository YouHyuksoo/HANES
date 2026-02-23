"use client";

/**
 * @file src/app/(pda)/material/receiving/page.tsx
 * @description 자재입고 PDA 페이지 - 바코드 스캔 → 입고 데이터 확인 → 수량 입력 → 입고 확인
 *
 * 초보자 가이드:
 * 1. ScanInput: 입고 바코드 스캔 (발주번호 바코드)
 * 2. ScanResultCard: 스캔 결과 표시 (발주번호, 품목, 수량, 거래처)
 * 3. 입고수량 입력: 기본값은 발주수량, 사용자가 수정 가능
 * 4. PdaActionButton: 입고확인 + 다음스캔 버튼
 * 5. ScanHistoryList: 입고 완료 이력 표시
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
import { PackageCheck } from "lucide-react";
import {
  useMatReceivingScan,
  type ReceivingHistoryItem,
} from "@/hooks/pda/useMatReceivingScan";

export default function MaterialReceivingPage() {
  const { t } = useTranslation();
  const { playSuccess, playError } = useSoundFeedback();
  const {
    scannedData,
    isScanning,
    isConfirming,
    error,
    history,
    handleScan,
    handleConfirm,
    handleReset,
  } = useMatReceivingScan();

  /** 입고수량 (발주수량이 기본값) */
  const [receivedQty, setReceivedQty] = useState<string>("");
  /** 입고창고 코드 */
  const [warehouseCode, setWarehouseCode] = useState<string>("WH-01");

  /** 바코드 스캔 처리 */
  const onScan = useCallback(
    async (barcode: string) => {
      await handleScan(barcode);
    },
    [handleScan],
  );

  /** 하드웨어 스캐너 감지 */
  useBarcodeDetector({
    onScan,
    enabled: !scannedData,
  });

  /** 스캔 결과 필드 구성 */
  const resultFields: ScanResultField[] = useMemo(() => {
    if (!scannedData) return [];
    // 스캔 성공 시 입고수량 기본값 세팅
    if (receivedQty === "" && scannedData.orderQty) {
      setReceivedQty(String(scannedData.orderQty));
    }
    return [
      { label: t("pda.receiving.poNo"), value: scannedData.poNo },
      {
        label: t("pda.receiving.partCode"),
        value: scannedData.partCode,
        highlight: true,
      },
      { label: t("pda.receiving.partName"), value: scannedData.partName },
      {
        label: t("pda.receiving.orderQty"),
        value: `${scannedData.orderQty} ${scannedData.unit}`,
      },
      { label: t("pda.receiving.supplier"), value: scannedData.supplier },
    ];
  }, [scannedData, receivedQty, t]);

  /** 입고 확인 */
  const onConfirm = useCallback(async () => {
    const qty = Number(receivedQty);
    if (!qty || qty <= 0) return;
    const success = await handleConfirm(qty, warehouseCode);
    if (success) {
      playSuccess();
      setReceivedQty("");
    } else {
      playError();
    }
  }, [receivedQty, warehouseCode, handleConfirm, playSuccess, playError]);

  /** 다음 스캔 */
  const onNextScan = useCallback(() => {
    handleReset();
    setReceivedQty("");
  }, [handleReset]);

  /** 이력 렌더 */
  const renderHistoryItem = useCallback(
    (item: ReceivingHistoryItem) => (
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
            {item.partCode}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {item.partName}
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
            {item.receivedQty}
          </p>
          <p className="text-xs text-slate-400">{item.timestamp}</p>
        </div>
      </div>
    ),
    [],
  );

  return (
    <>
      <PdaHeader titleKey="pda.receiving.title" backPath="/pda/material/menu" />

      {/* 바코드 스캔 입력 */}
      <ScanInput
        onScan={onScan}
        placeholderKey="pda.receiving.scanBarcode"
        disabled={!!scannedData}
        isLoading={isScanning}
      />

      {/* 스캔 결과 / 에러 */}
      {(scannedData || error) && (
        <ScanResultCard
          fields={resultFields}
          variant={error ? "error" : "success"}
          title={error ? undefined : t("pda.scan.success")}
          errorMessage={error || undefined}
        />
      )}

      {/* 스캔 전 안내 */}
      {!scannedData && !error && !isScanning && (
        <div className="mx-4 mt-4 p-8 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900">
          <div className="text-center">
            <PackageCheck className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
              {t("pda.receiving.scanBarcode")}
            </p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
              {t("pda.receiving.title")}
            </p>
          </div>
        </div>
      )}

      {/* 입고수량 / 창고 입력 */}
      {scannedData && (
        <div className="px-4 mt-3 space-y-3">
          {/* 입고수량 */}
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
              {t("pda.receiving.receivedQty")}
            </label>
            <input
              type="number"
              inputMode="numeric"
              value={receivedQty}
              onChange={(e) => setReceivedQty(e.target.value)}
              className="w-full h-12 px-4 text-lg font-bold bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-600 rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none text-slate-900 dark:text-white"
              min={1}
            />
          </div>
          {/* 입고창고 */}
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
              {t("pda.receiving.warehouse")}
            </label>
            <input
              type="text"
              value={warehouseCode}
              onChange={(e) => setWarehouseCode(e.target.value)}
              className="w-full h-12 px-4 text-base bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-600 rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none text-slate-900 dark:text-white"
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
      {scannedData && (
        <PdaActionButton
          buttons={[
            {
              label: t("pda.receiving.confirmReceive"),
              onClick: onConfirm,
              variant: "primary",
              isLoading: isConfirming,
              disabled: !receivedQty || Number(receivedQty) <= 0,
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
