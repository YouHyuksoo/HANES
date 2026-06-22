"use client";

/**
 * @file components/DefectSummaryPanel.tsx
 * @description 하단 중앙 불량 패널 — 불량입력 버튼 + 임시 보관 불량 리스트
 *
 * 초보자 가이드:
 * - 불량입력 버튼: DefectInputModal 오픈 (인터락/의뢰검사 대기 시 비활성)
 * - 리스트: store.pendingDefects (실적저장 전 임시 보관 불량) 표시
 */
import { useTranslation } from 'react-i18next';
import { AlertOctagon } from 'lucide-react';
import { useKioskStore } from '@/stores/kioskStore';

interface DefectSummaryPanelProps {
  onOpenDefect: () => void;
  disabled: boolean;
  disabledReasons?: string[];
}

export default function DefectSummaryPanel({ onOpenDefect, disabled, disabledReasons = [] }: DefectSummaryPanelProps) {
  const { t } = useTranslation();
  const { pendingDefects } = useKioskStore();
  const reasonText = disabledReasons.filter(Boolean).join(' / ');
  const buttonTitle = disabled
    ? (reasonText || t('kiosk.input.disabledHint'))
    : t('kiosk.input.defect');

  return (
    <div className="flex h-full flex-col gap-1.5 p-2">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1 text-xs font-bold text-text">
          <AlertOctagon className="h-3.5 w-3.5 text-red-500" />
          {t('kiosk.input.defect')}
        </span>
        <button
          onClick={onOpenDefect}
          disabled={disabled}
          title={buttonTitle}
          className="rounded bg-red-600 px-2.5 py-1 text-xs font-semibold text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-surface disabled:text-text-muted"
        >
          {t('kiosk.input.defect')}
        </button>
      </div>
      {disabled && reasonText && (
        <div className="text-[11px] text-text-muted" title={reasonText}>
          {reasonText}
        </div>
      )}
      <div className="min-h-0 flex-1 overflow-y-auto rounded border border-border bg-surface/40">
        {pendingDefects.length === 0 ? (
          <div className="px-2 py-4 text-center text-[11px] text-text-muted">
            {t('kiosk.defect.empty', '등록된 불량 없음')}
          </div>
        ) : (
          pendingDefects.map((d) => (
            <div
              key={d.defectCode}
              className="grid grid-cols-[1fr_36px] gap-1 border-b border-border/40 px-2 py-1 text-[11px] last:border-b-0"
            >
              <span className="truncate text-text">{d.defectName}</span>
              <span className="text-right font-bold tabular-nums text-red-600 dark:text-red-400">{(d.qty ?? 0).toLocaleString()}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
