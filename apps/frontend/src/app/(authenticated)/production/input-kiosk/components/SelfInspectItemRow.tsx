"use client";

/**
 * @file components/SelfInspectItemRow.tsx
 * @description 자주검사 항목 테이블 행 컴포넌트
 *
 * 초보자 가이드:
 * - MEASURE: 숫자 입력 → LSL/USL 자동 판정, FAIL 시 빨간 스타일
 * - VISUAL: PASS/FAIL 버튼
 * - DELEGATE: 의뢰검사 버튼 (PENDING 처리)
 * - 부모 SelfInspectModal에서 <tbody> 안에 삽입
 */
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, XCircle, Send } from 'lucide-react';

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
  rowIndex: number;
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

export default function SelfInspectItemRow({ rowIndex, item, result, onChange }: Props) {
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

  const isFail = r === 'FAIL';
  const isPass = r === 'PASS';
  const isPending = r === 'PENDING';

  // 상태는 입력 테두리·판정 텍스트로 구분 (파스텔 행 배경 미사용)
  const rowBg = '';

  return (
    <tr className={`border-b border-border last:border-0 transition-colors ${rowBg}`}>
      {/* No */}
      <td className="px-2 py-2 text-center text-xs text-text-muted">{rowIndex + 1}</td>

      {/* 항목명 + 플래그 */}
      <td className="px-3 py-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-sm font-medium text-text">{item.itemName}</span>
          {item.isDestructive && (
            <span className="text-[10px] border border-red-400 dark:border-red-600 text-red-700 dark:text-red-300 px-1.5 py-0.5 rounded">
              {t('kiosk.selfInspect.destructive')}
            </span>
          )}
          {item.inspectMethod === 'DELEGATE' && (
            <span className="text-[10px] border border-orange-400 dark:border-orange-600 text-orange-700 dark:text-orange-300 px-1.5 py-0.5 rounded">
              {t('kiosk.selfInspect.delegate')}
            </span>
          )}
        </div>
      </td>

      {/* 유형 배지 */}
      <td className="px-2 py-2 text-center">
        <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-medium ${
          item.itemType === 'MEASURE'
            ? 'border border-blue-400 dark:border-blue-600 text-blue-700 dark:text-blue-300'
            : 'border border-purple-400 dark:border-purple-600 text-purple-700 dark:text-purple-300'
        }`}>
          {item.itemType === 'MEASURE' ? t('kiosk.prep.measureType') : t('kiosk.prep.visualType')}
        </span>
      </td>

      {/* 기준 */}
      <td className="px-2 py-2 text-xs text-text-muted text-center">
        {item.itemType === 'MEASURE' && (item.lslValue != null || item.uslValue != null) ? (
          <span className="text-blue-600 dark:text-blue-400">
            {item.lslValue != null ? item.lslValue : '—'}
            {' ~ '}
            {item.uslValue != null ? item.uslValue : '—'}
            {item.unit ? ` ${item.unit}` : ''}
          </span>
        ) : item.standard ? (
          <span>{item.standard}</span>
        ) : '—'}
      </td>

      {/* 측정값 / 판정 입력 */}
      <td className="px-2 py-2">
        {item.inspectMethod === 'DELEGATE' ? (
          <button
            onClick={() => handleSetResult('PENDING')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded border text-xs font-medium transition-colors ${
              isPending
                ? 'bg-orange-500 text-white border-orange-500'
                : 'bg-surface border-border text-text-muted hover:border-orange-400 hover:text-orange-600'
            }`}
          >
            <Send className="w-3 h-3" />
            {t('kiosk.selfInspect.requestDelegate')}
          </button>
        ) : item.itemType === 'MEASURE' ? (
          <input
            type="number"
            value={result?.value ?? ''}
            onChange={e => handleMeasureChange(e.target.value)}
            placeholder={item.unit ?? t('kiosk.prep.measureValue')}
            className={`w-24 px-2 py-1 text-sm border rounded-lg bg-surface focus:outline-none focus:ring-1 ${
              isFail
                ? 'border-red-400 text-red-600 dark:text-red-400 font-bold focus:ring-red-400'
                : 'border-border focus:ring-primary'
            }`}
          />
        ) : (
          <div className="flex gap-1">
            <button
              onClick={() => handleSetResult('PASS')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded border text-xs font-medium transition-colors ${
                isPass
                  ? 'bg-green-500 text-white border-green-500'
                  : 'border-border text-text-muted hover:border-green-400 hover:text-green-700'
              }`}
            >
              <CheckCircle2 className="w-3 h-3" /> PASS
            </button>
            <button
              onClick={() => handleSetResult('FAIL')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded border text-xs font-medium transition-colors ${
                isFail
                  ? 'bg-red-500 text-white border-red-500'
                  : 'border-border text-text-muted hover:border-red-400 hover:text-red-700'
              }`}
            >
              <XCircle className="w-3 h-3" /> FAIL
            </button>
          </div>
        )}
      </td>

      {/* 판정 결과 배지 */}
      <td className="px-2 py-2 text-center">
        {isPass && <span className="text-xs font-bold text-green-600 dark:text-green-400">PASS</span>}
        {isFail && <span className="text-xs font-bold text-red-600 dark:text-red-400">FAIL</span>}
        {isPending && <span className="text-xs font-bold text-orange-600 dark:text-orange-400">{t('kiosk.selfInspect.delegating', '의뢰중')}</span>}
      </td>

      {/* 비고 */}
      <td className="px-2 py-2">
        <input
          type="text"
          value={result?.remark ?? ''}
          onChange={e => handleRemark(e.target.value)}
          placeholder={t('kiosk.prep.remark')}
          className="w-full px-2 py-1 text-xs border border-border rounded bg-surface focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </td>
    </tr>
  );
}
