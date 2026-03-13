"use client";

/**
 * @file src/app/pda/material/inventory-count/page.tsx
 * @description 자재 재고실사 PDA 페이지 - PC 개시 연동 버전
 *
 * 초보자 가이드:
 * 1. PC에서 실사를 개시해야 PDA 스캔 가능 (noActiveInv 안내)
 * 2. 실사 있으면: 실사 정보 헤더 → 로케이션 스캔 → 자재 연속 스캔
 * 3. 로케이션 스캔 후: 해당 로케이션 품목별 시스템수량 vs 실사수량 테이블 표시
 * 4. 자재 바코드 스캔 시 → POST /count → 해당 아이템 countedQty +1
 * 5. 스캔 이력이 하단에 누적 표시
 */
import { useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import PdaHeader from "@/components/pda/PdaHeader";
import ScanInput from "@/components/pda/ScanInput";
import type { ScanInputHandle } from "@/components/pda/ScanInput";
import ScanResultCard from "@/components/pda/ScanResultCard";
import ScanHistoryList from "@/components/pda/ScanHistoryList";
import { useSoundFeedback } from "@/components/pda/SoundFeedback";
import { useBarcodeDetector } from "@/hooks/pda/useBarcodeDetector";
import { ClipboardList, MapPin, AlertTriangle, Loader2 } from "lucide-react";
import {
  useMatInventoryCount,
  type CountHistoryItem,
} from "@/hooks/pda/useMatInventoryCount";

export default function MaterialInventoryCountPage() {
  const { t } = useTranslation();
  const { playSuccess, playError } = useSoundFeedback();

  /** 자재 스캔 인풋 포커스 핸들 */
  const matScanRef = useRef<ScanInputHandle>(null);

  const {
    session,
    noActiveInv,
    isLoadingSession,
    locationCode,
    countItems,
    isLoadingItems,
    isScanning,
    error,
    history,
    handleScanLocation,
    handleScanMaterial,
    clearError,
  } = useMatInventoryCount();

  /** 로케이션 스캔 → 자재 스캔으로 포커스 이동 */
  const onScanLocation = useCallback(
    async (code: string) => {
      clearError();
      await handleScanLocation(code);
      setTimeout(() => matScanRef.current?.focus(), 200);
    },
    [handleScanLocation, clearError],
  );

  /** 자재 바코드 스캔 */
  const onScanMaterial = useCallback(
    async (barcode: string) => {
      const ok = await handleScanMaterial(barcode);
      if (ok) {
        playSuccess();
      } else {
        playError();
      }
    },
    [handleScanMaterial, playSuccess, playError],
  );

  /** 하드웨어 스캐너 감지 — 로케이션 설정 후 자재 스캔 모드 */
  useBarcodeDetector({
    onScan: onScanMaterial,
    enabled: !!locationCode && !isScanning,
  });

  /** 이력 렌더 */
  const renderHistoryItem = useCallback(
    (item: CountHistoryItem) => (
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
            {item.itemCode}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {item.itemName}
          </p>
          <p className="text-xs text-slate-400 dark:text-slate-500">
            {item.locationCode}
          </p>
        </div>
        <div className="text-right">
          <p className="text-base font-bold text-emerald-600 dark:text-emerald-400">
            +1
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {t("pda.invCount.countedQty")}: {item.countedQty}
          </p>
          <p className="text-xs text-slate-400">{item.timestamp}</p>
        </div>
      </div>
    ),
    [t],
  );

  /* ─── 세션 로딩 중 ─── */
  if (isLoadingSession) {
    return (
      <>
        <PdaHeader titleKey="pda.inventoryCount.title" backPath="/pda/material/menu" />
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Loader2 className="w-10 h-10 text-primary animate-spin" />
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {t("common.loading")}
          </p>
        </div>
      </>
    );
  }

  /* ─── 진행 중 실사 없음 ─── */
  if (noActiveInv) {
    return (
      <>
        <PdaHeader titleKey="pda.inventoryCount.title" backPath="/pda/material/menu" />
        <div className="mx-4 mt-8 p-8 rounded-2xl border-2 border-dashed border-amber-300 dark:border-amber-600 bg-amber-50 dark:bg-amber-950/20">
          <div className="text-center">
            <AlertTriangle className="w-12 h-12 text-amber-400 dark:text-amber-500 mx-auto mb-3" />
            <p className="text-base font-semibold text-amber-700 dark:text-amber-400">
              {t("pda.invCount.noActive")}
            </p>
            <p className="text-sm text-amber-600 dark:text-amber-500 mt-2">
              {t("pda.invCount.startOnPc")}
            </p>
          </div>
        </div>
      </>
    );
  }

  /* ─── 메인 UI ─── */
  return (
    <>
      <PdaHeader titleKey="pda.inventoryCount.title" backPath="/pda/material/menu" />

      {/* 실사 정보 헤더 */}
      {session && (
        <div className="mx-4 mb-1 px-4 py-3 rounded-xl bg-primary/5 dark:bg-primary/10 border border-primary/20">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              {session.sessionNo}
            </span>
            <span className="text-xs font-bold text-primary">
              {session.warehouseName}
            </span>
          </div>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
            {session.countMonth}
          </p>
        </div>
      )}

      {/* 로케이션 스캔 */}
      <ScanInput
        onScan={onScanLocation}
        placeholderKey="pda.invCount.location"
        disabled={isLoadingItems}
        isLoading={isLoadingItems}
      />

      {/* 현재 로케이션 표시 + 품목 테이블 */}
      {locationCode && (
        <div className="mx-4 mt-1">
          {/* 로케이션 배지 */}
          <div className="flex items-center gap-1.5 mb-2">
            <MapPin className="w-4 h-4 text-primary" />
            <span className="text-sm font-bold text-primary">{locationCode}</span>
          </div>

          {/* 품목별 현황 테이블 */}
          {countItems.length > 0 ? (
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-slate-100 dark:bg-slate-800">
                    <th className="text-left px-3 py-2 font-medium text-slate-600 dark:text-slate-400">
                      {t("pda.receiving.partCode")}
                    </th>
                    <th className="text-right px-3 py-2 font-medium text-slate-600 dark:text-slate-400">
                      {t("pda.invCount.systemQty")}
                    </th>
                    <th className="text-right px-3 py-2 font-medium text-emerald-600 dark:text-emerald-400">
                      {t("pda.invCount.countedQty")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {countItems.map((item) => {
                    const diff = item.countedQty - item.systemQty;
                    const diffColor =
                      diff === 0
                        ? "text-slate-400"
                        : diff > 0
                          ? "text-blue-500"
                          : "text-red-500";
                    return (
                      <tr
                        key={item.itemCode}
                        className="border-t border-slate-100 dark:border-slate-800"
                      >
                        <td className="px-3 py-2">
                          <p className="font-medium text-slate-800 dark:text-slate-200">
                            {item.itemCode}
                          </p>
                          <p className="text-[10px] text-slate-400 truncate max-w-[120px]">
                            {item.itemName}
                          </p>
                        </td>
                        <td className="px-3 py-2 text-right text-slate-600 dark:text-slate-400">
                          {item.systemQty}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <span className="font-bold text-emerald-600 dark:text-emerald-400">
                            {item.countedQty}
                          </span>
                          {diff !== 0 && (
                            <span className={`ml-1 text-[10px] font-medium ${diffColor}`}>
                              ({diff > 0 ? "+" : ""}{diff})
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-4 text-center text-xs text-slate-400 dark:text-slate-500">
              {t("common.noData")}
            </div>
          )}
        </div>
      )}

      {/* 자재 스캔 */}
      <ScanInput
        ref={matScanRef}
        onScan={onScanMaterial}
        placeholderKey="pda.invCount.scanMaterial"
        disabled={!locationCode || isScanning}
        isLoading={isScanning}
      />

      {/* 에러 표시 */}
      {error && (
        <ScanResultCard
          fields={[]}
          variant="error"
          errorMessage={error}
        />
      )}

      {/* 로케이션 미선택 안내 */}
      {!locationCode && !isLoadingItems && (
        <div className="mx-4 mt-2 p-6 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900">
          <div className="text-center">
            <ClipboardList className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
              {t("pda.invCount.location")}
            </p>
          </div>
        </div>
      )}

      {/* 스캔 이력 */}
      <ScanHistoryList
        items={history}
        renderItem={renderHistoryItem}
        keyExtractor={(item, idx) => `${item.barcode}-${idx}`}
      />
    </>
  );
}
