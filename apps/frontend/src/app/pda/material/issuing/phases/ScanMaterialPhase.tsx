"use client";

/**
 * @file src/app/pda/material/issuing/phases/ScanMaterialPhase.tsx
 * @description Phase 2: 자재 바코드 스캔 + BOM 체크리스트 UI
 *
 * 초보자 가이드:
 * - 상단에 작업지시 정보 헤더 표시 (파란 카드)
 * - ScanInput으로 자재시리얼 바코드 스캔
 * - BomCheckList로 BOM 항목별 스캔 현황 표시
 * - 출고확인 버튼 → Phase 3(CONFIRM)으로 이동
 */
import { useTranslation } from "react-i18next";
import ScanInput from "@/components/pda/ScanInput";
import type { ScanInputHandle } from "@/components/pda/ScanInput";
import PdaActionButton from "@/components/pda/PdaActionButton";
import BomCheckList from "@/components/pda/BomCheckList";
import { ClipboardList } from "lucide-react";
import type { BomCheckItemWithLots, JobOrderSummary } from "@/hooks/pda/useMatIssuingScan";

interface Props {
  jobOrder: JobOrderSummary;
  bomItems: BomCheckItemWithLots[];
  isScanning: boolean;
  errorMessage: string | null;
  scanMatRef: React.RefObject<ScanInputHandle | null>;
  onScan: (barcode: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ScanMaterialPhase({
  jobOrder,
  bomItems,
  isScanning,
  errorMessage,
  scanMatRef,
  onScan,
  onConfirm,
  onCancel,
}: Props) {
  const { t } = useTranslation();

  return (
    <>
      {/* 작업지시 정보 헤더 */}
      <div className="mx-4 mt-2 p-4 rounded-xl bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800">
        <div className="flex items-center gap-2 mb-1">
          <ClipboardList className="w-4 h-4 text-blue-500 dark:text-blue-400 flex-shrink-0" />
          <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wide">
            {t("pda.issuing.title")}
          </span>
        </div>
        <p className="text-base font-bold text-blue-900 dark:text-blue-100">
          {jobOrder.orderNo}
        </p>
        <p className="text-xs text-blue-700 dark:text-blue-300 mt-0.5">
          {jobOrder.partCode} · {jobOrder.partName}
        </p>
      </div>

      <ScanInput
        ref={scanMatRef}
        onScan={onScan}
        placeholderKey="pda.issuing.scanMaterial"
        isLoading={isScanning}
      />

      {/* 에러 배너 */}
      {errorMessage && (
        <div className="mx-4 mt-1 p-3 rounded-xl bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800">
          <p className="text-sm text-red-600 dark:text-red-400">{errorMessage}</p>
        </div>
      )}

      {/* BOM 체크리스트 */}
      <div className="px-4 mt-3">
        {bomItems.length > 0 ? (
          <BomCheckList items={bomItems} />
        ) : (
          <div className="p-4 rounded-xl bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-800">
            <p className="text-sm text-yellow-700 dark:text-yellow-300 text-center">
              BOM 항목이 없습니다. 자유롭게 스캔하세요.
            </p>
          </div>
        )}
      </div>

      <PdaActionButton
        buttons={[
          {
            label: t("pda.issuing.confirmIssue"),
            onClick: onConfirm,
            variant: "primary",
            disabled: bomItems.length > 0 && bomItems.every((b) => !b.checked),
          },
          { label: t("common.cancel"), onClick: onCancel, variant: "secondary" },
        ]}
      />
    </>
  );
}
