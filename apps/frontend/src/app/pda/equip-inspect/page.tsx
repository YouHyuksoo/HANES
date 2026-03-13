"use client";

/**
 * @file src/app/pda/equip-inspect/page.tsx
 * @description 설비 일상점검 PDA 페이지 - 설비 바코드 스캔 후 점검항목별 결과 입력
 *
 * 초보자 가이드:
 * 1. ScanInput: 설비 바코드를 스캔하면 useEquipInspectScan.handleScan 호출
 * 2. ScanResultCard: 스캔된 설비 정보(코드, 이름, 라인/공정) 카드 표시
 *    - alreadyInspected=true 이면 경고 배너 표시 (재점검은 허용)
 * 3. InspectItemCard: 각 항목마다 PASS/FAIL/CONDITIONAL 버튼
 *    - FAIL 선택 시 → ReasonCodeSelect(INSPECT_NG_REASON) + 비고/측정값 표시
 * 4. PdaActionButton: 모든 항목 결과 입력 시 "점검확인" 버튼 활성화
 * 5. 제출 성공 후 FAIL 포함 → InterlockModal 표시
 * 6. ScanHistoryList: 완료된 점검 이력을 하단에 표시
 */
import { useCallback, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { AlertTriangle, ClipboardCheck, RotateCcw } from "lucide-react";
import PdaHeader from "@/components/pda/PdaHeader";
import ScanInput from "@/components/pda/ScanInput";
import type { ScanInputHandle } from "@/components/pda/ScanInput";
import ScanResultCard from "@/components/pda/ScanResultCard";
import type { ScanResultField } from "@/components/pda/ScanResultCard";
import PdaActionButton from "@/components/pda/PdaActionButton";
import ScanHistoryList from "@/components/pda/ScanHistoryList";
import { useSoundFeedback } from "@/components/pda/SoundFeedback";
import { useBarcodeDetector } from "@/hooks/pda/useBarcodeDetector";
import {
  useEquipInspectScan,
  type InspectHistoryItem,
} from "@/hooks/pda/useEquipInspectScan";
import InspectItemCard from "./InspectItemCard";
import InterlockModal from "./InterlockModal";

/** overallResult에 따른 배지 색상 */
const RESULT_BADGE: Record<string, string> = {
  PASS: "text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-900/30",
  FAIL: "text-red-600 bg-red-50 dark:text-red-400 dark:bg-red-900/30",
  CONDITIONAL:
    "text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-900/30",
};

export default function EquipInspectPage() {
  const { t } = useTranslation();
  const { playSuccess, playError } = useSoundFeedback();
  const scanRef = useRef<ScanInputHandle>(null);

  /** 인터락 안내 모달 표시 여부 */
  const [showInterlockModal, setShowInterlockModal] = useState(false);

  const {
    scannedEquip,
    inspectItems,
    results,
    isScanning,
    isSubmitting,
    error,
    completedCount,
    isAllCompleted,
    history,
    handleScan,
    handleSetResult,
    handleSetMeasuredValue,
    handleSetRemark,
    setItemReason,
    handleSubmit,
    handleReset,
  } = useEquipInspectScan();

  /** 바코드 스캔 처리 */
  const onScan = useCallback(
    async (code: string) => {
      await handleScan(code);
    },
    [handleScan],
  );

  /** 하드웨어 스캐너 감지 */
  useBarcodeDetector({
    onScan,
    enabled: !scannedEquip,
  });

  /** 점검 제출 → 성공 시 리셋 + 스캔입력 포커스 복원, FAIL → 인터락 모달 */
  const onSubmit = useCallback(async () => {
    const submitResult = await handleSubmit();
    if (submitResult.success) {
      playSuccess();
      if (submitResult.interlockApplied) {
        setShowInterlockModal(true);
      } else {
        handleReset();
        setTimeout(() => scanRef.current?.focus(), 100);
      }
    } else {
      playError();
    }
  }, [handleSubmit, handleReset, playSuccess, playError]);

  /** 인터락 모달 확인 → 리셋 + 포커스 복원 */
  const onInterlockConfirm = useCallback(() => {
    setShowInterlockModal(false);
    handleReset();
    setTimeout(() => scanRef.current?.focus(), 100);
  }, [handleReset]);

  /** 새 스캔 → 리셋 + 포커스 복원 */
  const onReset = useCallback(() => {
    handleReset();
    setTimeout(() => scanRef.current?.focus(), 100);
  }, [handleReset]);

  /** 설비 정보 카드 필드 */
  const equipFields: ScanResultField[] = useMemo(() => {
    if (!scannedEquip) return [];
    return [
      {
        label: t("pda.equipInspect.equipCode"),
        value: scannedEquip.equipCode,
        highlight: true,
      },
      {
        label: t("pda.equipInspect.equipName"),
        value: scannedEquip.equipName,
      },
      {
        label: t("pda.equipInspect.lineProcess"),
        value: scannedEquip.lineProcess || "-",
      },
    ];
  }, [scannedEquip, t]);

  /** 하단 액션 버튼 */
  const actionButtons = useMemo(() => {
    if (!scannedEquip) return [];
    return [
      {
        label: t("pda.scan.nextScan"),
        onClick: onReset,
        variant: "secondary" as const,
        icon: <RotateCcw className="w-5 h-5" />,
      },
      {
        label: t("pda.equipInspect.confirmInspect"),
        onClick: onSubmit,
        variant: "primary" as const,
        disabled: !isAllCompleted,
        isLoading: isSubmitting,
        icon: <ClipboardCheck className="w-5 h-5" />,
      },
    ];
  }, [scannedEquip, t, onReset, onSubmit, isAllCompleted, isSubmitting]);

  return (
    <>
      <PdaHeader titleKey="pda.equipInspect.title" backPath="/pda/menu" />

      {/* 바코드 스캔 입력 */}
      <ScanInput
        ref={scanRef}
        onScan={onScan}
        placeholderKey="pda.equipInspect.scanEquip"
        disabled={!!scannedEquip}
        isLoading={isScanning}
      />

      {/* 에러 표시 */}
      {error && (
        <ScanResultCard fields={[]} errorMessage={error} variant="error" />
      )}

      {/* 스캔 전 안내 */}
      {!scannedEquip && !error && !isScanning && (
        <div className="mx-4 mt-4 p-8 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900">
          <div className="text-center">
            <ClipboardCheck className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
              {t("pda.equipInspect.scanEquip")}
            </p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
              {t("pda.equipInspect.title")}
            </p>
          </div>
        </div>
      )}

      {/* 설비 정보 카드 */}
      {scannedEquip && (
        <div className="space-y-3">
          <ScanResultCard
            fields={equipFields}
            variant="info"
            title={t("pda.equipInspect.equipName")}
          />

          {/* 이미 점검 완료된 설비 경고 배너 */}
          {scannedEquip.alreadyInspected && (
            <div className="mx-4 flex items-start gap-2 p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-700">
              <AlertTriangle className="w-4 h-4 text-amber-500 dark:text-amber-400 mt-0.5 shrink-0" />
              <p className="text-xs text-amber-700 dark:text-amber-300 leading-relaxed">
                {t("pda.equipInspect.alreadyDone")}
              </p>
            </div>
          )}

          {/* 진행 상황 */}
          <div className="mx-4 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
              {t("pda.equipInspect.inspectItems")}
            </h3>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {t("pda.equipInspect.itemCount", {
                current: completedCount,
                total: inspectItems.length,
              })}
            </span>
          </div>

          {/* 점검항목 리스트 */}
          {inspectItems.length === 0 ? (
            <div className="mx-4 py-8 text-center text-sm text-slate-400 dark:text-slate-500">
              {t("pda.equipInspect.noItems")}
            </div>
          ) : (
            <div className="mx-4 space-y-3 pb-4">
              {inspectItems.map((item) => (
                <InspectItemCard
                  key={item.id}
                  item={item}
                  currentResult={results.get(item.id) ?? null}
                  onSetResult={handleSetResult}
                  onSetMeasuredValue={handleSetMeasuredValue}
                  onSetRemark={handleSetRemark}
                  onSetReason={setItemReason}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* 완료 이력 */}
      <ScanHistoryList<InspectHistoryItem>
        items={history}
        keyExtractor={(item, idx) => `${item.equipCode}-${idx}`}
        titleKey="pda.equipInspect.inspectHistory"
        renderItem={(item) => (
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                {item.equipCode}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {item.equipName} · {item.itemCount}
                {t("pda.equipInspect.itemUnit")}
              </p>
            </div>
            <div className="text-right">
              <span
                className={`inline-block px-2 py-0.5 rounded text-xs font-bold ${RESULT_BADGE[item.overallResult] || ""}`}
              >
                {t(`pda.equipInspect.${item.overallResult.toLowerCase()}`)}
              </span>
              {item.interlockApplied && (
                <p className="text-[10px] text-red-500 dark:text-red-400 mt-0.5">
                  {t("pda.equipInspect.interlock")}
                </p>
              )}
              <p className="text-[10px] text-slate-400 mt-0.5">
                {item.completedAt}
              </p>
            </div>
          </div>
        )}
      />

      {/* 하단 액션 버튼 */}
      <PdaActionButton buttons={actionButtons} />

      {/* 인터락 안내 모달 */}
      {showInterlockModal && (
        <InterlockModal onConfirm={onInterlockConfirm} />
      )}
    </>
  );
}
