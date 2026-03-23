"use client";

/**
 * @file quality/ppap/components/PpapElementChecklist.tsx
 * @description PPAP 18개 요소 체크리스트 컴포넌트
 *
 * 초보자 가이드:
 * 1. PPAP 레벨(1~5)에 따라 필수 요소가 다름 (AIAG PPAP 4th Ed. 기준)
 * 2. 필수 요소는 굵은 글씨 + 아이콘으로 표시
 * 3. 상단에 완료율 프로그레스바 표시
 * 4. readonly 모드에서는 체크박스 비활성화
 */
import { useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { CheckSquare, Square, AlertCircle } from "lucide-react";

/** 18개 PPAP 요소 키 */
const ELEMENT_KEYS = [
  "designRecords", "ecnDocuments", "customerApproval", "dfmea",
  "processFlowDiagram", "pfmea", "controlPlan", "msaStudies",
  "dimensionalResults", "materialTestResults", "initialProcessStudies",
  "qualifiedLabDoc", "appearanceApproval", "sampleProduct",
  "masterSample", "checkingAids", "customerSpecificReq", "partSubmissionWarrant",
] as const;

type ElementKey = typeof ELEMENT_KEYS[number];

/** PPAP 레벨별 필수 요소 매트릭스 (AIAG PPAP 4th Ed.) */
const REQUIRED_BY_LEVEL: Record<number, Set<ElementKey>> = {
  1: new Set(["partSubmissionWarrant"]),
  2: new Set([
    "designRecords", "ecnDocuments", "dfmea", "processFlowDiagram", "pfmea",
    "controlPlan", "msaStudies", "dimensionalResults", "materialTestResults",
    "initialProcessStudies", "qualifiedLabDoc", "sampleProduct",
    "partSubmissionWarrant",
  ]),
  3: new Set([
    "designRecords", "ecnDocuments", "customerApproval", "dfmea",
    "processFlowDiagram", "pfmea", "controlPlan", "msaStudies",
    "dimensionalResults", "materialTestResults", "initialProcessStudies",
    "qualifiedLabDoc", "appearanceApproval", "sampleProduct",
    "masterSample", "checkingAids", "customerSpecificReq", "partSubmissionWarrant",
  ]),
  4: new Set(["partSubmissionWarrant"]),
  5: new Set([
    "designRecords", "ecnDocuments", "customerApproval", "dfmea",
    "processFlowDiagram", "pfmea", "controlPlan", "msaStudies",
    "dimensionalResults", "materialTestResults", "initialProcessStudies",
    "qualifiedLabDoc", "appearanceApproval", "sampleProduct",
    "masterSample", "checkingAids", "customerSpecificReq", "partSubmissionWarrant",
  ]),
};

interface Props {
  ppapLevel: number;
  elements: Record<string, boolean>;
  onChange: (elements: Record<string, boolean>) => void;
  readonly?: boolean;
  completionRate?: number;
}

export default function PpapElementChecklist({
  ppapLevel, elements, onChange, readonly, completionRate,
}: Props) {
  const { t } = useTranslation();
  const required = useMemo(() => REQUIRED_BY_LEVEL[ppapLevel] ?? new Set(), [ppapLevel]);

  /* 레벨 변경 시 요소 초기화 (필수 요소만 키 생성) */
  useEffect(() => {
    if (readonly) return;
    const init: Record<string, boolean> = {};
    ELEMENT_KEYS.forEach(key => { init[key] = elements[key] ?? false; });
    onChange(init);
  }, [ppapLevel, readonly, elements, onChange]);

  /* 완료율 계산 */
  const calcRate = useMemo(() => {
    if (completionRate !== undefined) return completionRate;
    const requiredKeys = ELEMENT_KEYS.filter(k => required.has(k));
    if (requiredKeys.length === 0) return 0;
    const checked = requiredKeys.filter(k => elements[k]).length;
    return Math.round((checked / requiredKeys.length) * 100);
  }, [elements, required, completionRate]);

  const toggle = (key: ElementKey) => {
    if (readonly) return;
    onChange({ ...elements, [key]: !elements[key] });
  };

  return (
    <div className="space-y-3">
      {/* 헤더 + 완료율 */}
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold text-text">{t("quality.ppap.elementChecklist")}</h3>
        <span className="text-xs font-semibold text-primary">{calcRate}%</span>
      </div>
      <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${calcRate === 100 ? "bg-green-500" : "bg-blue-500"}`}
          style={{ width: `${calcRate}%` }} />
      </div>

      {/* 체크리스트 */}
      <div className="grid grid-cols-1 gap-1">
        {ELEMENT_KEYS.map(key => {
          const isRequired = required.has(key);
          const checked = !!elements[key];
          return (
            <button key={key} type="button" onClick={() => toggle(key)}
              disabled={readonly}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-left transition-colors
                ${checked
                  ? "bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800"
                  : "bg-white dark:bg-slate-900 border border-border hover:bg-slate-50 dark:hover:bg-slate-800"}
                ${readonly ? "cursor-default opacity-80" : "cursor-pointer"}`}>
              {checked
                ? <CheckSquare className="w-4 h-4 text-green-600 dark:text-green-400 flex-shrink-0" />
                : <Square className="w-4 h-4 text-slate-400 dark:text-slate-500 flex-shrink-0" />}
              <span className={`text-xs flex-1 ${isRequired ? "font-bold text-text" : "text-text-muted"}`}>
                {t(`quality.ppap.el.${key}`)}
              </span>
              {isRequired && (
                <AlertCircle className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400 flex-shrink-0" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
