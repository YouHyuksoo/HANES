"use client";

/**
 * @file production/input-kiosk-b/components/KioskWorkStepper.tsx
 * @description B 배치 우측 열 — 작업 순서 스테퍼 5단계
 *   ① 작업자 ② 설비 점검 ③ 자재 로트 등록 ④ 공정샘플검사 ⑤ 실적입력
 * - ①~④ 는 스크롤 영역이지만 기본 상태에서 스크롤이 생기지 않도록 세로 여백을 잡았다(2026-09-21 지시).
 *   단계를 늘리거나 패널 높이를 키울 때는 실측으로 넘침이 없는지 다시 확인한다.
 *
 * 초보자 가이드:
 * - 위에서 아래로 읽는 순서가 곧 작업 순서다. 각 단계 번호 배지는 완료(초록)/현재 막힘(빨강)/대기(회색)
 *   세 상태만 가진다. "왜 실적입력이 안 되는지"를 이 열 한 곳에서 보게 하는 것이 목적이다.
 * - 단계 완료 판정은 컨트롤러(useInputKioskController)의 interlock·게이트 값을 그대로 쓴다. 여기서
 *   새 규칙을 만들지 않는다.
 * - 3단계 본문은 기존 SelfInspectPanel 을 재사용하고, 4단계는 세로형 KioskResultEntry(저장 로직은 공용 훅)를 쓴다.
 * - 강조색(primary)은 실적입력 버튼(ProductionInputBar 내부) 한 곳에만 남는다.
 */
import { useTranslation } from 'react-i18next';
import { ShieldCheck, UserCheck, Scan, CheckCircle2, XCircle } from 'lucide-react';
import { HeaderCheckItem } from '@/components/inspect';
import WorkerSlot from '../../input-kiosk/components/WorkerSlot';
import SelfInspectPanel from '../../input-kiosk/components/SelfInspectPanel';
import KioskResultEntry from './KioskResultEntry';
import { inspectStatusDetail, isInspectNg } from '../../input-kiosk/utils/inspectStatus';
import type { InputKioskController } from '../../input-kiosk/hooks/useInputKioskController';

type StepState = 'done' | 'blocked' | 'idle';

function StepBadge({ n, state }: { n: number; state: StepState }) {
  const cls = state === 'done'
    ? 'bg-emerald-700 text-white'
    : state === 'blocked'
      ? 'bg-red-600 text-white'
      : 'bg-slate-300 text-slate-700 dark:bg-slate-600 dark:text-slate-100';
  return (
    <span data-testid={`kiosk-b-step-${n}`} data-state={state} className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${cls}`}>
      {n}
    </span>
  );
}

function StepHeader({ n, state, title, right }: { n: number; state: StepState; title: string; right?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2.5">
      <StepBadge n={n} state={state} />
      <span className="text-sm font-bold text-text">{title}</span>
      {right && <span className="ml-auto text-xs font-semibold">{right}</span>}
    </div>
  );
}

export default function KioskWorkStepper({ c }: { c: InputKioskController }) {
  const { t } = useTranslation();
  const {
    selectedEquip, selectedJobOrder, selectedWorkers, interlock, savedResultCount,
    dailyInspectAt, workerInspectAt, dailyInspectResult, workerInspectResult,
    firstInspectDone, lastInspectDone, midNotifyPct, midBlockPct, isMidBlock, midInspectDone,
    allInterlockDone, hasPendingDelegate, canSubmit, submitDisabledReasons, productionType, outputCarrier,
  } = c;

  const planQty = selectedJobOrder?.planQty ?? 0;
  const progress = planQty ? Math.min(Math.round((savedResultCount / planQty) * 100), 100) : 0;

  // 단계 완료 여부 — 컨트롤러 값 그대로.
  // 작업자(①)와 설비점검(②)은 성격이 다르므로 단계를 나눈다(2026-09-21 지시, 서브공정 B안과 같은 구조).
  const doneWorker = selectedWorkers.length > 0;
  const step1Done = interlock.dailyInspectDone && interlock.workerInspectDone;
  const step2Done = interlock.materialScanDone && interlock.consumableScanDone;
  const step3Done = firstInspectDone && !isMidBlock && !hasPendingDelegate;
  const step4Done = canSubmit;
  const dones = [doneWorker, step1Done, step2Done, step3Done, step4Done];
  const firstOpen = dones.findIndex(d => !d); // -1 = 전부 완료
  const stateOf = (i: number): StepState => dones[i] ? 'done' : (i === firstOpen ? 'blocked' : 'idle');
  const pendingSteps = dones.slice(0, 4).map((d, i) => (d ? null : i + 1)).filter((n): n is number => n !== null);

  // 점검 배지 문구 — EquipHeader 와 같은 규칙(완료(합격) HH:mm / 불합격은 미완료 + 사유)
  const doneLabel = t('kiosk.header.done', '완료');
  const detailLabels = { done: doneLabel, judge: (code: string) => t(`comCode.INSPECT_JUDGE.${code}`, code) };
  const inspectDoneDetail = (at?: string | null, result?: string | null) => {
    const withJudge = inspectStatusDetail(result, at, detailLabels);
    if (withJudge) return withJudge;
    if (!at) return undefined;
    const hhmm = (at.split(' ')[1] ?? at).slice(0, 5);
    return `${doneLabel} ${hhmm}`;
  };
  const ngDetail = (result?: string | null, at?: string | null) =>
    isInspectNg(result) ? inspectStatusDetail(result, at, detailLabels) : undefined;

  const workerInspectDisabledReason = [
    !interlock.dailyInspectDone ? t('kiosk.header.dailyInspectRequired', '설비일일점검을 먼저 완료하세요.') : '',
    !selectedJobOrder ? t('kiosk.header.selectJobOrderFirst', '작업지시를 먼저 선택하세요.') : '',
    selectedWorkers.length === 0 ? t('kiosk.header.workerRequiredForInspect', '작업자를 1명 이상 추가하세요.') : '',
  ].filter(Boolean).join(' ') || undefined;

  const scanBtn = 'inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded border px-3 text-xs font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-40';
  const stateText = (done: boolean, label: string) => (
    <span className={`inline-flex items-center gap-1 ${done ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
      {done ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
      {label} {done ? t('kiosk.header.done', '완료') : t('kiosk.header.notDone', '미완료')}
    </span>
  );

  return (
    <div data-testid="kiosk-b-stepper" className="flex h-full min-h-0 flex-col overflow-hidden rounded-md border-2 border-slate-300 bg-card dark:border-slate-600">
      {/* 헤더 — 오늘의 작업 + 진행. 참조 상자·작업지도서 상자와 같은 어두운 제목 띠 */}
      <div className="flex h-12 shrink-0 items-center justify-between bg-slate-800 px-4 text-white dark:bg-slate-700">
        <span className="text-sm font-bold">{t('kiosk.stepper.title', '작업 순서')}</span>
        {selectedJobOrder ? (
          <span className="flex items-baseline gap-1.5">
            <span className="text-2xl font-black leading-none tabular-nums">{savedResultCount.toLocaleString()}</span>
            <span className="text-xs text-slate-300">/ {planQty.toLocaleString()} EA · {progress}%</span>
          </span>
        ) : (
          <span className="text-xs text-slate-300">{t('kiosk.header.selectJobOrderHint', '작업지시를 선택하면 생산실적이 표시됩니다.')}</span>
        )}
      </div>
      <div className="h-1 shrink-0 bg-border" aria-hidden="true">
        <div className="h-full bg-emerald-600 transition-[width]" style={{ width: `${progress}%` }} />
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {/* ① 작업자 */}
        <section className="flex shrink-0 flex-col gap-1.5 border-b border-border px-4 py-1.5">
          <StepHeader n={1} state={stateOf(0)} title={t('kiosk.stepper.worker', '작업자')} />
          {/* 실적입력 3화면 공용 WorkerSlot */}
          <div className="pl-8">
            <WorkerSlot
              workers={selectedWorkers}
              hasEquip={!!selectedEquip}
              onOpenWorker={() => c.setIsWorkerOpen(true)}
              onRemoveWorker={c.handleRemoveWorker}
            />
          </div>
        </section>

        {/* ② 설비 점검 */}
        <section className="flex shrink-0 flex-col gap-1.5 border-b border-border px-4 py-1.5">
          <StepHeader n={2} state={stateOf(1)} title={t('kiosk.stepper.step1', '설비 점검')} />
          {/* 두 점검 카드를 한 줄에 — fluid 로 남는 폭을 반씩 나눠 라벨이 접히지 않게 한다 */}
          <div className="flex gap-2 pl-8">
            <HeaderCheckItem
              label={t('kiosk.header.dailyInspect')}
              done={interlock.dailyInspectDone}
              doneDetail={inspectDoneDetail(dailyInspectAt, dailyInspectResult)}
              notDoneDetail={ngDetail(dailyInspectResult, dailyInspectAt)}
              disabled={!selectedEquip}
              disabledReason={!selectedEquip ? t('kiosk.header.selectEquipFirst', '설비를 먼저 선택하세요.') : undefined}
              onInput={() => c.setIsDailyInspectOpen(true)}
              testId="kiosk-daily-inspect-open"
              fluid
              icon={ShieldCheck}
            />
            <HeaderCheckItem
              label={t('kiosk.header.workerInspect')}
              done={interlock.workerInspectDone}
              doneDetail={inspectDoneDetail(workerInspectAt, workerInspectResult)}
              notDoneDetail={ngDetail(workerInspectResult, workerInspectAt)}
              disabled={!interlock.dailyInspectDone || !selectedJobOrder || selectedWorkers.length === 0}
              disabledReason={workerInspectDisabledReason}
              onInput={() => c.setIsWorkerInspectOpen(true)}
              testId="kiosk-worker-inspect-open"
              fluid
              icon={UserCheck}
            />
          </div>
        </section>

        {/* ③ 자재 로트 등록 */}
        <section className="flex shrink-0 flex-col gap-1.5 border-b border-border px-4 py-1.5">
          <StepHeader
            n={3}
            state={stateOf(2)}
            title={t('kiosk.stepper.step2', '자재 로트 등록')}
            right={<span className="flex gap-3">{stateText(interlock.materialScanDone, t('kiosk.stepper.material', '자재'))}{stateText(interlock.consumableScanDone, t('kiosk.stepper.consumable', '소모품'))}</span>}
          />
          <div className="flex gap-2 pl-8">
            <button
              type="button"
              data-testid="kiosk-material-scan-open"
              onClick={() => c.setIsMaterialScanOpen(true)}
              disabled={!selectedJobOrder}
              title={selectedJobOrder ? t('kiosk.prep.materialScan') : c.materialScanDisabledReasons.join(' / ')}
              className={`${scanBtn} ${interlock.materialScanDone ? 'border-emerald-600 text-emerald-700 dark:text-emerald-400' : 'border-slate-900 bg-slate-900 text-white hover:bg-slate-800 dark:border-white dark:bg-white dark:text-slate-900'} ${!interlock.materialScanDone && selectedJobOrder ? 'animate-pulse' : ''}`}
            >
              <Scan className="h-3.5 w-3.5" />{t('kiosk.prep.materialScan')}
            </button>
            <button
              type="button"
              data-testid="kiosk-consumable-scan-open"
              onClick={() => c.setIsConsumableScanOpen(true)}
              disabled={!selectedEquip}
              title={selectedEquip ? t('kiosk.prep.consumableScan') : c.consumableScanDisabledReasons.join(' / ')}
              className={`${scanBtn} ${interlock.consumableScanDone ? 'border-emerald-600 text-emerald-700 dark:text-emerald-400' : 'border-border text-text hover:border-slate-900'}`}
            >
              <Scan className="h-3.5 w-3.5" />{t('kiosk.prep.consumableScan')}
            </button>
          </div>
        </section>

        {/* ④ 공정샘플검사 — 제목은 단계 헤더가, 중물 안내는 헤더 오른쪽이 맡는다(패널 제목·안내 줄 숨김) */}
        <section className="flex min-h-0 flex-1 flex-col gap-1 px-4 pt-1.5 pb-1">
          <StepHeader
            n={4}
            state={stateOf(3)}
            title={t('kiosk.selfInspect.title')}
            right={<span className={midInspectDone ? 'text-text-muted' : 'text-red-600 dark:text-red-400'}>
              {t('kiosk.selfInspect.midRequiredNotice', { defaultValue: '실적 {{pct}}% 초과 시 중물검사 입력 필수', pct: midBlockPct })}
            </span>}
          />
          <div className="min-h-0 flex-1 pl-8">
            <SelfInspectPanel
              hideHeader
              onOpenSelfInspect={c.setSelfInspectTiming}
              firstInspectDone={firstInspectDone}
              lastInspectDone={lastInspectDone}
              midNotifyPct={midNotifyPct}
              midBlockPct={midBlockPct}
            />
          </div>
        </section>

      </div>

      {/* ⑤ 실적입력 — 스크롤 영역 밖(열 하단 고정). 화면이 낮아도 저장 버튼은 스크롤 없이 보인다 */}
      <section className="flex shrink-0 flex-col gap-1 border-t-2 border-slate-300 px-4 pt-2 pb-2 dark:border-slate-600">
          <StepHeader
            n={5}
            state={stateOf(4)}
            title={t('kiosk.input.submit')}
            right={<span className="text-text-muted">{productionType === 'MASS' ? t('kiosk.stepper.mass', '양산') : t('kiosk.stepper.trial', '시생산')}</span>}
          />
          <div className="flex flex-col pl-8">
            <KioskResultEntry
              onSaved={c.handleSaved}
              onResultSaved={c.handleResultSaved}
              interlockDone={canSubmit}
              disabledReasons={submitDisabledReasons}
              outputCarrierNo={outputCarrier.carrier?.carrierNo ?? null}
              onCapacityRejected={outputCarrier.onCapacityRejected}
              onOpenDefect={c.handleOpenDefect}
              defectDisabled={!allInterlockDone || hasPendingDelegate}
            />
            {!canSubmit && pendingSteps.length > 0 && (
              <p data-testid="kiosk-b-pending-steps" className="pt-2 text-center text-xs font-semibold text-red-600 dark:text-red-400">
                {t('kiosk.stepper.activateAfter', '{{steps}}단계 완료 후 활성화됩니다', { steps: pendingSteps.join('·') })}
              </p>
            )}
          </div>
        </section>
    </div>
  );
}
