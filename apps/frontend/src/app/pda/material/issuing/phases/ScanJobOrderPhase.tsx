"use client";

/**
 * @file src/app/pda/material/issuing/phases/ScanJobOrderPhase.tsx
 * @description Phase 1: 작업지시 바코드 스캔 + 출고유형 선택 UI
 *
 * 초보자 가이드:
 * - ScanInput으로 작업지시 번호(orderNo) 바코드 스캔
 * - 출고유형(생산불출/창고이동/반품)을 버튼으로 선택
 * - 스캔 전 안내 아이콘 표시
 */
import { useTranslation } from "react-i18next";
import ScanInput from "@/components/pda/ScanInput";
import { PackageMinus } from "lucide-react";
import type { IssueType } from "@/hooks/pda/useMatIssuingScan";

const ISSUE_TYPE_OPTIONS: { value: IssueType; labelKey: string }[] = [
  { value: "PRODUCTION", labelKey: "pda.issuing.production" },
  { value: "TRANSFER",   labelKey: "pda.issuing.transfer" },
  { value: "RETURN",     labelKey: "pda.issuing.return" },
];

interface Props {
  isScanning: boolean;
  issueType: IssueType;
  errorMessage: string | null;
  onScan: (barcode: string) => void;
  onIssueTypeChange: (type: IssueType) => void;
}

export function ScanJobOrderPhase({
  isScanning,
  issueType,
  errorMessage,
  onScan,
  onIssueTypeChange,
}: Props) {
  const { t } = useTranslation();

  return (
    <>
      <ScanInput
        onScan={onScan}
        placeholderKey="pda.issuing.scanJobOrder"
        isLoading={isScanning}
      />

      {/* 에러 배너 */}
      {errorMessage && (
        <div className="mx-4 mt-2 p-3 rounded-xl bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800">
          <p className="text-sm text-red-600 dark:text-red-400">{errorMessage}</p>
        </div>
      )}

      {/* 출고유형 선택 */}
      <div className="px-4 mt-3">
        <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
          {t("pda.issuing.issueType")}
        </label>
        <div className="flex gap-2">
          {ISSUE_TYPE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => onIssueTypeChange(opt.value)}
              className={`flex-1 py-2.5 rounded-xl text-sm font-medium border-2 transition-colors ${
                issueType === opt.value
                  ? "bg-primary border-primary text-white"
                  : "bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300"
              }`}
            >
              {t(opt.labelKey)}
            </button>
          ))}
        </div>
      </div>

      {/* 안내 아이콘 */}
      {!errorMessage && !isScanning && (
        <div className="mx-4 mt-4 p-8 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900">
          <div className="text-center">
            <PackageMinus className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
              {t("pda.issuing.scanJobOrder")}
            </p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
              {t("pda.issuing.title")}
            </p>
          </div>
        </div>
      )}
    </>
  );
}
