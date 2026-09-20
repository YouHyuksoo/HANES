"use client";

/**
 * @file components/ProductionInputBar.tsx
 * @description 하단 실적입력 바 — 묶음단위·시리얼·수량 입력 + 실적저장 (가로형, 기존 3열 배치용)
 *
 * 초보자 가이드:
 * - 입력 상태와 저장 로직은 hooks/useProductionResultSubmit 에 있다(B 배치 KioskResultEntry 와 공유).
 * - 불량입력: DefectInputModal로 불량유형/수량 등록 → pendingDefects에 임시 보관
 * - 시리얼 번호: {orderNo}-{seq 3자리} 형식 자동 생성. 저장 성공 시 serialSeq 자동 증가, pendingDefects 초기화
 */
import { useTranslation } from 'react-i18next';
import { Save, ChevronDown } from 'lucide-react';
import { formatQty, parseQty } from '@/utils/qty';
import { useProductionResultSubmit } from '../hooks/useProductionResultSubmit';

interface ProductionInputBarProps {
  onSaved: () => void;
  /** 실적 저장 성공 후 생성된 생산실적번호 전달 — SFG 라벨 자동 출력 등 후처리에 사용 */
  onResultSaved?: (resultNo: string) => void;
  /** 준비단계 인터락 모두 완료 여부 — false면 실적입력 비활성화 */
  interlockDone?: boolean;
  disabledReasons?: string[];
  productionType: 'TRIAL' | 'MASS';
  /** 출력 대차 번호 — 실적 저장 요청에 실려 대차에 라벨을 적재한다 */
  outputCarrierNo: string | null;
  /** 대차 용량 초과(400 "대차 교체")를 받았을 때 슬롯을 비운다 */
  onCapacityRejected: () => void;
}

export default function ProductionInputBar({
  onSaved,
  onResultSaved,
  interlockDone = true,
  disabledReasons = [],
  productionType,
  outputCarrierNo,
  onCapacityRejected,
}: ProductionInputBarProps) {
  const { t } = useTranslation();
  const {
    totalQty, goodQty, defectQty, handleTotalChange, handleDefectChange,
    lotSize, setLotSize, lotOptions, serialNo, pendingDefectTotal,
    canSave, saving, buttonTitle, handleSubmit,
  } = useProductionResultSubmit({ onSaved, onResultSaved, interlockDone, disabledReasons, outputCarrierNo, onCapacityRejected });

  const isMassProduction = productionType === 'MASS';
  const productionTypeLabel = isMassProduction ? '양산' : '시생산';
  const productionTypeHint = isMassProduction
    ? '초물 합격 완료. 이후 실적은 양산으로 저장됩니다.'
    : '초물 합격 전까지 시생산으로 저장됩니다.';

  return (
    <div className="h-full bg-card flex-shrink-0">
      <div className="flex h-full min-h-[88px] items-stretch gap-0">

        {/* 생산실적 입력 영역 */}
        <div className="flex-1 min-w-0 flex flex-wrap items-center content-center gap-1.5 px-2 py-2">
          {/* 묶음단위 */}
          <div className="flex flex-col gap-1 shrink-0">
            <span className="text-xs text-text-muted">{t('kiosk.input.lotSize')}</span>
            <div className="relative">
              <select
                value={lotSize}
                onChange={e => setLotSize(Number(e.target.value))}
                className="h-8 w-14 pl-2 pr-5 text-sm font-medium bg-surface border border-border rounded appearance-none focus:outline-none focus:ring-1 focus:ring-primary"
              >
                {lotOptions.map(n => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted pointer-events-none" />
            </div>
          </div>

          {/* 시리얼 번호 */}
          <div className="flex flex-col gap-1 flex-1 min-w-[86px]">
            <span className="text-xs text-text-muted">SERIAL NO</span>
            <div className="h-8 px-1.5 bg-surface/50 border border-border/50 rounded flex items-center">
              <span className="text-xs font-mono text-text truncate">
                {serialNo || <span className="text-text-muted">{t('kiosk.input.selectJobOrderFirst')}</span>}
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-1 shrink-0 min-w-[92px]" title={productionTypeHint}>
            <span className="text-xs text-text-muted">생산유형</span>
            <div className={`h-8 px-2 rounded border flex items-center justify-center text-xs font-bold ${
              isMassProduction
                ? 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-900/20 dark:border-emerald-800 dark:text-emerald-300'
                : 'bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-900/20 dark:border-amber-800 dark:text-amber-300'
            }`}>
              {productionTypeLabel}
            </div>
          </div>

          {/* 수량 입력 3칸 */}
          <div className="grid w-full grid-cols-3 gap-1.5 shrink-0">
            {/* 작업수 */}
            <div className="flex flex-col gap-1 min-w-0">
              <span className="text-[11px] text-text-muted text-center">{t('kiosk.input.totalQty')}</span>
              <input
                type="text"
                inputMode="numeric"
                data-testid="kiosk-total-qty"
                value={totalQty === '' ? '' : formatQty(parseQty(totalQty))}
                onChange={e => handleTotalChange(e.target.value)}
                placeholder="0"
                className="h-8 w-full text-center text-base font-bold bg-surface border border-border rounded focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            {/* 양품 */}
            <div className="flex flex-col gap-1 min-w-0">
              <span className="text-[11px] text-green-600 dark:text-green-400 text-center">{t('kiosk.input.goodQty')}</span>
              <input
                type="text"
                inputMode="numeric"
                value={goodQty === '' ? '' : formatQty(parseQty(goodQty))}
                readOnly
                placeholder="0"
                className="h-8 w-full text-center text-base font-bold bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-300 rounded focus:outline-none cursor-default"
              />
            </div>
            {/* 불량 */}
            <div className="flex flex-col gap-1 min-w-0">
              <span className="text-[11px] text-red-600 dark:text-red-400 text-center">{t('kiosk.input.defectQty')}</span>
              {pendingDefectTotal > 0 ? (
                /* pendingDefects가 있으면 합계 표시 (읽기 전용) */
                <div className="h-8 w-full flex items-center justify-center text-base font-bold bg-red-50 dark:bg-red-900/20 border border-red-400 dark:border-red-600 text-red-700 dark:text-red-300 rounded cursor-default">
                  {pendingDefectTotal}
                </div>
              ) : (
                <input
                  type="text"
                  inputMode="numeric"
                  value={defectQty === '' ? '' : formatQty(parseQty(defectQty))}
                  onChange={e => handleDefectChange(e.target.value)}
                  placeholder="0"
                  className="h-8 w-full text-center text-base font-bold bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 rounded focus:outline-none"
                />
              )}
            </div>
          </div>
          {/* 불량 입력 안내: 불량코드는 좌측 불량입력 패널에서 등록, 이 칸은 합계 표시 */}
          <p className="text-[10px] leading-tight text-text-muted">
            {t('kiosk.input.defectHint', '불량은 좌측 불량입력 패널에서 불량코드와 함께 등록하세요. 등록되면 이 칸은 합계만 표시합니다.')}
          </p>
        </div>

        {/* 실적입력 버튼 */}
        <button
          data-testid="kiosk-save-result"
          onClick={handleSubmit}
          disabled={!canSave || saving}
          title={buttonTitle}
          className="flex w-16 shrink-0 flex-col items-center justify-center gap-1 bg-primary px-1 hover:bg-primary/90 disabled:bg-surface disabled:cursor-not-allowed text-white disabled:text-text-muted transition-colors"
        >
          <Save className="w-5 h-5" />
          <span className="text-xs font-bold whitespace-nowrap">
            {saving ? t('common.saving') : t('kiosk.input.submit')}
          </span>
        </button>
      </div>
    </div>
  );
}
