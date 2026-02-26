"use client";

/**
 * @file src/app/(pda)/shipping/page.tsx
 * @description 출하등록 PDA 페이지 - 출하지시 바코드 스캔 → 제품 바코드 스캔 → 출하 확인
 *
 * 초보자 가이드:
 * 1. 첫 스캔: 출하지시 바코드 → 출하지시 정보 표시 (고객, 품목, 지시수량)
 * 2. 이후 스캔: 제품 바코드 → scannedItems에 추가, 진행률 표시
 * 3. 출하확인: 스캔된 제품 목록을 서버에 전송
 * 4. 초기화: 다음 출하지시 처리를 위해 전체 리셋
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
import { Truck } from "lucide-react";
import {
  useShippingScan,
  type ShipHistoryItem,
} from "@/hooks/pda/useShippingScan";

export default function ShippingPage() {
  const { t } = useTranslation();
  const { playSuccess, playError } = useSoundFeedback();
  const {
    scannedOrder,
    scannedItems,
    isScanning,
    isConfirming,
    error,
    history,
    handleScan,
    handleConfirmShip,
    handleReset,
  } = useShippingScan();

  /** 바코드 스캔 처리 + 사운드 피드백 */
  const onScan = useCallback(
    async (barcode: string) => {
      await handleScan(barcode);
    },
    [handleScan],
  );

  /** 하드웨어 스캐너 감지 (항상 활성화) */
  useBarcodeDetector({ onScan });

  /** 에러 메시지 다국어 변환 */
  const errorMessage = useMemo(() => {
    if (!error) return undefined;
    if (error === "DUPLICATE_BARCODE") return t("pda.shipping.duplicateBarcode");
    return error;
  }, [error, t]);

  /** 출하지시 결과 필드 */
  const orderFields: ScanResultField[] = useMemo(() => {
    if (!scannedOrder) return [];
    return [
      {
        label: t("pda.shipping.shipOrderNo"),
        value: scannedOrder.shipOrderNo,
        highlight: true,
      },
      { label: t("pda.shipping.customer"), value: scannedOrder.customerName },
      { label: t("pda.shipping.partCode"), value: scannedOrder.itemCode },
      { label: t("pda.shipping.partName"), value: scannedOrder.itemName },
      { label: t("pda.shipping.orderQty"), value: scannedOrder.orderQty },
    ];
  }, [scannedOrder, t]);

  /** 출하 확인 */
  const onConfirm = useCallback(async () => {
    const success = await handleConfirmShip();
    if (success) {
      playSuccess();
    } else {
      playError();
    }
  }, [handleConfirmShip, playSuccess, playError]);

  /** 초기화 */
  const onReset = useCallback(() => {
    handleReset();
  }, [handleReset]);

  /** 진행률 계산 */
  const scannedQty = scannedItems.length;
  const orderQty = scannedOrder?.orderQty ?? 0;
  const progressPct = orderQty > 0 ? Math.min((scannedQty / orderQty) * 100, 100) : 0;

  /** 이력 렌더 */
  const renderHistoryItem = useCallback(
    (item: ShipHistoryItem) => (
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
            {item.shipOrderNo}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {item.customerName} / {item.itemCode}
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
            {item.scannedQty}
          </p>
          <p className="text-xs text-slate-400">{item.timestamp}</p>
        </div>
      </div>
    ),
    [],
  );

  return (
    <>
      <PdaHeader titleKey="pda.shipping.title" backPath="/pda/menu" />

      {/* 바코드 스캔 입력 */}
      <ScanInput
        onScan={onScan}
        placeholderKey={
          scannedOrder
            ? "pda.shipping.scanProductBarcode"
            : "pda.shipping.scanBarcode"
        }
        isLoading={isScanning}
      />

      {/* 에러 표시 */}
      {errorMessage && (
        <ScanResultCard fields={[]} errorMessage={errorMessage} />
      )}

      {/* 스캔 전 안내 */}
      {!scannedOrder && !error && !isScanning && (
        <div className="mx-4 mt-4 p-8 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900">
          <div className="text-center">
            <Truck className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
              {t("pda.shipping.scanBarcode")}
            </p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
              {t("pda.shipping.title")}
            </p>
          </div>
        </div>
      )}

      {/* 출하지시 결과 카드 */}
      {scannedOrder && (
        <ScanResultCard
          fields={orderFields}
          variant="success"
          title={t("pda.shipping.orderLoaded")}
        />
      )}

      {/* 진행률 표시 */}
      {scannedOrder && (
        <div className="mx-4 mt-3 p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
          {/* 수량 표시 */}
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
              {t("pda.shipping.progress")}
            </span>
            <span className="text-sm font-bold text-slate-800 dark:text-slate-200">
              {t("pda.shipping.scannedQty")}: {scannedQty} / {orderQty}
            </span>
          </div>

          {/* 프로그레스 바 */}
          <div className="w-full h-3 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                progressPct >= 100
                  ? "bg-emerald-500"
                  : "bg-primary"
              }`}
              style={{ width: `${progressPct}%` }}
            />
          </div>

          {/* 스캔된 바코드 목록 */}
          {scannedItems.length > 0 && (
            <div className="mt-3 space-y-1 max-h-32 overflow-y-auto">
              {scannedItems.map((item) => (
                <div
                  key={item.barcode}
                  className="flex items-center justify-between py-1 px-2 rounded bg-slate-50 dark:bg-slate-800"
                >
                  <span className="text-xs font-mono text-slate-700 dark:text-slate-300">
                    {item.barcode}
                  </span>
                  <span className="text-xs text-slate-400">
                    {item.scannedAt}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 이력 */}
      <ScanHistoryList
        items={history}
        renderItem={renderHistoryItem}
        keyExtractor={(item, idx) => `${item.shipOrderNo}-${idx}`}
      />

      {/* 하단 버튼 */}
      {scannedOrder && (
        <PdaActionButton
          buttons={[
            {
              label: t("pda.shipping.confirmShip"),
              onClick: onConfirm,
              variant: "primary",
              isLoading: isConfirming,
              disabled: scannedItems.length === 0,
            },
            {
              label: t("common.reset"),
              onClick: onReset,
              variant: "secondary",
            },
          ]}
        />
      )}
    </>
  );
}
