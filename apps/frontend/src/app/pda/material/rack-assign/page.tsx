"use client";

/**
 * @file src/app/pda/material/rack-assign/page.tsx
 * @description 창고랙 지정 PDA 페이지 — 랙 스캔 후 자재를 연속 스캔해 보관위치를 지정한다.
 *
 * 초보자 가이드:
 * 1. 품목마스터 고정위치는 입고 시 기본값이고, 이 화면으로 변동 위치를 지정한다.
 * 2. 흐름: 랙(로케이션) 스캔 → 자재 시리얼 연속 스캔 → 지정 즉시 이력 누적
 * 3. 랙 바코드는 WAREHOUSE_LOCATIONS.LOCATION_CODE 그대로다.
 * 4. 재고 창고에 등록되지 않은 랙이면 서버가 거부하고 그 사유를 보여준다.
 */
import { useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import { MapPin, AlertTriangle, X } from "lucide-react";
import PdaHeader from "@/components/pda/PdaHeader";
import ScanInput from "@/components/pda/ScanInput";
import type { ScanInputHandle } from "@/components/pda/ScanInput";
import ScanHistoryList from "@/components/pda/ScanHistoryList";
import { useSoundFeedback } from "@/components/pda/SoundFeedback";
import { useBarcodeDetector } from "@/hooks/pda/useBarcodeDetector";
import { useRackAssign, type RackAssignHistoryItem } from "@/hooks/pda/useRackAssign";

export default function MaterialRackAssignPage() {
  const { t } = useTranslation();
  const { playSuccess, playError } = useSoundFeedback();
  const matScanRef = useRef<ScanInputHandle>(null);

  const {
    locationCode,
    isScanning,
    error,
    history,
    handleScanLocation,
    handleScanMaterial,
    resetLocation,
    clearError,
  } = useRackAssign();

  /** 랙 스캔 → 자재 스캔으로 포커스 이동 */
  const onScanLocation = useCallback(
    (code: string) => {
      clearError();
      handleScanLocation(code);
      setTimeout(() => matScanRef.current?.focus(), 200);
    },
    [handleScanLocation, clearError],
  );

  const onScanMaterial = useCallback(
    async (barcode: string) => {
      const ok = await handleScanMaterial(barcode);
      if (ok) playSuccess();
      else playError();
    },
    [handleScanMaterial, playSuccess, playError],
  );

  /** 하드웨어 스캐너 — 랙 지정 후에만 자재 스캔 모드 */
  useBarcodeDetector({
    onScan: onScanMaterial,
    enabled: !!locationCode && !isScanning,
  });

  const renderHistoryItem = useCallback(
    (item: RackAssignHistoryItem) => (
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{item.matUid}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {item.previousLocationCode || t("pda.rackAssign.unassigned")} → {item.locationCode}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
            {item.locationName || item.locationCode}
          </p>
          <p className="text-xs text-slate-400">{item.timestamp}</p>
        </div>
      </div>
    ),
    [t],
  );

  return (
    <>
      <PdaHeader titleKey="pda.rackAssign.title" backPath="/pda/material/menu" />

      {/* 1단계: 랙 스캔 */}
      <ScanInput
        onScan={onScanLocation}
        placeholderKey="pda.rackAssign.scanRack"
        disabled={isScanning}
      />

      {/* 지정된 랙 + 2단계: 자재 스캔 */}
      {locationCode && (
        <>
          <div className="mx-4 mt-1 flex items-center justify-between px-4 py-3 rounded-xl bg-primary/5 dark:bg-primary/10 border border-primary/20">
            <div className="flex items-center gap-1.5 min-w-0">
              <MapPin className="w-4 h-4 text-primary shrink-0" />
              <span className="text-sm font-bold text-primary truncate">{locationCode}</span>
            </div>
            <button
              type="button"
              onClick={resetLocation}
              className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
              aria-label={t("pda.rackAssign.changeRack")}
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <ScanInput
            ref={matScanRef}
            onScan={onScanMaterial}
            placeholderKey="pda.rackAssign.scanMaterial"
            disabled={isScanning}
            isLoading={isScanning}
          />
        </>
      )}

      {/* 랙 미지정 안내 */}
      {!locationCode && (
        <div className="mx-4 mt-6 p-6 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-600">
          <div className="text-center">
            <MapPin className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
              {t("pda.rackAssign.scanRackFirst")}
            </p>
          </div>
        </div>
      )}

      {/* 오류 */}
      {error && (
        <div className="mx-4 mt-2 px-4 py-3 rounded-xl border border-red-300 dark:border-red-700 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* 지정 이력 */}
      <ScanHistoryList
        items={history}
        renderItem={renderHistoryItem}
        keyExtractor={(item, index) => `${item.matUid}-${index}`}
      />
    </>
  );
}
