"use client";

/**
 * @file src/app/(pda)/material/adjustment/page.tsx
 * @description 재고조정 PDA 페이지 - LOT 스캔 → 현재 수량 확인 → 조정 수량/사유 입력 → 승인 요청
 *
 * 초보자 가이드:
 * 1. ScanInput: LOT 바코드 스캔 (LOT번호로 현재 재고 조회)
 * 2. ScanResultCard: 현재 재고 정보 표시
 * 3. 조정수량 입력: 양수(+) = 재고 증가, 음수(-) = 재고 감소
 * 4. ReasonCodeSelect: ComCode(ADJ_REASON) 기반 사유 드롭다운 선택
 * 5. PdaActionButton: 승인 요청 버튼 → PENDING 상태로 서버 등록
 * 6. 이력 배지: PENDING(노랑) / APPROVED(초록) / REJECTED(빨강)
 */
import { useState, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import PdaHeader from "@/components/pda/PdaHeader";
import ScanInput from "@/components/pda/ScanInput";
import ScanResultCard from "@/components/pda/ScanResultCard";
import type { ScanResultField } from "@/components/pda/ScanResultCard";
import ScanHistoryList from "@/components/pda/ScanHistoryList";
import PdaActionButton from "@/components/pda/PdaActionButton";
import { useSoundFeedback } from "@/components/pda/SoundFeedback";
import { ReasonCodeSelect } from "@/components/pda";
import { useBarcodeDetector } from "@/hooks/pda/useBarcodeDetector";
import { RefreshCw } from "lucide-react";
import {
  useMatAdjustment,
  type AdjustmentHistoryItem,
  type AdjustStatus,
} from "@/hooks/pda/useMatAdjustment";

/** 승인 상태별 배지 스타일 */
const STATUS_BADGE_CLASS: Record<AdjustStatus, string> = {
  PENDING:
    "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  APPROVED:
    "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
  REJECTED: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
};

/** 승인 상태 배지 컴포넌트 */
function AdjustStatusBadge({ status, t }: { status: AdjustStatus; t: (key: string) => string }) {
  const labelKey: Record<AdjustStatus, string> = {
    PENDING: "pda.adjustment.pending",
    APPROVED: "pda.adjustment.approved",
    REJECTED: "pda.adjustment.rejected",
  };
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE_CLASS[status]}`}
    >
      {t(labelKey[status])}
    </span>
  );
}

export default function MaterialAdjustmentPage() {
  const { t } = useTranslation();
  const { playSuccess, playError } = useSoundFeedback();
  const {
    scannedLot,
    isScanning,
    isAdjusting,
    error,
    history,
    reasonCode,
    reasonText,
    setReason,
    handleScan,
    handleAdjust,
    handleReset,
  } = useMatAdjustment();

  /** 조정수량 */
  const [adjustQty, setAdjustQty] = useState<string>("");

  /** 바코드 스캔 처리 */
  const onScan = useCallback(
    async (matUid: string) => {
      await handleScan(matUid);
    },
    [handleScan],
  );

  /** 하드웨어 스캐너 감지 */
  useBarcodeDetector({
    onScan,
    enabled: !scannedLot,
  });

  /** 스캔 결과 필드 구성 */
  const resultFields: ScanResultField[] = useMemo(() => {
    if (!scannedLot) return [];
    return [
      {
        label: t("pda.issuing.matUid"),
        value: scannedLot.matUid,
        highlight: true,
      },
      { label: t("pda.receiving.partCode"), value: scannedLot.itemCode },
      { label: t("pda.receiving.partName"), value: scannedLot.itemName },
      {
        label: t("pda.adjustment.currentQty"),
        value: `${scannedLot.qty} ${scannedLot.unit}`,
      },
    ];
  }, [scannedLot, t]);

  /** 사유 유효성: 코드 선택 필수, ETC인 경우 텍스트도 필수 */
  const isReasonValid = useMemo(() => {
    if (!reasonCode) return false;
    const isEtc = ["ETC", "기타", "etc", "OTHER"].includes(reasonCode);
    if (isEtc) return reasonText.trim().length > 0;
    return true;
  }, [reasonCode, reasonText]);

  /** 수량 유효성 */
  const isQtyValid = adjustQty !== "" && Number(adjustQty) !== 0;

  /** 조정 승인 요청 */
  const onConfirm = useCallback(async () => {
    if (!isQtyValid || !isReasonValid) return;
    const success = await handleAdjust(Number(adjustQty));
    if (success) {
      playSuccess();
      setAdjustQty("");
      setReason("", "");
    } else {
      playError();
    }
  }, [adjustQty, isQtyValid, isReasonValid, handleAdjust, playSuccess, playError, setReason]);

  /** 다음 스캔 */
  const onNextScan = useCallback(() => {
    handleReset();
    setAdjustQty("");
    setReason("", "");
  }, [handleReset, setReason]);

  /** 이력 렌더 */
  const renderHistoryItem = useCallback(
    (item: AdjustmentHistoryItem) => (
      <div className="flex items-center justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
            {item.itemCode}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
            {item.matUid}
          </p>
        </div>
        <div className="text-right flex flex-col items-end gap-1 ml-2">
          <p
            className={`text-sm font-bold ${
              item.adjustQty > 0
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-red-600 dark:text-red-400"
            }`}
          >
            {item.adjustQty > 0 ? `+${item.adjustQty}` : item.adjustQty}
          </p>
          <AdjustStatusBadge status={item.adjustStatus} t={t} />
          <p className="text-xs text-slate-400">{item.timestamp}</p>
        </div>
      </div>
    ),
    [t],
  );

  return (
    <>
      <PdaHeader
        titleKey="pda.adjustment.title"
        backPath="/pda/material/menu"
      />

      {/* LOT 바코드 스캔 */}
      <ScanInput
        onScan={onScan}
        placeholderKey="pda.adjustment.scanLot"
        disabled={!!scannedLot}
        isLoading={isScanning}
      />

      {/* 스캔 결과 / 에러 */}
      {(scannedLot || error) && (
        <ScanResultCard
          fields={resultFields}
          variant={error ? "error" : "info"}
          title={error ? undefined : t("pda.scan.success")}
          errorMessage={error || undefined}
        />
      )}

      {/* 스캔 전 안내 */}
      {!scannedLot && !error && !isScanning && (
        <div className="mx-4 mt-4 p-8 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900">
          <div className="text-center">
            <RefreshCw className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
              {t("pda.adjustment.scanLot")}
            </p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
              {t("pda.adjustment.title")}
            </p>
          </div>
        </div>
      )}

      {/* 조정수량 / 사유 입력 */}
      {scannedLot && (
        <div className="px-4 mt-3 space-y-3">
          {/* 조정수량 */}
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
              {t("pda.adjustment.adjustQty")}
              <span className="text-red-500 ml-0.5">*</span>
            </label>
            <input
              type="number"
              inputMode="numeric"
              value={adjustQty}
              onChange={(e) => setAdjustQty(e.target.value)}
              placeholder="+10 / -5"
              className="w-full h-12 px-4 text-lg font-bold bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-600 rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none text-slate-900 dark:text-white placeholder:text-slate-400"
            />
          </div>

          {/* 보정 사유 — ReasonCodeSelect (ComCode: ADJ_REASON) */}
          <ReasonCodeSelect
            comCodeType="ADJ_REASON"
            value={reasonCode}
            onChange={(code, text) => setReason(code, text)}
            label={t("pda.adjustment.reason")}
            placeholder={t("pda.adjustment.reasonRequired")}
            required
          />

          {/* 승인 대기 안내 메시지 */}
          <p className="text-xs text-amber-600 dark:text-amber-400 text-center">
            {t("pda.adjustment.pendingMsg")}
          </p>
        </div>
      )}

      {/* 이력 */}
      <ScanHistoryList
        items={history}
        renderItem={renderHistoryItem}
        keyExtractor={(item, idx) => `${item.matUid}-${idx}`}
      />

      {/* 하단 버튼 */}
      {scannedLot && (
        <PdaActionButton
          buttons={[
            {
              label: t("pda.adjustment.confirmAdjust"),
              onClick: onConfirm,
              variant: "primary",
              isLoading: isAdjusting,
              disabled: !isQtyValid || !isReasonValid,
            },
            {
              label: t("pda.scan.nextScan"),
              onClick: onNextScan,
              variant: "secondary",
            },
          ]}
        />
      )}
    </>
  );
}
