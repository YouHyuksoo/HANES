"use client";

/**
 * @file src/app/(pda)/shipping/page.tsx
 * @description 출하등록 PDA 페이지 — 3-Phase 워크플로우
 *
 * 초보자 가이드:
 * Phase 1 (SCAN_SHIPMENT_ORDER): 출하지시 바코드 스캔 → 출하지시 정보 로드
 * Phase 2 (SCAN_WORKER): 작업자 QR 스캔 → 작업자 정보 저장
 * Phase 3 (SCAN_PRODUCT): 제품 박스/팔레트 반복 스캔 → 진행률 표시 → 출하확인
 * - 팔레트 바코드(PLT- 접두사): 하위 박스 일괄 추가
 * - 부분출하 허용: 전량 미완료 상태에서도 확인 버튼 활성화
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
import { Truck, UserCheck } from "lucide-react";
import {
  useShippingScan,
  type ShipHistoryItem,
} from "@/hooks/pda/useShippingScan";
import { ShippingProgressPanel } from "./components/ShippingProgressPanel";

export default function ShippingPage() {
  const { t } = useTranslation();
  const { playSuccess, playError } = useSoundFeedback();
  const {
    phase,
    scannedOrder,
    worker,
    scannedItems,
    scannedQty,
    progress,
    isScanning,
    isConfirming,
    error,
    history,
    handleScanShipOrder,
    handleScanWorker,
    handleScanProduct,
    handleConfirmShip,
    handleReset,
  } = useShippingScan();

  // ── 스캔 디스패처 ─────────────────────────────────────

  /** Phase별 스캔 처리 + 사운드 피드백 */
  const onScan = useCallback(
    async (barcode: string) => {
      if (phase === "SCAN_SHIPMENT_ORDER") {
        await handleScanShipOrder(barcode);
        // 성공 여부는 error state로 판단 (비동기 처리 후)
      } else if (phase === "SCAN_WORKER") {
        await handleScanWorker(barcode);
      } else if (phase === "SCAN_PRODUCT") {
        await handleScanProduct(barcode);
      }
    },
    [phase, handleScanShipOrder, handleScanWorker, handleScanProduct],
  );

  /** 하드웨어 스캐너 감지 (항상 활성화) */
  useBarcodeDetector({ onScan });

  // ── 에러 메시지 다국어 변환 ──────────────────────────

  const errorMessage = useMemo(() => {
    if (!error) return undefined;
    switch (error) {
      case "DUPLICATE":
        return t("pda.shipping.duplicateBarcode");
      case "WRONG_ITEM":
        return t("pda.shipping.wrongItem");
      case "OVER_QTY":
        return t("pda.shipping.overQty");
      default:
        return error;
    }
  }, [error, t]);

  // ── ScanInput placeholder 결정 ───────────────────────

  const scanPlaceholderKey = useMemo(() => {
    switch (phase) {
      case "SCAN_SHIPMENT_ORDER":
        return "pda.shipping.scanOrder";
      case "SCAN_WORKER":
        return "pda.shipping.scanWorker";
      case "SCAN_PRODUCT":
        return "pda.shipping.scanProduct";
    }
  }, [phase]);

  // ── 출하지시 결과 필드 ───────────────────────────────

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

  // ── 이벤트 핸들러 ─────────────────────────────────────

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

  // ── 진행률 계산 ───────────────────────────────────────

  const progressPct = Math.round(progress * 100);
  const orderQty = scannedOrder?.orderQty ?? 0;

  // ── 이력 렌더 ─────────────────────────────────────────

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
          {item.workerName && item.workerName !== "-" && (
            <p className="text-xs text-slate-400 dark:text-slate-500">
              {item.workerName}
            </p>
          )}
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

      {/* Phase 안내 배지 */}
      {phase !== "SCAN_SHIPMENT_ORDER" && (
        <div className="mx-4 mt-2 flex items-center gap-2">
          {/* Step 1 완료 */}
          <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-xs font-medium">
            <Truck className="w-3 h-3" />
            <span>{scannedOrder?.shipOrderNo}</span>
          </div>

          {/* Step 2: 작업자 (완료 시) */}
          {phase === "SCAN_PRODUCT" && worker && (
            <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-xs font-medium">
              <UserCheck className="w-3 h-3" />
              <span>{worker.workerName}</span>
            </div>
          )}
        </div>
      )}

      {/* 바코드 스캔 입력 */}
      <ScanInput
        onScan={onScan}
        placeholderKey={scanPlaceholderKey}
        isLoading={isScanning}
      />

      {/* 에러 표시 */}
      {errorMessage && (
        <ScanResultCard fields={[]} errorMessage={errorMessage} />
      )}

      {/* Phase 1: 스캔 전 안내 */}
      {phase === "SCAN_SHIPMENT_ORDER" && !error && !isScanning && (
        <div className="mx-4 mt-4 p-8 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900">
          <div className="text-center">
            <Truck className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
              {t("pda.shipping.scanOrder")}
            </p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
              {t("pda.shipping.title")}
            </p>
          </div>
        </div>
      )}

      {/* Phase 2: 작업자 QR 스캔 안내 */}
      {phase === "SCAN_WORKER" && !error && !isScanning && (
        <>
          {/* 출하지시 결과 카드 */}
          <ScanResultCard
            fields={orderFields}
            variant="success"
            title={t("pda.shipping.orderLoaded")}
          />
          <div className="mx-4 mt-3 p-6 rounded-2xl border-2 border-dashed border-blue-300 dark:border-blue-700 bg-white dark:bg-slate-900">
            <div className="text-center">
              <UserCheck className="w-10 h-10 text-blue-400 dark:text-blue-500 mx-auto mb-2" />
              <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
                {t("pda.shipping.scanWorker")}
              </p>
            </div>
          </div>
        </>
      )}

      {/* Phase 3: 출하지시 정보 + 진행률 */}
      {phase === "SCAN_PRODUCT" && (
        <>
          {/* 출하지시 요약 카드 */}
          <ScanResultCard
            fields={orderFields}
            variant="success"
            title={t("pda.shipping.orderLoaded")}
          />

          {/* 진행률 + 박스 목록 */}
          <ShippingProgressPanel
            scannedQty={scannedQty}
            orderQty={orderQty}
            progressPct={progressPct}
            scannedItems={scannedItems}
          />
        </>
      )}

      {/* 이력 */}
      <ScanHistoryList
        items={history}
        renderItem={renderHistoryItem}
        keyExtractor={(item, idx) => `${item.shipOrderNo}-${idx}`}
      />

      {/* 하단 버튼 (Phase 3에서만 표시) */}
      {phase === "SCAN_PRODUCT" && (
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

      {/* Phase 1/2에서도 초기화 버튼 제공 */}
      {phase !== "SCAN_PRODUCT" && (phase === "SCAN_WORKER") && (
        <PdaActionButton
          buttons={[
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
