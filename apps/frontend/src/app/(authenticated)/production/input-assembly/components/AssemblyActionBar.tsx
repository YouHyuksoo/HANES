"use client";

import type { JSX } from "react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Play, RotateCcw, Scan } from "lucide-react";
import { BarcodeScanInput } from "@/components/shared";
import { Button } from "@/components/ui";

export default function AssemblyActionBar({
  canIssue,
  issuing,
  issuedFg,
  onIssue,
  confirming,
  onConfirmScan,
  onResetIssued,
}: {
  canIssue: boolean;
  issuing: boolean;
  issuedFg: string | null;
  onIssue: () => void;
  confirming: boolean;
  onConfirmScan: (scannedBarcode: string) => void;
  onResetIssued: () => void;
}): JSX.Element {
  const { t } = useTranslation();

  const [confirmScan, setConfirmScan] = useState("");

  const submitConfirm = (rawConfirmScan?: string) => {
    const trimmed = (rawConfirmScan ?? confirmScan).replace(/\r?\n|\r/g, "").trim();
    if (!trimmed) return;
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
                disabled={confirming}
              />
              <Button
                size="sm"
                onClick={() => submitConfirm()}
                isLoading={confirming}
                disabled={confirming || !confirmScan.trim()}
              >
                {t("common.confirm")}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleReset}
                disabled={confirming}
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
