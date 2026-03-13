"use client";

/**
 * @file src/app/pda/material/issuing/page.tsx
 * @description 자재불출 PDA 페이지 - BOM 피킹 워크플로우 (Phase 3단계)
 *
 * 초보자 가이드:
 * 1. **SCAN_JOB_ORDER**: 작업지시 스캔 + 출고유형 선택 → ScanJobOrderPhase 컴포넌트
 * 2. **SCAN_MATERIAL**: 자재 스캔 + BOM 체크리스트 → ScanMaterialPhase 컴포넌트
 * 3. **CONFIRM**: 최종 확인 + 출고 처리 → ConfirmPhase 컴포넌트
 * 4. 수량 초과 스캔 시 → ConfirmModal 경고 (계속 허용)
 * 5. ScanHistoryList: 출고 완료 이력
 */
import { useState, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import PdaHeader from "@/components/pda/PdaHeader";
import ScanHistoryList from "@/components/pda/ScanHistoryList";
import { useSoundFeedback } from "@/components/pda/SoundFeedback";
import { useBarcodeDetector } from "@/hooks/pda/useBarcodeDetector";
import { ConfirmModal } from "@/components/ui";
import type { ScanInputHandle } from "@/components/pda/ScanInput";
import {
  useMatIssuingScan,
  type IssuingHistoryItem,
} from "@/hooks/pda/useMatIssuingScan";
import { ScanJobOrderPhase } from "./phases/ScanJobOrderPhase";
import { ScanMaterialPhase } from "./phases/ScanMaterialPhase";
import { ConfirmPhase } from "./phases/ConfirmPhase";

// ── 메인 페이지 ───────────────────────────────────────

export default function MaterialIssuingPage() {
  const { t } = useTranslation();
  const { playSuccess, playError } = useSoundFeedback();
  const scanMatRef = useRef<ScanInputHandle>(null);

  const {
    phase,
    jobOrder,
    bomItems,
    issueType,
    isScanning,
    isConfirming,
    error,
    history,
    setIssueType,
    handleScanJobOrder,
    handleScanMaterial,
    handleConfirmIssue,
    goToConfirm,
    reset,
  } = useMatIssuingScan();

  /** 수량 초과 경고 모달 */
  const [overQtyModal, setOverQtyModal] = useState(false);

  // ── 에러 메시지 변환 ─────────────────────────────────

  const errorMessage = (() => {
    if (!error) return null;
    if (error === "NOT_IN_BOM") return t("pda.issuing.notInBom");
    if (error === "JOB_ORDER_NOT_FOUND") return t("pda.scan.noResult");
    return error;
  })();

  // ── Phase 1: 작업지시 스캔 ───────────────────────────

  const onScanJobOrder = useCallback(
    async (barcode: string) => {
      await handleScanJobOrder(barcode);
      setTimeout(() => scanMatRef.current?.focus(), 150);
    },
    [handleScanJobOrder],
  );

  useBarcodeDetector({ onScan: onScanJobOrder, enabled: phase === "SCAN_JOB_ORDER" });

  // ── Phase 2: 자재 스캔 ──────────────────────────────

  const onScanMaterial = useCallback(
    async (barcode: string) => {
      const result = await handleScanMaterial(barcode);
      if (result === "ok") {
        playSuccess();
      } else if (result === "over_qty") {
        playError();
        setOverQtyModal(true);
      } else {
        playError();
      }
    },
    [handleScanMaterial, playSuccess, playError],
  );

  useBarcodeDetector({ onScan: onScanMaterial, enabled: phase === "SCAN_MATERIAL" });

  // ── Phase 3: 출고 확인 ──────────────────────────────

  const onConfirmIssue = useCallback(async () => {
    const success = await handleConfirmIssue();
    if (success) playSuccess();
    else playError();
  }, [handleConfirmIssue, playSuccess, playError]);

  // ── 렌더 ─────────────────────────────────────────────

  return (
    <>
      <PdaHeader titleKey="pda.issuing.title" backPath="/pda/material/menu" />

      {/* Phase 1 */}
      {phase === "SCAN_JOB_ORDER" && (
        <ScanJobOrderPhase
          isScanning={isScanning}
          issueType={issueType}
          errorMessage={errorMessage}
          onScan={onScanJobOrder}
          onIssueTypeChange={setIssueType}
        />
      )}

      {/* Phase 2 */}
      {phase === "SCAN_MATERIAL" && jobOrder && (
        <ScanMaterialPhase
          jobOrder={jobOrder}
          bomItems={bomItems}
          isScanning={isScanning}
          errorMessage={errorMessage}
          scanMatRef={scanMatRef}
          onScan={onScanMaterial}
          onConfirm={goToConfirm}
          onCancel={reset}
        />
      )}

      {/* Phase 3 */}
      {phase === "CONFIRM" && jobOrder && (
        <ConfirmPhase
          jobOrder={jobOrder}
          bomItems={bomItems}
          isConfirming={isConfirming}
          errorMessage={errorMessage}
          onIssue={onConfirmIssue}
          onBack={reset}
        />
      )}

      {/* 출고 완료 이력 */}
      <ScanHistoryList
        items={history}
        renderItem={(item: IssuingHistoryItem) => (
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                {item.orderNo}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {item.partCode} · {item.partName}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm font-bold text-amber-600 dark:text-amber-400">
                -{item.totalScanned}
              </p>
              <p className="text-xs text-slate-400">{item.timestamp}</p>
            </div>
          </div>
        )}
        keyExtractor={(item, idx) => `${item.orderNo}-${idx}`}
      />

      {/* 수량 초과 경고 모달 */}
      <ConfirmModal
        isOpen={overQtyModal}
        onClose={() => setOverQtyModal(false)}
        onConfirm={() => setOverQtyModal(false)}
        title={t("common.confirm")}
        message={t("pda.issuing.overQty")}
        confirmText={t("common.confirm")}
        cancelText={t("common.cancel")}
      />
    </>
  );
}
