"use client";

/**
 * @file src/app/pda/material/receiving/page.tsx
 * @description 자재입고 PDA 페이지 - 바코드 스캔 → IQC 확인 → 수량/창고/로케이션 입력 → 입고 확인
 *
 * 초보자 가이드:
 * 1. ScanInput (1번): 입고 발주 바코드 스캔
 * 2. IqcBadge: IQC 상태 표시 (PASS=초록, FAIL=빨강, IN_PROGRESS=노랑, NONE=회색)
 * 3. WarehouseSelect: 드롭다운으로 입고창고 선택
 * 4. ScanInput (2번): 로케이션 코드 스캔 입력
 * 5. PdaActionButton: 입고확인 + 다음스캔 버튼
 * 6. ScanHistoryList: 입고 완료 이력 표시
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
import WarehouseSelect from "@/components/shared/WarehouseSelect";
import { PackageCheck } from "lucide-react";
import {
  useMatReceivingScan,
  type ScanResult,
} from "@/hooks/pda/useMatReceivingScan";
import { IqcBadge, ReceivingHistoryRow } from "./components";

export default function MaterialReceivingPage() {
  const { t } = useTranslation();
  const { playSuccess, playError } = useSoundFeedback();
  const {
    scannedData,
    isScanning,
    isConfirming,
    error,
    history,
    locationCode,
    setLocationCode,
    handleScan,
    handleConfirm,
    handleReset,
  } = useMatReceivingScan();

  const [receivedQty, setReceivedQty] = useState<string>("");
  const [warehouseCode, setWarehouseCode] = useState<string>("");

  /** 바코드 스캔 → IQC 검증 → 사운드 피드백 */
  const onScan = useCallback(
    async (barcode: string) => {
      const result: ScanResult = await handleScan(barcode);
      if (result !== "ok") playError();
    },
    [handleScan, playError],
  );

  /** 하드웨어 스캐너 감지 (스캔된 데이터 없을 때만 활성화) */
  useBarcodeDetector({ onScan, enabled: !scannedData });

  /** 스캔 결과 필드 구성 */
  const resultFields: ScanResultField[] = useMemo(() => {
    if (!scannedData) return [];
    if (receivedQty === "" && scannedData.orderQty) {
      setReceivedQty(String(scannedData.orderQty));
    }
    return [
      { label: t("pda.receiving.poNo"), value: scannedData.poNo },
      { label: t("pda.receiving.partCode"), value: scannedData.itemCode, highlight: true },
      { label: t("pda.receiving.partName"), value: scannedData.itemName },
      { label: t("pda.receiving.orderQty"), value: `${scannedData.orderQty} ${scannedData.unit}` },
      { label: t("pda.receiving.supplier"), value: scannedData.supplier },
    ];
  }, [scannedData, receivedQty, t]);

  /** IQC 에러 메시지 변환 */
  const errorMessage = useMemo(() => {
    if (!error) return null;
    if (error === "IQC_FAIL") return t("pda.receiving.iqcFailMsg");
    if (error === "IQC_IN_PROGRESS") return t("pda.receiving.iqcInProgressMsg");
    return error;
  }, [error, t]);

  /** 입고 확인 */
  const onConfirm = useCallback(async () => {
    const qty = Number(receivedQty);
    if (!qty || qty <= 0) return;
    const success = await handleConfirm(qty, warehouseCode, locationCode);
    if (success) {
      playSuccess();
      setReceivedQty("");
      setWarehouseCode("");
    } else {
      playError();
    }
  }, [receivedQty, warehouseCode, locationCode, handleConfirm, playSuccess, playError]);

  /** 다음 스캔 */
  const onNextScan = useCallback(() => {
    handleReset();
    setReceivedQty("");
    setWarehouseCode("");
  }, [handleReset]);

  return (
    <>
      <PdaHeader titleKey="pda.receiving.title" backPath="/pda/material/menu" />

      {/* 발주 바코드 스캔 */}
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
          errorMessage={errorMessage || undefined}
        />
      )}

      {/* IQC 상태 배지 */}
      {scannedData && (
        <div className="px-4 mt-2">
          <IqcBadge status={scannedData.iqcStatus} />
        </div>
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

      {/* 입고수량 / 창고 / 로케이션 입력 */}
      {scannedData && (
        <div className="px-4 mt-3 space-y-3">
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
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
              {t("pda.receiving.warehouse")}
            </label>
            <WarehouseSelect
              value={warehouseCode}
              onChange={(v) => setWarehouseCode(v)}
              warehouseType="RAW"
              fullWidth
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
              {t("pda.receiving.location")}
            </label>
            <ScanInput
              onScan={(val) => setLocationCode(val)}
              value={locationCode}
              onChange={(val) => setLocationCode(val)}
              placeholderKey="pda.receiving.scanLocation"
              autoClear={false}
            />
          </div>
        </div>
      )}

      {/* 이력 */}
      <ScanHistoryList
        items={history}
        renderItem={(item) => <ReceivingHistoryRow item={item} />}
        keyExtractor={(item, idx) => `${item.matUid}-${idx}`}
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
              disabled: !receivedQty || Number(receivedQty) <= 0 || !warehouseCode,
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
