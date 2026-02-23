"use client";

/**
 * @file src/app/pda/equip-inspect/page.tsx
 * @description 설비 일상점검 PDA 페이지 - 설비 바코드 스캔 후 점검항목별 결과 입력
 *
 * 초보자 가이드:
 * 1. ScanInput: 설비 바코드를 스캔하면 useEquipInspectScan.handleScan 호출
 * 2. ScanResultCard: 스캔된 설비 정보(코드, 이름, 라인/공정) 카드 표시
 * 3. 점검항목 리스트: 각 항목마다 PASS/FAIL/CONDITIONAL 버튼 + 비고 입력
 * 4. PdaActionButton: 모든 항목 결과 입력 시 "점검확인" 버튼 활성화
 * 5. ScanHistoryList: 완료된 점검 이력을 하단에 표시
 */
import { useCallback, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { ClipboardCheck, RotateCcw } from "lucide-react";
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
  type InspectItem,
  type InspectHistoryItem,
} from "@/hooks/pda/useEquipInspectScan";

/** 점검 결과 타입 */
type ResultType = "PASS" | "FAIL" | "CONDITIONAL";

/** 결과 버튼 설정 */
const RESULT_BUTTONS: {
  value: ResultType;
  labelKey: string;
  activeClass: string;
  inactiveClass: string;
}[] = [
  {
    value: "PASS",
    labelKey: "pda.equipInspect.pass",
    activeClass:
      "bg-emerald-500 text-white border-emerald-500 shadow-sm shadow-emerald-500/25",
    inactiveClass:
      "bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 border-emerald-300 dark:border-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-900/20",
  },
  {
    value: "FAIL",
    labelKey: "pda.equipInspect.fail",
    activeClass:
      "bg-red-500 text-white border-red-500 shadow-sm shadow-red-500/25",
    inactiveClass:
      "bg-white dark:bg-slate-800 text-red-600 dark:text-red-400 border-red-300 dark:border-red-700 hover:bg-red-50 dark:hover:bg-red-900/20",
  },
  {
    value: "CONDITIONAL",
    labelKey: "pda.equipInspect.conditional",
    activeClass:
      "bg-amber-500 text-white border-amber-500 shadow-sm shadow-amber-500/25",
    inactiveClass:
      "bg-white dark:bg-slate-800 text-amber-600 dark:text-amber-400 border-amber-300 dark:border-amber-700 hover:bg-amber-50 dark:hover:bg-amber-900/20",
  },
];

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

  /** 점검 제출 → 성공 시 리셋 + 스캔입력 포커스 복원 */
  const onSubmit = useCallback(async () => {
    const success = await handleSubmit();
    if (success) {
      playSuccess();
      handleReset();
      // 스캔 입력으로 포커스 복원
      setTimeout(() => scanRef.current?.focus(), 100);
    } else {
      playError();
    }
  }, [handleSubmit, handleReset, playSuccess, playError]);

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

  /** 액션 버튼 */
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
                  currentResult={results.get(item.id)?.result}
                  currentMeasuredValue={results.get(item.id)?.measuredValue || ""}
                  currentRemark={results.get(item.id)?.remark || ""}
                  onSetResult={handleSetResult}
                  onSetMeasuredValue={handleSetMeasuredValue}
                  onSetRemark={handleSetRemark}
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
              <p className="text-[10px] text-slate-400 mt-0.5">
                {item.completedAt}
              </p>
            </div>
          </div>
        )}
      />

      {/* 하단 액션 버튼 */}
      <PdaActionButton buttons={actionButtons} />
    </>
  );
}

/** 개별 점검항목 카드 */
function InspectItemCard({
  item,
  currentResult,
  currentMeasuredValue,
  currentRemark,
  onSetResult,
  onSetMeasuredValue,
  onSetRemark,
}: {
  item: InspectItem;
  currentResult?: ResultType;
  currentMeasuredValue: string;
  currentRemark: string;
  onSetResult: (itemId: string, result: ResultType) => void;
  onSetMeasuredValue: (itemId: string, value: string) => void;
  onSetRemark: (itemId: string, remark: string) => void;
}) {
  const { t } = useTranslation();
  const inputClass =
    "w-full h-9 px-3 text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-200 placeholder:text-slate-400 outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-colors";

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3 space-y-2">
      {/* 항목명 + 기준 */}
      <div>
        <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
          {item.itemName}
        </p>
        {item.criteria && (
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {t("pda.equipInspect.criteria")}: {item.criteria}
          </p>
        )}
      </div>

      {/* 결과 버튼 3개 */}
      <div className="grid grid-cols-3 gap-2">
        {RESULT_BUTTONS.map((btn) => (
          <button
            key={btn.value}
            type="button"
            onClick={() => onSetResult(item.id, btn.value)}
            className={`h-9 rounded-lg text-xs font-bold border transition-all active:scale-95 ${
              currentResult === btn.value ? btn.activeClass : btn.inactiveClass
            }`}
          >
            {t(btn.labelKey)}
          </button>
        ))}
      </div>

      {/* 측정값 + 비고 (결과 선택 후 표시) */}
      {currentResult && (
        <div className="grid grid-cols-2 gap-2">
          <input
            type="text"
            value={currentMeasuredValue}
            onChange={(e) => onSetMeasuredValue(item.id, e.target.value)}
            placeholder={t("pda.equipInspect.measuredValuePlaceholder")}
            className={inputClass}
          />
          <input
            type="text"
            value={currentRemark}
            onChange={(e) => onSetRemark(item.id, e.target.value)}
            placeholder={t("pda.equipInspect.remarkPlaceholder")}
            className={inputClass}
          />
        </div>
      )}
    </div>
  );
}
