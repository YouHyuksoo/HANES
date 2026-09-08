"use client";

import type { JSX } from "react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Play, RotateCcw, Scan } from "lucide-react";
import { BarcodeScanInput } from "@/components/shared";
import { Button } from "@/components/ui";

export default function AssemblyActionBar({
  canIssue,
  issueDisabledReason,
  issuing,
  issuedFg,
  onIssue,
  confirming,
  canConfirm,
  onConfirmScan,
  onResetIssued,
}: {
  canIssue: boolean;
  issueDisabledReason: string;
  issuing: boolean;
  issuedFg: string | null;
  onIssue: () => void;
  confirming: boolean;
  canConfirm: boolean;
  onConfirmScan: (scannedBarcode: string) => void;
  onResetIssued: () => void;
}): JSX.Element {
  const { t } = useTranslation();

  const [confirmScan, setConfirmScan] = useState("");

  const submitConfirm = (rawConfirmScan?: string) => {
    const trimmed = (rawConfirmScan ?? confirmScan).replace(/\r?\n|\r/g, "").trim();
    if (!trimmed || confirming || !canConfirm) return;
    onConfirmScan(trimmed);
    setConfirmScan("");
  };

  const handleReset = () => {
    setConfirmScan("");
    onResetIssued();
  };

  return (
    <div className="flex flex-col gap-3 border-t border-border pt-3 lg:flex-row lg:items-center">
      <div className="flex-shrink-0">
        <Button
          size="lg"
          onClick={onIssue}
          disabled={!canIssue || issuing || !!issuedFg}
          disabledReason={issueDisabledReason}
          isLoading={issuing}
          leftIcon={<Play className="w-5 h-5" />}
        >
          {t("production.inputAssembly.issueLabel", "조립 실행 → FG 라벨 발행")}
        </Button>
      </div>

      <div className="flex-1 min-w-0">
        {issuedFg ? (
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
            <div className="min-w-0 flex-1">
              <div className="font-mono text-base font-bold text-text truncate">{issuedFg}</div>
              <div className="text-xs text-text-muted">
                {t("production.inputAssembly.printAndScan", "이 라벨을 출력·부착 후 실물 라벨을 스캔하세요")}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <BarcodeScanInput
                value={confirmScan}
                onChange={setConfirmScan}
                onScan={submitConfirm}
                placeholder={t("production.inputAssembly.confirmScanPlaceholder", "실물 FG 라벨 스캔")}
                disabled={confirming || !canConfirm}
              />
              <Button
                size="sm"
                onClick={() => submitConfirm()}
                isLoading={confirming}
                disabled={confirming || !canConfirm || !confirmScan.trim()}
                disabledReason={!canConfirm ? t('production.inputAssembly.sgNotReadyHelp', '필요한 반제품을 스캔하고 잔량을 확인하세요.') : t('production.inputAssembly.confirmScanPlaceholder', '실물 FG 라벨 스캔')}
              >
                {t("common.confirm")}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleReset}
                disabled={confirming}
                disabledReason={t('common.actionProcessingHelp', '처리 중입니다. 완료될 때까지 기다려 주세요.')}
                leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
              >
                {t("production.inputAssembly.cancelIssue", "발행 취소")}
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-text-muted">
            {t("production.inputAssembly.issueFirst", "먼저 조립을 실행해 FG 라벨을 발행하세요")}
          </p>
        )}
      </div>
    </div>
  );
}
