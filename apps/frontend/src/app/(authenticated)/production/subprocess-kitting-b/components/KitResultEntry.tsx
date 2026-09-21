"use client";

/**
 * @file production/subprocess-kitting-b/components/KitResultEntry.tsx
 * @description B 배치 4단계 본문 — 키팅 실행·확정 세로형 (판정 / 발행 / 실물 확정 스캔)
 *
 * 초보자 가이드:
 * - 동작·API는 A안 SubKitActionBar 와 완전히 같다. 같은 컨트롤러 값을 받고 같은 함수를 호출한다.
 *   여기는 배치만 다르다 — 440px 열에 들어가야 하므로 가로 바가 아니라 세로로 쌓는다.
 * - A안 SubKitActionBar 를 그대로 쓰면 `lg:flex-row` 가 뷰포트 기준으로 걸려서 좁은 열 안에서도
 *   가로로 펴지고, 안내 문구가 한 글자 폭으로 찌그러진다(2026-09-21 지적). 그래서 별도 컴포넌트를 둔다.
 * - 화면 흐름은 두 단계다: ① 발행 전 = 판정 + 발행 버튼, ② 발행 후 = 발행번호 + 실물 스캔 + 취소.
 *   두 단계를 동시에 보여주지 않는다. 지금 눌러야 할 것 하나만 크게 보이는 편이 현장에서 빠르다.
 * - 강조색(primary)은 이 열에서 발행 버튼 한 곳뿐이다.
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, Play, RotateCcw, XCircle } from 'lucide-react';
import { BarcodeScanInput } from '@/components/shared';

interface KitResultEntryProps {
  canIssue: boolean;
  issuing: boolean;
  issuedSg: string | null;
  onIssue: () => void;
  confirming: boolean;
  onConfirmScan: (scannedBarcode: string) => void;
  onResetIssued: () => void;
  resultQuality: 'GOOD' | 'DEFECT';
  onResultQualityChange: (quality: 'GOOD' | 'DEFECT') => void;
}

export default function KitResultEntry({
  canIssue, issuing, issuedSg, onIssue,
  confirming, onConfirmScan, onResetIssued,
  resultQuality, onResultQualityChange,
}: KitResultEntryProps) {
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

  const toggle = 'flex h-11 flex-1 items-center justify-center gap-1.5 rounded-md text-sm font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-50';

  // ② 발행 후 — 실물 라벨 스캔으로 확정
  if (issuedSg) {
    return (
      <div data-testid="subkit-b-result-entry" className="flex flex-col gap-2">
        <div className="rounded-md border-2 border-emerald-600 bg-card px-3 py-2">
          <div className="text-[11px] font-semibold uppercase tracking-[0.04em] text-text-muted">
            {t('production.subprocess.issuedSgLabel', '발행된 SFG')}
          </div>
          <div data-testid="subkit-issued-sg" className="truncate font-mono text-lg font-black text-text">
            {issuedSg}
          </div>
        </div>
        <p className="text-xs text-text-muted">
          {t('production.subprocess.printAndScan', '이 라벨을 출력·부착 후 실물 라벨을 스캔하세요')}
        </p>
        <BarcodeScanInput
          value={confirmScan}
          onChange={setConfirmScan}
          onScan={submitConfirm}
          placeholder={t('production.subprocess.confirmScanPlaceholder', '실물 SFG 라벨 스캔')}
          disabled={confirming}
        />
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => submitConfirm()}
            disabled={confirming || !confirmScan.trim()}
            className="flex h-12 flex-1 items-center justify-center gap-2 rounded-md bg-primary text-base font-black text-white transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:bg-surface disabled:text-text-muted"
          >
            <CheckCircle2 className="h-5 w-5" />
            {confirming ? t('common.saving') : t('common.confirm')}
          </button>
          <button
            type="button"
            onClick={handleReset}
            disabled={confirming}
            title={t('production.subprocess.cancelIssue', '발행 취소')}
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md border border-border bg-card text-text transition-colors hover:border-red-500 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <RotateCcw className="h-5 w-5" />
          </button>
        </div>
      </div>
    );
  }

  // ① 발행 전 — 판정 고르고 발행
  return (
    <div data-testid="subkit-b-result-entry" className="flex flex-col gap-2">
      <div className="flex items-center gap-1 rounded-lg border border-border bg-surface p-1">
        <button
          type="button"
          onClick={() => onResultQualityChange('GOOD')}
          disabled={issuing || confirming}
          className={`${toggle} ${resultQuality === 'GOOD'
            ? 'bg-emerald-600 text-white shadow-sm'
            : 'text-emerald-700 hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-emerald-900/20'}`}
        >
          <CheckCircle2 className="h-4 w-4" />
          {t('kiosk.input.goodQty', '양품')}
        </button>
        <button
          type="button"
          onClick={() => onResultQualityChange('DEFECT')}
          disabled={issuing || confirming}
          className={`${toggle} ${resultQuality === 'DEFECT'
            ? 'bg-red-600 text-white shadow-sm'
            : 'text-red-700 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-900/20'}`}
        >
          <XCircle className="h-4 w-4" />
          {t('kiosk.input.defectQty', '불량')}
        </button>
      </div>

      <button
        type="button"
        onClick={onIssue}
        disabled={!canIssue || issuing}
        className="flex h-14 w-full items-center justify-center gap-2 rounded-md bg-primary text-base font-black tracking-[0.02em] text-white transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:bg-surface disabled:text-text-muted"
      >
        <Play className="h-5 w-5" />
        {issuing ? t('common.saving') : t('production.subprocess.issueSgLabel', 'SFG 라벨 발행')}
      </button>
    </div>
  );
}
