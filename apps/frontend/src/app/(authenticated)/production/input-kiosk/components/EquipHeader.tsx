"use client";

/**
 * @file components/EquipHeader.tsx
 * @description 키오스크 상단 헤더
 *
 * - Row1: 설비 / 작업지시 / 설비일일+작업자설비점검 / 전체화면
 * - Row2: 작업자(왼쪽) / 생산실적(중앙)
 */
import { useState, useCallback, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import {
  ChevronDown, ClipboardList, Cpu,
  Maximize2, Minimize2,
  ShieldCheck, UserCheck, Pencil, Search, Sparkles,
} from 'lucide-react';
import { useKioskStore } from '@/stores/kioskStore';
import { OutputCarrierSlot, type OutputCarrierState } from '@/components/shared/carrier';
import EquipSelectModal from './EquipSelectModal';
import KioskProductivity from './KioskProductivity';
import WorkerSlot from './WorkerSlot';
import { HeaderCheckItem } from '@/components/inspect';
import type { EquipOption } from '../utils/equipOptions';
import { inspectStatusDetail, isInspectNg } from '../utils/inspectStatus';

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
  /** 설비일일점검 종합판정(PASS/FAIL). 점검 기록이 없으면 null */
  dailyInspectResult?: string | null;
  /** 작업자설비점검 종합판정(PASS/FAIL). 점검 기록이 없으면 null */
  workerInspectResult?: string | null;
  /**
   * 설비 선택 모달 열림을 부모가 제어할 때 넘긴다(준비 안내 모달이 같은 모달을 열기 위해).
   * 넘기지 않으면 헤더가 스스로 관리한다.
   */
  equipSelectOpen?: boolean;
  onEquipSelectOpenChange?: (open: boolean) => void;
  /** 준비 안내 다시 열기 */
  onOpenGuide?: () => void;
  /** 출력 대차 슬롯 상태 — 공정 CARRIER_LOAD_YN=Y일 때만 표시된다 */
  outputCarrier?: OutputCarrierState;
}

export default function EquipHeader({
  equips, onOpenJobOrder, onOpenWorker, onOpenDailyInspect, onOpenWorkerInspect,
  onSelectEquip, onRemoveWorker,
  dailyInspectAt, workerInspectAt,
  dailyInspectResult, workerInspectResult,
  equipSelectOpen, onEquipSelectOpenChange, onOpenGuide, outputCarrier,
}: EquipHeaderProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [internalEquipOpen, setInternalEquipOpen] = useState(false);
  /** controlled(부모 제어) 우선, 아니면 내부 상태 */
  const isEquipModalOpen = equipSelectOpen ?? internalEquipOpen;
  const setIsEquipModalOpen = useCallback((open: boolean) => {
    if (onEquipSelectOpenChange) onEquipSelectOpenChange(open);
    else setInternalEquipOpen(open);
  }, [onEquipSelectOpenChange]);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const {
    selectedEquip, selectedJobOrder, selectedWorkers, interlock, savedResultCount,
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

  // 진행수량은 서버 PROD_RESULTS 집계(savedResultCount)를 단일 출처로 쓴다.
  // selectedJobOrder.completedQty는 선택 시점 스냅샷이라 실적 저장 후 갱신되지 않아 0/1,000(0%)로 남던 결함(2026-09-09 15번).
  const completed = savedResultCount ?? selectedJobOrder?.completedQty ?? 0;
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

  // 점검 배지는 완료 여부만이 아니라 종합판정을 함께 보여준다 — "완료(합격) 14:32" / "완료(불합격) 14:32".
  // 판정 라벨은 공통코드 i18n comCode.INSPECT_JUDGE.* 단일 출처를 쓴다.
  // 불합격은 done=false로 넘어가므로 빨간 배지 + 입력버튼 열림(재점검 유도) 상태가 된다.
  const doneLabel = t('kiosk.header.done', '완료');
  const detailLabels = {
    done: doneLabel,
    judge: (code: string) => t(`comCode.INSPECT_JUDGE.${code}`, code),
  };
  const statusDetail = (result?: string | null, at?: string | null) =>
    inspectStatusDetail(result, at, detailLabels);
  // 판정이 없으면(점검 기록 없음) 기존 "완료 HH:mm" 폴백을 유지한다.
  const inspectDoneDetail = (at?: string | null, result?: string | null) => {
    const withJudge = statusDetail(result, at);
    if (withJudge) return withJudge;
    if (!at) return undefined;
    const hhmm = (at.split(' ')[1] ?? at).slice(0, 5);
    return `${doneLabel} ${hhmm}`;
  };
  const ngDetail = (result?: string | null, at?: string | null) =>
    isInspectNg(result) ? statusDetail(result, at) : undefined;

  return (
    <>
      <div className="flex-shrink-0 border-b border-border bg-card">
        {/* ── Row 1: 설비 / 작업지시 / 점검 / 전체화면 ── */}
        <div className="flex h-14 items-center gap-3 border-b border-border/50 bg-surface/50 px-4">

          {/* 설비 선택 */}
          <button
            data-testid="kiosk-equip-open"
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

          {/* 작업지시 */}
          <div className="flex min-w-0 flex-1 items-center gap-3">
            {/* 작업지시 */}
            {/* min-w: 작업자 배지가 늘어나면 이 칸이 0까지 눌려 "작업지시를 선택하세요"가
                세로 한 글자씩 쌓이던 결함이 있었다. 최소 폭을 줘서 항상 가로로 읽히게 한다. */}
            <div className="flex h-11 min-w-[9rem] 2xl:min-w-[15rem] flex-1 items-center gap-2 overflow-hidden rounded-lg border border-border bg-card px-3">
              <ClipboardList className="h-4 w-4 shrink-0 text-primary" />
              {selectedJobOrder ? (
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <span className="shrink-0 font-mono text-sm font-bold text-black dark:text-white">{selectedJobOrder.orderNo}</span>
                  <span className="hidden shrink-0 rounded bg-primary/10 px-1.5 py-0.5 text-xs text-primary 2xl:inline">
                    {selectedJobOrder.processType}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-xs text-black/60 dark:text-white/60">{selectedJobOrder.itemName}</span>
                  <button data-testid="kiosk-joborder-open" onClick={onOpenJobOrder}
                    title={t('common.change')}
                    aria-label={t('common.change')}
                    className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded bg-primary text-xs font-semibold text-white transition-colors hover:bg-primary/90 2xl:h-auto 2xl:w-auto 2xl:px-2.5 2xl:py-1">
                    <Pencil className="h-3.5 w-3.5 shrink-0 2xl:hidden" />
                    <span className="hidden 2xl:inline">{t('common.change')}</span>
                  </button>
                </div>
              ) : (
                <button data-testid="kiosk-joborder-open" onClick={() => selectedEquip && onOpenJobOrder()} disabled={!selectedEquip}
                  title={selectedEquip ? t('kiosk.header.selectJobOrder') : t('kiosk.header.selectEquipFirst', '설비를 먼저 선택하세요.')}
                  aria-label={t('kiosk.header.selectJobOrder')}
                  className={`inline-flex h-7 w-7 shrink-0 items-center justify-center whitespace-nowrap rounded bg-primary text-xs font-semibold text-white transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:bg-surface disabled:text-black/60 dark:text-white/60 2xl:h-auto 2xl:w-auto 2xl:px-2.5 2xl:py-1 ${selectedEquip ? 'animate-pulse' : ''}`}>
                  <Search className="h-3.5 w-3.5 shrink-0 2xl:hidden" />
                  <span className="hidden 2xl:inline">{t('kiosk.header.selectJobOrder')}</span>
                </button>
              )}
            </div>

          </div>

          {/* 설비일일점검 + 작업자설비점검 */}
          <div className="flex shrink-0 items-center gap-2">
            <HeaderCheckItem
              label={t('kiosk.header.dailyInspect')}
              done={interlock.dailyInspectDone}
              doneDetail={inspectDoneDetail(dailyInspectAt, dailyInspectResult)}
              notDoneDetail={ngDetail(dailyInspectResult, dailyInspectAt)}
              disabled={!selectedEquip}
              disabledReason={dailyInspectDisabledReason}
              onInput={onOpenDailyInspect}
              testId="kiosk-daily-inspect-open"
              wide
              responsiveCompact
              icon={ShieldCheck}
            />
            <HeaderCheckItem
              label={t('kiosk.header.workerInspect')}
              done={interlock.workerInspectDone}
              doneDetail={inspectDoneDetail(workerInspectAt, workerInspectResult)}
              notDoneDetail={ngDetail(workerInspectResult, workerInspectAt)}
              disabled={!interlock.dailyInspectDone || !selectedJobOrder || selectedWorkers.length === 0}
              disabledReason={workerInspectDisabledReason}
              onInput={onOpenWorkerInspect}
              testId="kiosk-worker-inspect-open"
              wide
              responsiveCompact
              icon={UserCheck}
            />
          </div>

          {outputCarrier && <OutputCarrierSlot state={outputCarrier} compact />}

          {/* 준비 안내 다시 열기 — Row1 축약 규칙: 2xl 미만은 아이콘만, 2xl 이상은 라벨까지 */}
          {onOpenGuide && (
            <button
              type="button"
              data-testid="kiosk-guide-open"
              onClick={onOpenGuide}
              title={t('prepGuide.reopen', '준비 안내')}
              aria-label={t('prepGuide.reopen', '준비 안내')}
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-border bg-background text-primary transition-colors hover:border-primary 2xl:w-auto 2xl:px-3"
            >
              <Sparkles className="h-4 w-4 shrink-0" />
              <span className="hidden whitespace-nowrap text-sm font-bold 2xl:inline">{t('prepGuide.reopen', '준비 안내')}</span>
            </button>
          )}

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

        {/* 작업지시 시작/종료 안내 — h-11 칸 레이아웃을 건드리지 않도록 Row1 바깥 아래 한 줄로 둔다 */}
        <div className="flex items-center gap-1 px-4 py-0.5 text-[11px] text-black/50 dark:text-white/50 bg-surface/50">
          <ClipboardList className="h-3 w-3 shrink-0 opacity-60" />
          <span className="truncate">
            {t('kiosk.header.orderLifecycleHint', '최초 실적입력 시 작업지시 자동 시작 · 양품이 계획수량에 도달하면 자동 종료 (조기 종료는 작업지시관리에서)')}
          </span>
        </div>

        {/* ── Row 2: 생산실적 (중앙, 크게) — 헤더 1행과 톤을 달리해 숫자 영역이 도드라지게 ── */}
        <div data-testid="kiosk-result-row" className="grid grid-cols-[320px_minmax(0,1fr)_320px] items-center py-3 bg-surface border-t border-border/60">
          <div className="min-w-0 px-4">
            {/* 작업자: 생산실적 왼쪽에 배치 — 3화면 공용 WorkerSlot */}
            <WorkerSlot workers={selectedWorkers} hasEquip={Boolean(selectedEquip)} onOpenWorker={onOpenWorker} onRemoveWorker={onRemoveWorker} />
          </div>
          <div className="flex min-w-0 flex-wrap items-center justify-center gap-3 px-3 xl:gap-5">
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
          <KioskProductivity orderNo={selectedJobOrder?.orderNo} workers={selectedWorkers.length} refreshKey={savedResultCount} />
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
