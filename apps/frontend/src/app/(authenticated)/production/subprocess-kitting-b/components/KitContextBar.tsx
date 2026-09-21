"use client";

/**
 * @file production/subprocess-kitting-b/components/KitContextBar.tsx
 * @description B 배치 상단 컨텍스트 띠 — 설비 · 작업지시 · 회로 · 대차 · 준비 안내 · 초기화
 *
 * 초보자 가이드:
 * - "지금 어느 설비에서 어떤 지시를 어느 회로로 만드는가"만 담는 띠다. 어두운 슬레이트 배경으로
 *   아래 작업 영역(흰 카드)과 면으로 구분한다. 강조색(primary)은 여기서 쓰지 않는다.
 * - input-kiosk-b 의 KioskContextBar 와 같은 규칙(셀 구분선 · 라벨 위 값 아래 · ghost 버튼)을 쓴다.
 * - 가공 키오스크와 달리 이 라우트는 chromeless 대상이 아니므로 전체화면 버튼은 두지 않는다.
 * - 설비 선택 모달은 이 띠가 직접 연다(설비 버튼 바로 옆에서 닫히는 흐름이 자연스럽다).
 * - 작업자는 여기 두지 않는다. 공용 WorkerSlot 은 밝은 카드 배경용이고, 작업자 배정은 작업 순서의
 *   첫 단계이므로 스테퍼 ①단계 안에 있다(2026-09-21 지시).
 */
import { useTranslation } from 'react-i18next';
import { ChevronDown, ClipboardList, Cpu, Maximize2, Minimize2, Pencil, RefreshCw, Sparkles, Waypoints } from 'lucide-react';
import { OutputCarrierSlot } from '@/components/shared/carrier';
import { useFullViewToggle } from '@/components/layout/useFullViewToggle';
import EquipSelectModal from '../../input-kiosk/components/EquipSelectModal';
import {
  getOrderKindMeta,
  type SubprocessKittingController,
} from '../../subprocess-kitting/hooks/useSubprocessKittingController';

export default function KitContextBar({ c }: { c: SubprocessKittingController }) {
  const { t } = useTranslation();
  const fullView = useFullViewToggle('/production/subprocess-kitting-b');
  const {
    equipCode, equipName, processCode, processName, selectedOrder,
    circuitNo, setCircuitNo, circuits, circuitOptions, outputCarrier,
  } = c;

  const cell = 'flex h-full min-w-0 flex-col justify-center border-r border-white/15 px-4';
  const label = 'text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400';
  const ghostBtn = 'inline-flex h-7 shrink-0 items-center gap-1 rounded border border-white/30 px-2 text-xs font-semibold text-white transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40';

  return (
    <>
      <div data-testid="subkit-b-context-bar" className="flex h-16 shrink-0 items-stretch bg-slate-900 text-white dark:bg-slate-950">
        {/* 설비 — 가장 먼저 고른다. 설비가 공정을 결정하고 작업지시 조회조건이 된다. */}
        <button
          type="button"
          data-testid="subkit-equip-open"
          onClick={() => c.setEquipModalOpen(true)}
          className={`${cell} w-64 shrink-0 text-left transition-colors hover:bg-white/5 ${equipCode ? '' : 'animate-pulse'}`}
        >
          <span className={label}>{t('kiosk.equip.title', '설비')}</span>
          <span className="flex items-center gap-1.5">
            <Cpu className="h-4 w-4 shrink-0 text-slate-300" />
            {equipCode ? (
              <span className="min-w-0 truncate text-sm font-bold">
                {equipName}
                <span className="ml-1.5 text-xs font-normal text-slate-300">{processName || processCode}</span>
              </span>
            ) : (
              <span className="text-sm font-semibold text-slate-300">{t('kiosk.header.selectEquip')}</span>
            )}
            <ChevronDown className="ml-auto h-3.5 w-3.5 shrink-0 opacity-60" />
          </span>
        </button>

        {/* 작업지시 */}
        <div className={`${cell} flex-1`}>
          <span className={label}>{t('kiosk.prep.jobOrder', '작업지시')}</span>
          <span className="flex min-w-0 items-center gap-3">
            <ClipboardList className="h-4 w-4 shrink-0 text-slate-300" />
            {selectedOrder ? (
              <>
                <span className="shrink-0 font-mono text-base font-black tracking-wide">{selectedOrder.orderNo}</span>
                <span className="min-w-0 truncate text-sm text-slate-200">
                  {selectedOrder.itemCode} · {selectedOrder.itemName}
                  {selectedOrder.planQty ? ` · ${t('kiosk.stepper.planQty', '계획')} ${selectedOrder.planQty.toLocaleString()} EA` : ''}
                </span>
                <span className="shrink-0 rounded border border-white/30 px-1.5 py-0.5 text-[10px] font-bold text-slate-200">
                  {getOrderKindMeta(selectedOrder.orderKind).label}
                </span>
                <button type="button" data-testid="subkit-joborder-open" onClick={() => c.setOrderSearchOpen(true)} className={ghostBtn} title={t('common.change')}>
                  <Pencil className="h-3 w-3" />{t('common.change')}
                </button>
              </>
            ) : (
              <button
                type="button"
                data-testid="subkit-joborder-open"
                onClick={() => equipCode && c.setOrderSearchOpen(true)}
                disabled={!equipCode}
                title={equipCode ? t('kiosk.header.selectJobOrder') : t('kiosk.header.selectEquipFirst', '설비를 먼저 선택하세요.')}
                className={`${ghostBtn} ${equipCode ? 'animate-pulse' : ''}`}
              >
                {t('kiosk.header.selectJobOrder')}
              </button>
            )}
          </span>
        </div>

        {/* 회로 — 발행·확정 모두 회로를 요구하므로 작업지시 바로 옆에 둔다. */}
        <div className={`${cell} w-56 shrink-0`}>
          <span className={label}>{t('production.subprocess.circuit', '회로')}</span>
          <span className="flex items-center gap-1.5">
            <Waypoints className="h-4 w-4 shrink-0 text-slate-300" />
            <select
              aria-label={t('production.subprocess.circuit', '회로')}
              data-testid="subkit-b-circuit"
              value={circuitNo}
              onChange={(event) => setCircuitNo(event.target.value)}
              disabled={circuits.length === 0}
              className={`min-w-0 flex-1 truncate rounded border border-white/30 bg-transparent px-1.5 py-0.5 text-sm font-bold text-white outline-none disabled:opacity-40 ${circuits.length > 0 && !circuitNo ? 'animate-pulse border-red-400' : ''}`}
            >
              {circuitOptions.map((option) => (
                <option key={option.value} value={option.value} className="bg-slate-900 text-white">{option.label}</option>
              ))}
            </select>
          </span>
        </div>

        {/* 대차 · 초기화 */}
        <div className="flex shrink-0 items-center gap-2 px-4">
          <OutputCarrierSlot state={outputCarrier} compact flags={c.carrierFlags} />
          <button
            type="button"
            data-testid="subkit-guide-open"
            onClick={c.guide.openGuide}
            title={t('prepGuide.reopen', '준비 안내')}
            className={`${ghostBtn} h-9`}
          >
            <Sparkles className="h-4 w-4" />
            <span className="hidden whitespace-nowrap xl:inline">{t('prepGuide.reopen', '준비 안내')}</span>
          </button>
          <button
            type="button"
            data-testid="subkit-b-fullview"
            onClick={fullView.toggle}
            title={fullView.isFullView ? t('fab.exitFullscreen', '전체화면 종료') : t('fab.fullscreen', '전체화면 보기')}
            aria-label={fullView.isFullView ? t('fab.exitFullscreen', '전체화면 종료') : t('fab.fullscreen', '전체화면 보기')}
            className={`${ghostBtn} h-9 w-9 justify-center px-0`}
          >
            {fullView.isFullView || fullView.isBrowserFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
          <button type="button" data-testid="subkit-b-reset" onClick={c.resetAll} title={t('common.reset')} className={`${ghostBtn} h-9`}>
            <RefreshCw className="h-4 w-4" />
            <span className="hidden whitespace-nowrap xl:inline">{t('common.reset')}</span>
          </button>
        </div>
      </div>

      <EquipSelectModal
        isOpen={c.equipModalOpen}
        onClose={() => c.setEquipModalOpen(false)}
        equips={c.equips}
        onSelect={c.handleEquipSelect}
      />
    </>
  );
}
