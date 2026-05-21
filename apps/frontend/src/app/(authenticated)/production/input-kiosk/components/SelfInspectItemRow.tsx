"use client";

/**
 * @file components/SelfInspectItemRow.tsx
 * @description 자주검사 항목 한 행 컴포넌트
 *
 * 초보자 가이드:
 * - MEASURE: 숫자 입력 → LSL/USL 자동 판정
 * - VISUAL: PASS/FAIL 버튼
 * - DELEGATE: 의뢰검사 버튼 (PENDING 처리)
 */
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, XCircle, Send, ChevronRight } from 'lucide-react';

export interface SelfInspectItem {
  id: string;
  itemName: string;
  standard: string | null;
  inspectMethod: 'DIRECT' | 'DELEGATE';
  timing: string;
  isDestructive: boolean;
  itemType: 'MEASURE' | 'VISUAL';
  unit?: string | null;
  lslValue?: number | null;
  uslValue?: number | null;
  sampleCount: number;
}

export interface SampleItemResult {
  value?: string;
  result: 'PASS' | 'FAIL' | 'PENDING' | null;
  remark?: string;
}

interface Props {
  item: SelfInspectItem;
  result: SampleItemResult | undefined;
  onChange: (itemId: string, next: SampleItemResult) => void;
}

function autoJudge(
  value: string,
  lsl: number | null | undefined,
  usl: number | null | undefined,
): 'PASS' | 'FAIL' | null {
  if (!value.trim()) return null;
  const num = Number(value);
  if (isNaN(num)) return null;
  if (lsl != null && num < lsl) return 'FAIL';
  if (usl != null && num > usl) return 'FAIL';
  return 'PASS';
}

export default function SelfInspectItemRow({ item, result, onChange }: Props) {
  const { t } = useTranslation();
  const r = result?.result ?? null;

  const handleMeasureChange = useCallback((value: string) => {
    onChange(item.id, {
      value,
      result: autoJudge(value, item.lslValue, item.uslValue),
      remark: result?.remark,
    });
  }, [item, result, onChange]);

  const handleSetResult = useCallback((next: 'PASS' | 'FAIL' | 'PENDING') => {
    onChange(item.id, { ...result, result: next, value: result?.value });
  }, [item.id, result, onChange]);

  const handleRemark = useCallback((remark: string) => {
    onChange(item.id, { ...result, result: r, remark });
  }, [item.id, result, r, onChange]);

  const rowBg = r === 'PASS'
    ? 'bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800'
    : r === 'FAIL'
    ? 'bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800'
    : r === 'PENDING'
    ? 'bg-orange-50 dark:bg-orange-950 border-orange-200 dark:border-orange-800'
    : 'bg-surface border-border';

  return (
    <div className={`p-3 border rounded-lg transition-colors ${rowBg}`}>
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-text">{item.itemName}</span>
            {item.isDestructive && (
              <span className="text-[10px] bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 px-1.5 py-0.5 rounded">
                {t('kiosk.selfInspect.destructive')}
              </span>
            )}
            {item.inspectMethod === 'DELEGATE' && (
              <span className="text-[10px] bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 px-1.5 py-0.5 rounded">
                {t('kiosk.selfInspect.delegate')}
              </span>
            )}
          </div>
          {item.standard && (
            <p className="text-xs text-text-muted mt-0.5 flex items-center gap-1">
              <ChevronRight className="w-3 h-3 shrink-0" />{item.standard}
            </p>
          )}
          {item.itemType === 'MEASURE' && (item.lslValue != null || item.uslValue != null) && (
            <p className="text-xs text-blue-600 dark:text-blue-400 mt-0.5">
              {item.lslValue != null && `${t('kiosk.prep.lsl')}: ${item.lslValue}`}
              {item.lslValue != null && item.uslValue != null && ' ~ '}
              {item.uslValue != null && `${t('kiosk.prep.usl')}: ${item.uslValue}`}
              {item.unit && ` (${item.unit})`}
            </p>
          )}
        </div>

        {/* 결과 입력 */}
        {item.inspectMethod === 'DELEGATE' ? (
          <button
            onClick={() => handleSetResult('PENDING')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors shrink-0 ${
              r === 'PENDING'
                ? 'bg-orange-500 text-white border-orange-500'
                : 'bg-surface border-border text-text-muted hover:bg-orange-50 hover:border-orange-300 hover:text-orange-600'
            }`}
          >
            <Send className="w-3.5 h-3.5" />
            {t('kiosk.selfInspect.requestDelegate')}
          </button>
        ) : item.itemType === 'MEASURE' ? (
          <div className="flex items-center gap-2 shrink-0">
            <input
              type="number"
              value={result?.value ?? ''}
              onChange={e => handleMeasureChange(e.target.value)}
              placeholder={item.unit ?? t('kiosk.prep.measureValue')}
              className="w-24 px-2 py-1.5 text-sm border border-border rounded-lg bg-surface focus:outline-none focus:ring-1 focus:ring-primary"
            />
            {r === 'PASS' && <span className="text-xs font-bold text-green-600 dark:text-green-400">PASS</span>}
            {r === 'FAIL' && <span className="text-xs font-bold text-red-600 dark:text-red-400">FAIL</span>}
          </div>
        ) : (
          <div className="flex gap-2 shrink-0">
            <button
              onClick={() => handleSetResult('PASS')}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                r === 'PASS'
                  ? 'bg-green-500 text-white border-green-500'
                  : 'bg-surface border-border text-text-muted hover:bg-green-50 hover:border-green-400 hover:text-green-700'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" /> PASS
            </button>
            <button
              onClick={() => handleSetResult('FAIL')}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                r === 'FAIL'
                  ? 'bg-red-500 text-white border-red-500'
                  : 'bg-surface border-border text-text-muted hover:bg-red-50 hover:border-red-400 hover:text-red-700'
              }`}
            >
              <XCircle className="w-3.5 h-3.5" /> FAIL
            </button>
          </div>
        )}
      </div>

      {/* 항목별 비고 */}
      <div className="mt-2 pl-0">
        <input
          type="text"
          value={result?.remark ?? ''}
          onChange={e => handleRemark(e.target.value)}
          placeholder={t('kiosk.prep.remark')}
          className="w-full px-2 py-1 text-xs border border-border rounded bg-surface focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>
    </div>
  );
}
