"use client";

/**
 * @file production/input-kiosk-b/components/KioskContextBar.tsx
 * @description B 배치 상단 컨텍스트 띠 — 설비 · 작업지시 · 작업자 · 대차 · 준비 안내 · 전체화면
 *
 * 초보자 가이드:
 * - "지금 무엇을 어디서 누가 만드는가"만 담는 읽기 전용 성격의 띠다. 어두운 슬레이트 배경으로
 *   아래 작업 영역(흰 카드)과 면으로 구분한다. 강조색(primary)은 여기서 쓰지 않는다.
 * - 설비 선택 모달은 준비 안내 모달과 같은 모달을 열어야 하므로 열림 상태를 컨트롤러가 갖는다.
 * - 전체화면(view=work)은 기존 화면과 같은 규칙이다. MainLayout 이 /production/input-kiosk* 를 chromeless 로 본다.
 */
import { useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { ChevronDown, ClipboardList, Cpu, Maximize2, Minimize2, Pencil, Sparkles, UserPlus, X } from 'lucide-react';
import { OutputCarrierSlot } from '@/components/shared/carrier';
import EquipSelectModal from '../../input-kiosk/components/EquipSelectModal';
import type { InputKioskController } from '../../input-kiosk/hooks/useInputKioskController';

const ROUTE = '/production/input-kiosk-b';

export default function KioskContextBar({ c }: { c: InputKioskController }) {
  const { t } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const isWorkView = searchParams.get('view') === 'work';
  const [isFullscreen, setIsFullscreen] = useState(false);
  const { selectedEquip, selectedJobOrder, selectedWorkers } = c;

  useEffect(() => {
    const handle = () => setIsFullscreen(Boolean(document.fullscreenElement));
    handle();
    document.addEventListener('fullscreenchange', handle);
    return () => document.removeEventListener('fullscreenchange', handle);
  }, []);

  const handleToggleWorkView = useCallback(() => {
    if (isWorkView) {
      router.push(ROUTE);
      if (document.fullscreenElement) void document.exitFullscreen();
      return;
    }
    router.push(`${ROUTE}?view=work`);
    void document.documentElement.requestFullscreen();
  }, [isWorkView, router]);

  const cell = 'flex h-full min-w-0 flex-col justify-center border-r border-white/15 px-4';
  const label = 'text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400';
  const ghostBtn = 'inline-flex h-7 shrink-0 items-center gap-1 rounded border border-white/30 px-2 text-xs font-semibold text-white transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40';

  return (
    <>
      <div data-testid="kiosk-b-context-bar" className="flex h-16 shrink-0 items-stretch bg-slate-900 text-white dark:bg-slate-950">
        {/* 설비 */}
        <button
          type="button"
          data-testid="kiosk-equip-open"
          onClick={() => c.setIsEquipSelectOpen(true)}
          className={`${cell} w-64 shrink-0 text-left transition-colors hover:bg-white/5 ${selectedEquip ? '' : 'animate-pulse'}`}
        >
          <span className={label}>{t('kiosk.equip.title', '설비')}</span>
          <span className="flex items-center gap-1.5">
            <Cpu className="h-4 w-4 shrink-0 text-slate-300" />
            {selectedEquip ? (
              <span className="min-w-0 truncate text-sm font-bold">
                {selectedEquip.equipName}
                <span className="ml-1.5 text-xs font-normal text-slate-300">{selectedEquip.equipCode}</span>
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
            {selectedJobOrder ? (
              <>
                <span className="shrink-0 font-mono text-base font-black tracking-wide">{selectedJobOrder.orderNo}</span>
                <span className="min-w-0 truncate text-sm text-slate-200">
                  {selectedJobOrder.itemCode} · {selectedJobOrder.itemName}
                  {selectedJobOrder.planQty ? ` · ${t('kiosk.stepper.planQty', '계획')} ${selectedJobOrder.planQty.toLocaleString()} EA` : ''}
                </span>
                <button type="button" data-testid="kiosk-joborder-open" onClick={() => c.setIsJobOrderOpen(true)} className={ghostBtn} title={t('common.change')}>
                  <Pencil className="h-3 w-3" />{t('common.change')}
                </button>
              </>
            ) : (
              <button
                type="button"
                data-testid="kiosk-joborder-open"
                onClick={() => selectedEquip && c.setIsJobOrderOpen(true)}
                disabled={!selectedEquip}
                title={selectedEquip ? t('kiosk.header.selectJobOrder') : t('kiosk.header.selectEquipFirst', '설비를 먼저 선택하세요.')}
                className={`${ghostBtn} ${selectedEquip ? 'animate-pulse' : ''}`}
              >
                {t('kiosk.header.selectJobOrder')}
              </button>
            )}
          </span>
          <span className="truncate text-[10px] text-slate-400">
            {t('kiosk.header.orderLifecycleHint', '최초 실적입력 시 작업지시 자동 시작 · 양품이 계획수량에 도달하면 자동 종료 (조기 종료는 작업지시관리에서)')}
          </span>
        </div>

        {/* 작업자 */}
        <div data-testid="kiosk-worker-region" className={`${cell} max-w-[420px] shrink-0`}>
          <span className={label}>{t('kiosk.stepper.worker', '작업자')}</span>
          <span className="flex min-w-0 flex-wrap items-center gap-1.5">
            {selectedWorkers.map(w => (
              <span key={w.id} className="inline-flex items-center gap-1 rounded-full border border-emerald-400/70 px-2 py-0.5 text-xs font-bold text-emerald-200">
                <span className="max-w-[96px] truncate" title={w.workerName}>{w.workerName}</span>
                <button type="button" onClick={() => c.handleRemoveWorker(w.id)} aria-label={t('common.delete')} className="hover:text-red-300">
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
            <button
              type="button"
              data-testid="kiosk-worker-open"
              onClick={() => c.setIsWorkerOpen(true)}
              disabled={!selectedEquip}
              title={selectedEquip ? t('kiosk.header.addWorker') : t('kiosk.header.selectEquipFirst', '설비를 먼저 선택하세요.')}
              className={`${ghostBtn} ${selectedEquip && selectedWorkers.length === 0 ? 'animate-pulse border-red-400 text-red-200' : ''}`}
            >
              <UserPlus className="h-3 w-3" />{t('kiosk.header.addWorker')}
            </button>
          </span>
        </div>

        {/* 대차 · 준비 안내 · 전체화면 */}
        <div className="flex shrink-0 items-center gap-2 px-4">
          <OutputCarrierSlot state={c.outputCarrier} compact />
          <button
            type="button"
            data-testid="kiosk-guide-open"
            onClick={c.guide.openGuide}
            title={t('prepGuide.reopen', '준비 안내')}
            className={`${ghostBtn} h-9`}
          >
            <Sparkles className="h-4 w-4" />
            <span className="hidden whitespace-nowrap xl:inline">{t('prepGuide.reopen', '준비 안내')}</span>
          </button>
          <button
            type="button"
            onClick={handleToggleWorkView}
            title={isWorkView ? t('kiosk.header.menuView', '메뉴 화면으로') : t('kiosk.header.workView', '작업 전체화면')}
            aria-label={isWorkView ? t('kiosk.header.menuView', '메뉴 화면으로') : t('kiosk.header.workView', '작업 전체화면')}
            className={`${ghostBtn} h-9 w-9 justify-center px-0`}
          >
            {isWorkView || isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
        </div>
      </div>

      <EquipSelectModal
        isOpen={c.isEquipSelectOpen}
        onClose={() => c.setIsEquipSelectOpen(false)}
        equips={c.equips}
        onSelect={c.restoreEquipmentCurrentState}
      />
    </>
  );
}
