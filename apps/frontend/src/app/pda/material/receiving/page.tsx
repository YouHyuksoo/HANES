"use client";

/**
 * @file src/app/pda/material/receiving/page.tsx
 * @description 자재입고 PDA 페이지 (웹과 워크플로우 통일)
 *
 * 초보자 가이드:
 * 1. ScanInput: 자재 시리얼(matUid) 바코드 스캔 → 입고가능 LOT 조회
 * 2. WarehouseSelect: 입고창고 선택 (기본창고 자동선택)
 * 3. 수량 입력(기본=잔량) 후 입고확인 → 공통 입고 API(items[])로 확정
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
import { ReceivingHistoryRow } from "./components";

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

  const [receivedQty, setReceivedQty] = useState<string>("");
  const [warehouseCode, setWarehouseCode] = useState<string>("");

  /** 바코드 스캔 → 입고가능 LOT 조회 → 사운드 피드백 */
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
    if (receivedQty === "" && scannedData.remainingQty) {
      setReceivedQty(String(scannedData.remainingQty));
    }
    return [
      { label: t("material.col.matUid"), value: scannedData.matUid, highlight: true },
      { label: t("pda.receiving.partCode"), value: scannedData.itemCode },
      { label: t("pda.receiving.partName"), value: scannedData.part?.itemName ?? "" },
      {
        label: t("pda.receiving.orderQty"),
        value: `${scannedData.remainingQty} ${scannedData.part?.unit ?? "EA"}`,
      },
      { label: t("pda.receiving.supplier"), value: scannedData.vendor ?? "-" },
    ];
  }, [scannedData, receivedQty, t]);

  const errorMessage = useMemo(() => (error ? error : null), [error]);

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

  const receiveDisabledReason = useMemo(() => {
    const qty = Number(receivedQty);
    if (!receivedQty || Number.isNaN(qty) || qty <= 0) {
      return "입고수량은 1 이상이어야 합니다.";
    }
    if (!warehouseCode) {
      return "창고를 선택해 주세요.";
    }
    return undefined;
  }, [receivedQty, warehouseCode]);

  return (
    <>
      <PdaHeader titleKey="pda.receiving.title" backPath="/pda/material/menu" />

      {/* 시리얼 바코드 스캔 */}
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

      {/* 특채 안내 */}
      {scannedData?.isConcession && (
        <div className="mx-4 mt-2 px-3 py-2 rounded-lg border border-amber-500 text-amber-600 text-xs font-medium">
          {t("material.concession.accepted", "특채")}
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

      {/* 입고수량 / 창고 입력 */}
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
              autoSelectDefault
              fullWidth
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
              disabledReason: receiveDisabledReason,
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
