"use client";

/**
 * @file src/app/pda/material/issuing/phases/ConfirmPhase.tsx
 * @description Phase 3: 출고 최종 확인 UI (읽기 전용 BOM 체크리스트 + 출고 버튼)
 *
 * 초보자 가이드:
 * - 초록 헤더에 작업지시 정보 표시
 * - BomCheckList는 읽기 전용 (스캔 완료 현황 요약)
 * - "전량출고" 버튼 → handleConfirmIssue API 호출
 * - "뒤로" 버튼 → reset()으로 Phase 1로 돌아감
 */
import { useTranslation } from "react-i18next";
import PdaActionButton from "@/components/pda/PdaActionButton";
import BomCheckList from "@/components/pda/BomCheckList";
import { ClipboardList } from "lucide-react";
import type { BomCheckItemWithLots, JobOrderSummary } from "@/hooks/pda/useMatIssuingScan";

interface Props {
  jobOrder: JobOrderSummary;
  bomItems: BomCheckItemWithLots[];
  isConfirming: boolean;
  errorMessage: string | null;
  onIssue: () => void;
  onBack: () => void;
}

export function ConfirmPhase({
  jobOrder,
  bomItems,
  isConfirming,
  errorMessage,
  onIssue,
  onBack,
}: Props) {
  const { t } = useTranslation();

  return (
    <>
      {/* 작업지시 정보 헤더 */}
      <div className="mx-4 mt-2 p-4 rounded-xl bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800">
        <div className="flex items-center gap-2 mb-1">
          <ClipboardList className="w-4 h-4 text-green-500 dark:text-green-400 flex-shrink-0" />
          <span className="text-xs font-semibold text-green-600 dark:text-green-400 uppercase tracking-wide">
            {t("pda.issuing.confirmIssue")}
          </span>
        </div>
        <p className="text-base font-bold text-green-900 dark:text-green-100">
          {jobOrder.orderNo}
        </p>
        <p className="text-xs text-green-700 dark:text-green-300 mt-0.5">
          {jobOrder.partCode} · {jobOrder.partName}
        </p>
      </div>

      {/* BOM 체크리스트 (읽기 전용) */}
      {bomItems.length > 0 && (
        <div className="px-4 mt-3">
          <BomCheckList items={bomItems} />
        </div>
      )}

      {/* 에러 배너 */}
      {errorMessage && (
        <div className="mx-4 mt-2 p-3 rounded-xl bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800">
          <p className="text-sm text-red-600 dark:text-red-400">{errorMessage}</p>
        </div>
      )}

      <PdaActionButton
        buttons={[
          {
            label: t("pda.issuing.issueAll"),
            onClick: onIssue,
            variant: "primary",
            isLoading: isConfirming,
          },
          { label: t("common.back"), onClick: onBack, variant: "secondary" },
        ]}
      />
    </>
  );
}
