"use client";

/**
 * @file components/SubKitActionBar.tsx
 * @description 서브공정 키팅 하단 액션 바 — 새 SFG 라벨 발행 → 실물 새 SFG 스캔 확정.
 *   input-assembly의 AssemblyActionBar 거울상(FG→새 SFG).
 */
import type { JSX } from "react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { CheckCircle2, Play, RotateCcw, XCircle } from "lucide-react";
import { BarcodeScanInput } from "@/components/shared";
import { Button } from "@/components/ui";

export default function SubKitActionBar({
  canIssue,
  issuing,
  issuedSg,
  onIssue,
  confirming,
  onConfirmScan,
  onResetIssued,
  resultQuality,
  onResultQualityChange,
}: {
  canIssue: boolean;
  issuing: boolean;
  issuedSg: string | null;
  onIssue: () => void;
  confirming: boolean;
  onConfirmScan: (scannedBarcode: string) => void;
  onResetIssued: () => void;
  resultQuality: "GOOD" | "DEFECT";
  onResultQualityChange: (quality: "GOOD" | "DEFECT") => void;
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
      <div className="flex shrink-0 items-center rounded-lg border border-border bg-surface p-1 text-sm">
        <button
          type="button"
          onClick={() => onResultQualityChange("GOOD")}
          disabled={!!issuedSg || issuing || confirming}
          className={`flex h-9 items-center gap-1.5 rounded-md px-3 font-semibold transition-colors ${
            resultQuality === "GOOD"
              ? "bg-emerald-600 text-white shadow-sm"
              : "text-emerald-700 hover:bg-emerald-50 disabled:opacity-50 dark:text-emerald-300 dark:hover:bg-emerald-900/20"
          }`}
        >
          <CheckCircle2 className="h-4 w-4" />
          양품
        </button>
        <button
          type="button"
          onClick={() => onResultQualityChange("DEFECT")}
          disabled={!!issuedSg || issuing || confirming}
          className={`flex h-9 items-center gap-1.5 rounded-md px-3 font-semibold transition-colors ${
            resultQuality === "DEFECT"
              ? "bg-red-600 text-white shadow-sm"
              : "text-red-700 hover:bg-red-50 disabled:opacity-50 dark:text-red-300 dark:hover:bg-red-900/20"
          }`}
        >
          <XCircle className="h-4 w-4" />
          불량
        </button>
      </div>

      <div className="flex-shrink-0">
        <Button
          size="lg"
          onClick={onIssue}
          disabled={!canIssue || issuing || !!issuedSg}
          isLoading={issuing}
          leftIcon={<Play className="w-5 h-5" />}
        >
          {t("production.subprocess.issueSgLabel", "키팅 실행 → SFG 라벨 발행")}
        </Button>
      </div>

      <div className="flex-1 min-w-0">
        {issuedSg ? (
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
            <div className="min-w-0 flex-1">
              <div className="font-mono text-base font-bold text-text truncate">{issuedSg}</div>
              <div className="text-xs text-text-muted">
                {t("production.subprocess.printAndScan", "이 라벨을 출력·부착 후 실물 라벨을 스캔하세요")}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <BarcodeScanInput
                value={confirmScan}
                onChange={setConfirmScan}
                onScan={submitConfirm}
                placeholder={t("production.subprocess.confirmScanPlaceholder", "실물 SFG 라벨 스캔")}
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
                {t("production.subprocess.cancelIssue", "발행 취소")}
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-text-muted">
            {t("production.subprocess.issueFirst", "먼저 키팅을 실행해 SFG 라벨을 발행하세요")}
          </p>
        )}
      </div>
    </div>
  );
}
