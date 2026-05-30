"use client";

/**
 * @file SelfInspectReInspectPanel.tsx
 * @description 자주검사 NG 재검사 패널 — 이전 NG 요약 카드 + 재검사 수량 선택 카드
 *
 * 초보자 가이드:
 * - NG 재검사 시작 시 표시
 * - 이전 어느 시료의 어느 항목이 FAIL였는지 요약 카드로 보여줌
 * - 재검사 시료 수량(1~baseSampleCount)을 버튼으로 선택
 * - 파괴검사 포함 시 추가 차감 안내 표시
 */
import { useTranslation } from 'react-i18next';
import { XCircle, Flame } from 'lucide-react';

export interface PrevNgItem {
  itemName: string;
  sampleIdx: number;
  value?: string;
}

interface SelfInspectReInspectPanelProps {
  prevNgSummary: PrevNgItem[];
  prevInspectTime: string;
  reInspectRound: number;
  baseSampleCount: number;
  reInspectSampleCount: number;
  hasDestructive: boolean;
  onCountChange: (n: number) => void;
}

export default function SelfInspectReInspectPanel({
  prevNgSummary, prevInspectTime, reInspectRound,
  baseSampleCount, reInspectSampleCount, hasDestructive, onCountChange,
}: SelfInspectReInspectPanelProps) {
  const { t } = useTranslation();

  return (
    <div className="space-y-2">
      {/* 이전 NG 결과 요약 */}
      {prevNgSummary.length > 0 && (
        <div className="p-3 border border-red-500 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <XCircle className="w-4 h-4 text-red-500 shrink-0" />
            <span className="text-xs font-bold text-red-700 dark:text-red-300">
              {t('kiosk.selfInspect.prevNgSummary', { n: reInspectRound })}
            </span>
            {prevInspectTime && (
              <span className="text-xs text-red-500 dark:text-red-400">{prevInspectTime}</span>
            )}
          </div>
          <div className="flex flex-wrap gap-1">
            {prevNgSummary.map((ng, i) => (
              <span
                key={i}
                className="text-xs text-red-700 dark:text-red-300 px-2 py-0.5 rounded border border-red-400 dark:border-red-600"
              >
                {t('kiosk.selfInspect.sampleTab', { n: ng.sampleIdx + 1 })} {ng.itemName}
                {ng.value ? ` (${ng.value})` : ''}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 재검사 수량 선택 */}
      <div className="p-3 border border-yellow-500 rounded-lg">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-xs font-bold text-yellow-800 dark:text-yellow-200 shrink-0">
            {t('kiosk.selfInspect.reInspectCount')}
          </span>
          <div className="flex gap-1 flex-wrap">
            {Array.from({ length: baseSampleCount }, (_, i) => i + 1).map(n => (
              <button
                key={n}
                onClick={() => onCountChange(n)}
                className={`px-3 py-1 text-xs rounded border font-medium transition-colors ${
                  reInspectSampleCount === n
                    ? 'bg-yellow-500 text-white border-yellow-500'
                    : 'bg-surface border-yellow-400 dark:border-yellow-600 text-yellow-700 dark:text-yellow-300 hover:border-yellow-500'
                }`}
              >
                {t('kiosk.selfInspect.nSamples', { n })}
              </button>
            ))}
          </div>
        </div>
        {hasDestructive && (
          <p className="mt-1.5 text-xs text-red-600 dark:text-red-400 flex items-center gap-1">
            <Flame className="w-3.5 h-3.5 shrink-0" />
            {t('kiosk.selfInspect.destructiveDeduct', { n: reInspectSampleCount })}
          </p>
        )}
      </div>
    </div>
  );
}
