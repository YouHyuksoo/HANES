"use client";

/**
 * @file src/app/pda/equip-inspect/InspectItemCard.tsx
 * @description 개별 점검항목 카드 컴포넌트
 *
 * 초보자 가이드:
 * 1. PASS / FAIL / CONDITIONAL 버튼으로 결과를 선택합니다.
 * 2. FAIL 선택 시 → ReasonCodeSelect(INSPECT_NG_REASON) NG 사유 드롭다운이 나타납니다.
 * 3. 결과 선택 후 → 측정값(measuredValue) + 비고(remark) 입력 필드가 나타납니다.
 * 4. FAIL 카드는 빨간 테두리로 강조 표시됩니다.
 */
import { useTranslation } from "react-i18next";
import { ReasonCodeSelect } from "@/components/pda";
import type { InspectItem, InspectResult } from "@/hooks/pda/useEquipInspectScan";

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

interface InspectItemCardProps {
  item: InspectItem;
  currentResult: InspectResult | null;
  onSetResult: (itemId: string, result: ResultType) => void;
  onSetMeasuredValue: (itemId: string, value: string) => void;
  onSetRemark: (itemId: string, remark: string) => void;
  onSetReason: (itemId: string, code: string, text?: string) => void;
}

/**
 * 개별 점검항목 카드
 */
export default function InspectItemCard({
  item,
  currentResult,
  onSetResult,
  onSetMeasuredValue,
  onSetRemark,
  onSetReason,
}: InspectItemCardProps) {
  const { t } = useTranslation();
  const isFail = currentResult?.result === "FAIL";

  const inputClass =
    "w-full h-9 px-3 text-sm rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-200 placeholder:text-slate-400 outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-colors";

  return (
    <div
      className={`rounded-xl border bg-white dark:bg-slate-800 p-3 space-y-2 transition-colors ${
        isFail
          ? "border-red-300 dark:border-red-700"
          : "border-slate-200 dark:border-slate-700"
      }`}
    >
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
              currentResult?.result === btn.value
                ? btn.activeClass
                : btn.inactiveClass
            }`}
          >
            {t(btn.labelKey)}
          </button>
        ))}
      </div>

      {/* FAIL 선택 시 → NG 사유코드 선택 */}
      {isFail && (
        <div className="pt-1">
          <ReasonCodeSelect
            comCodeType="INSPECT_NG_REASON"
            value={currentResult?.reasonCode || ""}
            onChange={(code, text) => onSetReason(item.id, code, text)}
            label={t("pda.equipInspect.ngReason")}
            placeholder={t("pda.equipInspect.ngReason")}
          />
        </div>
      )}

      {/* 측정값 + 비고 (결과 선택 후 표시) */}
      {currentResult && (
        <div className="grid grid-cols-2 gap-2">
          <input
            type="text"
            value={currentResult.measuredValue}
            onChange={(e) => onSetMeasuredValue(item.id, e.target.value)}
            placeholder={t("pda.equipInspect.measuredValuePlaceholder")}
            className={inputClass}
          />
          <input
            type="text"
            value={currentResult.remark}
            onChange={(e) => onSetRemark(item.id, e.target.value)}
            placeholder={t("pda.equipInspect.remarkPlaceholder")}
            className={inputClass}
          />
        </div>
      )}
    </div>
  );
}
