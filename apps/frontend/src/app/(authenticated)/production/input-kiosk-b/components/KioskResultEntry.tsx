"use client";

/**
 * @file production/input-kiosk-b/components/KioskResultEntry.tsx
 * @description B 배치 4단계 본문 — 실적입력 세로형(묶음·시리얼 / 작업수·양품·불량 / 불량 상세 / 저장 버튼)
 *
 * 초보자 가이드:
 * - 입력 상태·저장 규칙은 hooks/useProductionResultSubmit(기존 ProductionInputBar 와 공유). 여기는 배치만 다르다.
 * - 기존 가로 바 + 불량입력 패널 두 상자를 한 덩어리로 합쳤다. 상자 안 상자, 제목 중복(불량입력×2), 생산유형
 *   중복(단계 헤더 오른쪽에 이미 표시)을 없앴다(2026-09-20 지적).
 * - 불량 상세는 한 줄: 등록 없음 안내 또는 등록된 불량 칩 + [불량코드 등록] 버튼. 실적 저장 시 함께 전송된다.
 * - 강조색(primary)은 이 화면에서 저장 버튼 한 곳뿐이다.
 * - 저장 버튼은 입력 3줄 오른쪽에 세로로 붙인다. 아래에 두면 열이 넘칠 때 스크롤해야 보였다(2026-09-20 지적).
 */
import { useTranslation } from 'react-i18next';
import { ChevronDown, Save } from 'lucide-react';
import { formatQty, parseQty } from '@/utils/qty';
import { useProductionResultSubmit, type ProductionResultSubmitInput } from '../../input-kiosk/hooks/useProductionResultSubmit';

interface KioskResultEntryProps extends ProductionResultSubmitInput {
  /** 불량코드 등록 모달 열기 */
  onOpenDefect: () => void;
  /** 불량코드 등록이 막힌 상태(인터록 미완·의뢰검사 대기) */
  defectDisabled: boolean;
}

export default function KioskResultEntry({ onOpenDefect, defectDisabled, ...submitInput }: KioskResultEntryProps) {
  const { t } = useTranslation();
  const {
    totalQty, goodQty, defectQty, handleTotalChange, handleDefectChange,
    lotSize, setLotSize, lotOptions, serialNo, pendingDefects, pendingDefectTotal,
    canSave, saving, buttonTitle, handleSubmit,
  } = useProductionResultSubmit(submitInput);

  const label = 'text-[11px] font-semibold uppercase tracking-[0.04em] text-text-muted';
  const qtyBox = 'h-11 w-full rounded border text-center text-xl font-bold tabular-nums focus:outline-none';

  return (
    <div data-testid="kiosk-b-result-entry" className="flex items-stretch gap-2">
      <div className="flex min-w-0 flex-1 flex-col gap-2">
      {/* 묶음단위 · 시리얼 */}
      <div className="grid grid-cols-[88px_minmax(0,1fr)] gap-2">
        <label className="flex flex-col gap-1">
          <span className={label}>{t('kiosk.input.lotSize')}</span>
          <span className="relative">
            <select
              value={lotSize}
              onChange={e => setLotSize(Number(e.target.value))}
              className="h-10 w-full appearance-none rounded border border-border bg-surface pl-3 pr-7 text-base font-bold tabular-nums focus:outline-none focus:ring-1 focus:ring-primary"
            >
              {lotOptions.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
          </span>
        </label>
        <div className="flex flex-col gap-1">
          <span className={label}>SERIAL NO</span>
          <div className="flex h-10 items-center rounded border border-border bg-surface px-3 font-mono text-sm font-bold text-text">
            <span className="truncate">{serialNo || <span className="font-sans font-normal text-text-muted">{t('kiosk.input.selectJobOrderFirst')}</span>}</span>
          </div>
        </div>
      </div>

      {/* 작업수 · 양품 · 불량 */}
      <div className="grid grid-cols-3 gap-2">
        <label className="flex flex-col gap-1">
          <span className={label}>{t('kiosk.input.totalQty')}</span>
          <input
            type="text"
            inputMode="numeric"
            data-testid="kiosk-total-qty"
            value={totalQty === '' ? '' : formatQty(parseQty(totalQty))}
            onChange={e => handleTotalChange(e.target.value)}
            placeholder="0"
            className={`${qtyBox} border-border bg-surface text-text focus:ring-2 focus:ring-primary`}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className={`${label} text-green-700 dark:text-green-400`}>{t('kiosk.input.goodQty')}</span>
          <input
            type="text"
            inputMode="numeric"
            value={goodQty === '' ? '' : formatQty(parseQty(goodQty))}
            readOnly
            placeholder="0"
            className={`${qtyBox} cursor-default border-green-600 bg-card text-green-700 dark:border-green-500 dark:text-green-400`}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className={`${label} text-red-600 dark:text-red-400`}>{t('kiosk.input.defectQty')}</span>
          {pendingDefectTotal > 0 ? (
            <div className={`${qtyBox} flex cursor-default items-center justify-center border-red-600 bg-card text-red-600 dark:border-red-500 dark:text-red-400`} title={t('kiosk.input.defectHint')}>
              {pendingDefectTotal.toLocaleString()}
            </div>
          ) : (
            <input
              type="text"
              inputMode="numeric"
              value={defectQty === '' ? '' : formatQty(parseQty(defectQty))}
              onChange={e => handleDefectChange(e.target.value)}
              placeholder="0"
              className={`${qtyBox} border-border bg-surface text-red-600 focus:ring-2 focus:ring-red-500 dark:text-red-400`}
            />
          )}
        </label>
      </div>

      {/* 불량 상세 — 한 줄 */}
      <div className="flex min-h-9 items-center gap-2 rounded border border-dashed border-border px-2">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5 py-1 text-xs">
          {pendingDefects.length === 0 ? (
            <span className="text-text-muted">{t('kiosk.defect.empty', '등록된 불량 없음')}</span>
          ) : pendingDefects.map(d => (
            <span key={d.defectCode} className="inline-flex items-center gap-1 rounded-full border border-red-600 px-2 py-0.5 font-semibold text-red-600 dark:border-red-400 dark:text-red-400">
              <span className="max-w-[120px] truncate" title={d.defectName}>{d.defectName}</span>
              <span className="tabular-nums">×{(d.qty ?? 0).toLocaleString()}</span>
            </span>
          ))}
        </div>
        <button
          type="button"
          onClick={onOpenDefect}
          disabled={defectDisabled}
          title={defectDisabled ? t('kiosk.input.disabledHint') : t('kiosk.input.defect')}
          className="h-7 shrink-0 rounded border border-border bg-card px-2.5 text-xs font-bold text-text transition-colors hover:border-red-500 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {t('kiosk.stepper.registerDefect', '불량코드 등록')}
        </button>
      </div>

      </div>

      {/* 저장 — 우측 세로 버튼, 스크롤 없이 항상 보인다 */}
      <button
        type="button"
        data-testid="kiosk-save-result"
        onClick={handleSubmit}
        disabled={!canSave || saving}
        title={buttonTitle}
        className="flex w-24 shrink-0 flex-col items-center justify-center gap-2 rounded-md bg-primary text-base font-black tracking-[0.04em] text-white transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:bg-surface disabled:text-text-muted"
      >
        <Save className="h-6 w-6" />
        <span className="whitespace-nowrap">{saving ? t('common.saving') : t('kiosk.input.submit')}</span>
      </button>
    </div>
  );
}
