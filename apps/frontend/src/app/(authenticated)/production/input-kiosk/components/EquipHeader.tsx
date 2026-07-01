"use client";

/**
 * @file components/EquipHeader.tsx
 * @description 키오스크 상단 헤더
 *
 * - Row1: 설비 / 작업지시+작업자 / 설비일일+작업자설비점검 / 전체화면
 * - Row2: 생산실적 (중앙, 크게)
 */
import { useState, useCallback, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import {
  AlertTriangle, ChevronDown, ClipboardList, Cpu,
  Maximize2, Minimize2, UserPlus, X, CheckCircle,
} from 'lucide-react';
import { useKioskStore } from '@/stores/kioskStore';
import EquipSelectModal from './EquipSelectModal';
import HeaderCheckItem from './HeaderCheckItem';
import type { EquipOption } from '../utils/equipOptions';

interface EquipHeaderProps {
  equips: EquipOption[];
  onOpenJobOrder: () => void;
  onOpenWorker: () => void;
  onOpenDailyInspect: () => void;
  onOpenWorkerInspect: () => void;
  onSelectEquip: (equip: EquipOption) => void;
  onRemoveWorker: (workerId: string) => void;
  /** 설비일일점검 완료 시각 "YYYY-MM-DD HH:mm:ss" (없으면 미완료/시각없음) */
  dailyInspectAt?: string | null;
  /** 작업자설비점검 완료 시각 "YYYY-MM-DD HH:mm:ss" */
  workerInspectAt?: string | null;
}

export default function EquipHeader({
  equips, onOpenJobOrder, onOpenWorker, onOpenDailyInspect, onOpenWorkerInspect,
  onSelectEquip, onRemoveWorker,
  dailyInspectAt, workerInspectAt,
}: EquipHeaderProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isEquipModalOpen, setIsEquipModalOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const {
    selectedEquip, selectedJobOrder, selectedWorkers, interlock,
  } = useKioskStore();
  const isWorkView = searchParams.get('view') === 'work';

  useEffect(() => {
    const handle = () => setIsFullscreen(Boolean(document.fullscreenElement));
    handle();
    document.addEventListener('fullscreenchange', handle);
    return () => document.removeEventListener('fullscreenchange', handle);
  }, []);

  const handleEquipSelect = useCallback((equip: EquipOption) => {
    onSelectEquip(equip);
  }, [onSelectEquip]);

  const handleToggleWorkView = useCallback(() => {
    if (isWorkView) {
      router.push('/production/input-kiosk');
      if (document.fullscreenElement) void document.exitFullscreen();
      return;
    }
    router.push('/production/input-kiosk?view=work');
    void document.documentElement.requestFullscreen();
  }, [isWorkView, router]);

  const completed = selectedJobOrder?.completedQty ?? 0;
  const planQty = selectedJobOrder?.planQty ?? 0;
  const progress = planQty ? Math.min(Math.round((completed / planQty) * 100), 100) : 0;

  const dailyInspectDisabledReason = !selectedEquip
    ? t('kiosk.header.selectEquipFirst', '설비를 먼저 선택하세요.')
    : undefined;
  const workerInspectDisabledReason = [
    !interlock.dailyInspectDone ? t('kiosk.header.dailyInspectRequired', '설비일일점검을 먼저 완료하세요.') : '',
    !selectedJobOrder ? t('kiosk.header.selectJobOrderFirst', '작업지시를 먼저 선택하세요.') : '',
    selectedWorkers.length === 0 ? t('kiosk.header.workerRequiredForInspect', '작업자를 1명 이상 추가하세요.') : '',
  ].filter(Boolean).join(' ') || undefined;

  // 완료 시각을 "완료 HH:mm" 형태로 — 시각이 없으면 undefined(→ HeaderCheckItem이 "완료"로 폴백)
  const doneLabel = t('kiosk.header.done', '완료');
  const inspectDoneDetail = (at?: string | null) => {
    if (!at) return undefined;
    const hhmm = (at.split(' ')[1] ?? at).slice(0, 5);
    return `${doneLabel} ${hhmm}`;
  };

  return (
    <>
      <div className="flex-shrink-0 border-b border-border bg-card">
        {/* ── Row 1: 설비 / 작업지시+작업자 / 점검 / 전체화면 ── */}
        <div className="flex h-14 items-center gap-3 border-b border-border/50 bg-surface/50 px-4">

          {/* 설비 선택 */}
          <button
            onClick={() => setIsEquipModalOpen(true)}
            className={`flex h-11 w-52 shrink-0 items-center gap-2 rounded-lg border-2 px-3 text-left transition-colors ${
              selectedEquip
                ? 'border-primary/40 bg-primary/5 hover:bg-primary/10'
                : 'border-dashed border-border hover:border-primary animate-pulse'
            }`}
          >
            <Cpu className="h-5 w-5 shrink-0 text-primary" />
            <div className="min-w-0 flex-1">
              {selectedEquip ? (
                <>
                  <div className="truncate text-sm font-extrabold text-black dark:text-white">{selectedEquip.equipName}</div>
                  <div className="truncate text-[11px] text-black/60 dark:text-white/60">
                    {selectedEquip.equipCode}
                    {selectedEquip.processCode && (
                      <span className="ml-1 text-primary font-semibold">
                        · {selectedEquip.processName || selectedEquip.processCode}
                      </span>
                    )}
                  </div>
                </>
              ) : (
                <span className="text-sm font-semibold text-black/60 dark:text-white/60">{t('kiosk.header.selectEquip')}</span>
              )}
            </div>
            <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-60" />
          </button>

          {/* 작업지시 + 작업자 */}
          <div className="flex min-w-0 flex-1 items-center gap-3">
            {/* 작업지시 */}
            <div className="flex h-11 flex-1 items-center gap-2 rounded-lg border border-border bg-card px-3 min-w-0">
              <ClipboardList className="h-4 w-4 shrink-0 text-primary" />
              {selectedJobOrder ? (
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <span className="shrink-0 font-mono text-sm font-bold text-black dark:text-white">{selectedJobOrder.orderNo}</span>
                  <span className="shrink-0 rounded bg-primary/10 px-1.5 py-0.5 text-xs text-primary">
                    {selectedJobOrder.processType}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-xs text-black/60 dark:text-white/60">{selectedJobOrder.itemName}</span>
                  <button onClick={onOpenJobOrder}
                    className="shrink-0 rounded bg-primary px-2.5 py-1 text-xs font-semibold text-white transition-colors hover:bg-primary/90">
                    {t('common.change')}
                  </button>
                </div>
              ) : (
                <button onClick={() => selectedEquip && onOpenJobOrder()} disabled={!selectedEquip}
                  title={selectedEquip ? t('kiosk.header.selectJobOrder') : t('kiosk.header.selectEquipFirst', '설비를 먼저 선택하세요.')}
                  className={`rounded bg-primary px-2.5 py-1 text-xs font-semibold text-white transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:bg-surface disabled:text-black/60 dark:text-white/60 ${selectedEquip ? 'animate-pulse' : ''}`}>
                  {t('kiosk.header.selectJobOrder')}
                </button>
              )}
            </div>

            {/* 작업자 */}
            <div className="flex h-11 shrink-0 items-center gap-1.5 overflow-hidden rounded-lg border border-border bg-card px-3">
              <UserPlus className="h-4 w-4 shrink-0 text-primary" />
              {selectedWorkers.map(w => (
                <span key={w.id} className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-300">
                  <CheckCircle className="h-3 w-3" />
                  {w.workerName}
                  <button onClick={() => onRemoveWorker(w.id)} className="ml-0.5 transition-colors hover:text-red-500">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
              <button onClick={onOpenWorker} disabled={!selectedEquip}
                title={selectedEquip ? t('kiosk.header.addWorker') : t('kiosk.header.selectEquipFirst', '설비를 먼저 선택하세요.')}
                className={`inline-flex items-center gap-1 rounded bg-primary px-2.5 py-1 text-xs font-semibold text-white transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:bg-surface disabled:text-black/60 dark:text-white/60 ${selectedEquip && selectedWorkers.length === 0 ? 'animate-pulse' : ''}`}>
                <UserPlus className="h-3 w-3" />
                {t('kiosk.header.addWorker')}
              </button>
              {selectedWorkers.length === 0 && selectedEquip && (
                <span className="flex items-center gap-1 text-xs text-orange-500">
                  <AlertTriangle className="h-3 w-3" />
                  {t('kiosk.header.workerRequired')}
                </span>
              )}
            </div>
          </div>

          {/* 설비일일점검 + 작업자설비점검 */}
          <div className="flex shrink-0 items-center gap-2">
            <HeaderCheckItem
              label={t('kiosk.header.dailyInspect')}
              done={interlock.dailyInspectDone}
              doneDetail={inspectDoneDetail(dailyInspectAt)}
              disabled={!selectedEquip}
              disabledReason={dailyInspectDisabledReason}
              onInput={onOpenDailyInspect}
            />
            <HeaderCheckItem
              label={t('kiosk.header.workerInspect')}
              done={interlock.workerInspectDone}
              doneDetail={inspectDoneDetail(workerInspectAt)}
              disabled={!interlock.dailyInspectDone || !selectedJobOrder || selectedWorkers.length === 0}
              disabledReason={workerInspectDisabledReason}
              onInput={onOpenWorkerInspect}
              wide
            />
          </div>

          {/* 전체화면 */}
          <button
            type="button"
            onClick={handleToggleWorkView}
            title={isWorkView ? t('kiosk.header.menuView', '메뉴 화면으로') : t('kiosk.header.workView', '작업 전체화면')}
            aria-label={isWorkView ? t('kiosk.header.menuView', '메뉴 화면으로') : t('kiosk.header.workView', '작업 전체화면')}
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-border bg-background text-black/60 dark:text-white/60 transition-colors hover:border-primary hover:text-primary"
          >
            {isWorkView || isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
        </div>

        {/* ── Row 2: 생산실적 (중앙, 크게) ── */}
        <div className="flex items-center justify-center gap-5 py-3">
          {selectedJobOrder ? (
            <>
              <span className="text-base font-medium text-black/60 dark:text-white/60">{t('kiosk.header.prodResult', '생산실적')}</span>
              <span className="text-5xl font-extrabold tabular-nums leading-none text-black dark:text-white">
                {completed.toLocaleString()}
              </span>
              <span className="text-xl text-black/60 dark:text-white/60">/ {planQty.toLocaleString()} EA</span>
              <span className="text-2xl font-bold text-primary">({progress}%)</span>
            </>
          ) : (
            <span className="text-sm text-black/60 dark:text-white/60">
              {t('kiosk.header.selectJobOrderHint', '작업지시를 선택하면 생산실적이 표시됩니다.')}
            </span>
          )}
        </div>
      </div>

      <EquipSelectModal
        isOpen={isEquipModalOpen}
        onClose={() => setIsEquipModalOpen(false)}
        equips={equips}
        onSelect={handleEquipSelect}
      />
    </>
  );
}
