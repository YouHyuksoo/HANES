"use client";

/**
 * @file production/input-assembly-b/components/AsmResultEntry.tsx
 * @description B 배치 ⑤단계 본문 — FG 발행 · 확정 세로형
 *
 * 초보자 가이드:
 * - 동작·API는 A안 AssemblyActionBar 와 완전히 같다. 같은 컨트롤러 값을 받고 같은 함수를 호출한다.
 *   여기는 배치만 다르다 — 440px 열에 들어가야 하므로 가로 바가 아니라 세로로 쌓는다.
 * - 화면 흐름은 두 단계다: ① 발행 전 = 발행 버튼, ② 발행 후 = FG 번호 + 실물 스캔 + 취소.
 *   두 단계를 동시에 보여주지 않는다. 지금 눌러야 할 것 하나만 크게 보이는 편이 현장에서 빠르다.
 * - 강조색(primary)은 이 열에서 발행/확정 버튼 한 곳뿐이다.
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, Play, RotateCcw } from 'lucide-react';
import { BarcodeScanInput } from '@/components/shared';

interface AsmResultEntryProps {
  canIssue: boolean;
  issueDisabledReason?: string;
  issuing: boolean;
  issuedFg: string | null;
  onIssue: () => void;
  confirming: boolean;
  canConfirm: boolean;
  onConfirmScan: (scannedBarcode: string) => void;
  onResetIssued: () => void;
}

export default function AsmResultEntry({
  canIssue, issueDisabledReason, issuing, issuedFg, onIssue,
  confirming, canConfirm, onConfirmScan, onResetIssued,
}: AsmResultEntryProps) {
  const { t } = useTranslation();
  const [confirmScan, setConfirmScan] = useState('');

  const submitConfirm = (raw?: string) => {
    const trimmed = (raw ?? confirmScan).replace(/\r?\n|\r/g, '').trim();
    if (!trimmed) return;
    onConfirmScan(trimmed);
    setConfirmScan('');
  };

  const handleReset = () => {
    setConfirmScan('');
    onResetIssued();
  };

  // ② 발행 후 — 실물 FG 라벨 스캔으로 확정
  if (issuedFg) {
    return (
      <div data-testid="asm-b-result-entry" className="flex flex-col gap-2">
        <div className="rounded-md border-2 border-emerald-600 bg-card px-3 py-2">
          <div className="text-[11px] font-semibold uppercase tracking-[0.04em] text-text-muted">
            {t('production.inputAssembly.issuedFgLabel', '발행된 FG')}
          </div>
          <div data-testid="asm-issued-fg" className="truncate font-mono text-lg font-black text-text">
            {issuedFg}
          </div>
        </div>
        <p className="text-xs text-text-muted">
          {t('production.inputAssembly.printAndScan', '이 라벨을 출력·부착 후 실물 라벨을 스캔하세요')}
        </p>
        <BarcodeScanInput
          value={confirmScan}
          onChange={setConfirmScan}
          onScan={submitConfirm}
          placeholder={t('production.inputAssembly.confirmScanPlaceholder', '실물 FG 라벨 스캔')}
          disabled={confirming || !canConfirm}
        />
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => submitConfirm()}
            disabled={confirming || !canConfirm || !confirmScan.trim()}
            className="flex h-12 flex-1 items-center justify-center gap-2 rounded-md bg-primary text-base font-black text-white transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:bg-surface disabled:text-text-muted"
          >
            <CheckCircle2 className="h-5 w-5" />
            {confirming ? t('common.saving') : t('common.confirm')}
          </button>
          <button
            type="button"
            onClick={handleReset}
            disabled={confirming}
            title={t('production.inputAssembly.cancelIssue', '발행 취소')}
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md border border-border bg-card text-text transition-colors hover:border-red-500 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <RotateCcw className="h-5 w-5" />
          </button>
        </div>
      </div>
    );
  }

  // ① 발행 전
  return (
    <div data-testid="asm-b-result-entry" className="flex flex-col gap-2">
      <button
        type="button"
        onClick={onIssue}
        disabled={!canIssue || issuing}
        title={issueDisabledReason}
        className="flex h-14 w-full items-center justify-center gap-2 rounded-md bg-primary text-base font-black tracking-[0.02em] text-white transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:bg-surface disabled:text-text-muted"
      >
        <Play className="h-5 w-5" />
        {issuing ? t('common.saving') : t('production.inputAssembly.issueFgLabel', 'FG 라벨 발행')}
      </button>
      {!canIssue && issueDisabledReason && (
        <p className="text-center text-xs font-semibold text-red-600 dark:text-red-400">{issueDisabledReason}</p>
      )}
    </div>
  );
}
