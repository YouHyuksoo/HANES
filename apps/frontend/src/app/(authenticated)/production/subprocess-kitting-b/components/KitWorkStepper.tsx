"use client";

/**
 * @file production/subprocess-kitting-b/components/KitWorkStepper.tsx
 * @description B 배치 우측 열 — 실제 작업 순서(설비 점검 → 자재 장착 → 이전 공정 SFG → 키팅 실행·확정) 스테퍼
 *
 * 초보자 가이드:
 * - 위에서 아래로 읽는 순서가 곧 작업 순서다. 단계 번호 배지는 완료(초록)/현재 막힘(빨강)/대기(회색)
 *   세 상태만 가진다. "왜 키팅 실행이 안 눌리는지"를 이 열 한 곳에서 보게 하는 것이 목적이다.
 * - 단계 완료 판정은 컨트롤러(useSubprocessKittingController)의 interlock·canIssue 값을 그대로 쓴다.
 *   여기서 새 규칙을 만들지 않는다 — A안과 판정이 갈리면 두 시안을 비교할 수 없다.
 * - ②③단계의 실제 스캔 입력은 왼쪽 참조 영역(KitReferencePanels)에 있다. 이 열은 그 진행 상태만 보여준다.
 * - ④단계는 세로형 KitResultEntry 를 쓰고 열 하단에 고정한다(화면이 낮아도 버튼이 보인다).
 *   A안 가로 바(SubKitActionBar)는 lg:flex-row 가 뷰포트 기준이라 이 좁은 열에서 글자가 세로로 찌그러진다.
 */
import { useTranslation } from 'react-i18next';
import { CheckCircle2, ShieldCheck, UserCheck, XCircle } from 'lucide-react';
import { HeaderCheckItem } from '@/components/inspect';
import KitResultEntry from './KitResultEntry';
import type { SubprocessKittingController } from '../../subprocess-kitting/hooks/useSubprocessKittingController';

type StepState = 'done' | 'blocked' | 'idle';

function StepBadge({ n, state }: { n: number; state: StepState }) {
  const cls = state === 'done'
    ? 'bg-emerald-700 text-white'
    : state === 'blocked'
      ? 'bg-red-600 text-white'
      : 'bg-slate-300 text-slate-700 dark:bg-slate-600 dark:text-slate-100';
  return (
    <span data-testid={`subkit-b-step-${n}`} data-state={state} className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${cls}`}>
      {n}
    </span>
  );
}

function StepHeader({ n, state, title, right }: { n: number; state: StepState; title: string; right?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <StepBadge n={n} state={state} />
      <span className="text-sm font-bold text-text">{title}</span>
      {right && <span className="ml-auto text-xs font-semibold">{right}</span>}
    </div>
  );
}

export default function KitWorkStepper({ c }: { c: SubprocessKittingController }) {
  const { t } = useTranslation();
  const {
    equipCode, selectedOrder, selectedWorkers, interlock,
    dailyInspectRequired, workerInspectRequired, dailyInspectResult, workerInspectResult,
    inspectDoneDetail, inspectNgDetail,
    sgList, issuedSg, circuits, circuitNo,
    canIssue, issuing, onIssue, confirming, onConfirmScan, onResetIssued,
    resultQuality, setResultQuality,
  } = c;

  // 단계 완료 여부 — 컨트롤러 값 그대로 (A안 canIssue 가드와 같은 조건을 단계로 쪼갠 것뿐이다)
  const step1Done = (!dailyInspectRequired || interlock.dailyInspectDone) && (!workerInspectRequired || interlock.workerInspectDone);
  const step2Done = !!selectedOrder && !!equipCode;
  const step3Done = sgList.length > 0 && (circuits.length === 0 || !!circuitNo);
  const step4Done = !!issuedSg;
  const dones = [step1Done, step2Done, step3Done, step4Done];
  const firstOpen = dones.findIndex((done) => !done); // -1 = 전부 완료
  const stateOf = (i: number): StepState => (dones[i] ? 'done' : i === firstOpen ? 'blocked' : 'idle');
  const pendingSteps = dones.slice(0, 3).map((done, i) => (done ? null : i + 1)).filter((n): n is number => n !== null);

  const workerInspectDisabledReason = !workerInspectRequired
    ? t('kiosk.header.inspectNotRequired', '환경설정에서 필수 점검이 아닙니다.')
    : dailyInspectRequired && !interlock.dailyInspectDone
      ? t('kiosk.header.dailyInspectRequired', '설비 일상점검을 먼저 완료하세요.')
      : !selectedOrder
        ? t('kiosk.header.selectJobOrderFirst', '작업지시를 먼저 선택하세요.')
        : selectedWorkers.length === 0
          ? t('kiosk.header.workerRequiredForInspect', '작업자를 먼저 선택하세요.')
          : undefined;

  const stateText = (done: boolean, label: string) => (
    <span className={`inline-flex items-center gap-1 ${done ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
      {done ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
      {label} {done ? t('kiosk.header.done', '완료') : t('kiosk.header.notDone', '미완료')}
    </span>
  );

  return (
    <div data-testid="subkit-b-stepper" className="flex h-full min-h-0 flex-col overflow-hidden rounded-md border-2 border-slate-300 bg-card dark:border-slate-600">
      {/* 헤더 — 이번 키팅 한 건의 진행. 참조 상자·작업지도서 상자와 같은 어두운 제목 띠 */}
      <div className="flex h-12 shrink-0 items-center justify-between bg-slate-800 px-4 text-white dark:bg-slate-700">
        <span className="text-sm font-bold">{t('production.subprocess.stepperTitle', '키팅 작업 순서')}</span>
        {selectedOrder ? (
          <span className="flex items-baseline gap-1.5">
            <span className="text-2xl font-black leading-none tabular-nums">{sgList.length.toLocaleString()}</span>
            <span className="text-xs text-slate-300">{t('production.subprocess.scannedSg', '투입 SFG')}</span>
          </span>
        ) : (
          <span className="text-xs text-slate-300">{t('kiosk.header.selectJobOrderHint', '작업지시를 선택하면 진행 상태가 표시됩니다.')}</span>
        )}
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        {/* ① 설비 점검 */}
        <section className="flex flex-col gap-2 border-b border-border px-4 py-3">
          <StepHeader n={1} state={stateOf(0)} title={t('kiosk.stepper.step1', '설비 점검')} />
          <div className="flex gap-2 pl-10">
            <HeaderCheckItem
              label={t('kiosk.header.dailyInspect', '설비 일상점검')}
              done={!dailyInspectRequired || interlock.dailyInspectDone}
              doneDetail={inspectDoneDetail(dailyInspectResult)}
              notDoneDetail={inspectNgDetail(dailyInspectResult)}
              disabled={!dailyInspectRequired || !equipCode}
              disabledReason={!dailyInspectRequired ? t('kiosk.header.inspectNotRequired', '환경설정에서 필수 점검이 아닙니다.') : t('kiosk.header.selectEquipFirst', '설비를 먼저 선택하세요.')}
              onInput={() => c.setDailyInspectOpen(true)}
              testId="kiosk-daily-inspect-open"
              fluid
              icon={ShieldCheck}
            />
            <HeaderCheckItem
              label={t('kiosk.header.workerInspect', '작업자설비점검')}
              done={!workerInspectRequired || interlock.workerInspectDone}
              doneDetail={inspectDoneDetail(workerInspectResult)}
              notDoneDetail={inspectNgDetail(workerInspectResult)}
              disabled={!workerInspectRequired || (dailyInspectRequired && !interlock.dailyInspectDone) || !selectedOrder || selectedWorkers.length === 0}
              disabledReason={workerInspectDisabledReason}
              onInput={() => c.setWorkerInspectOpen(true)}
              testId="kiosk-worker-inspect-open"
              fluid
              icon={UserCheck}
            />
          </div>
        </section>

        {/* ② 설비 자재 장착 — 실제 스캔 입력은 왼쪽 참조 영역에 있다 */}
        <section className="flex flex-col gap-2 border-b border-border px-4 py-3">
          <StepHeader
            n={2}
            state={stateOf(1)}
            title={t('production.inputAssembly.equipMaterialMount', '설비 자재 장착')}
            right={stateText(step2Done, t('kiosk.stepper.material', '자재'))}
          />
          <p className="pl-10 text-xs text-text-muted">
            {t('production.subprocess.stepMaterialHint', '왼쪽 아래 자재 장착 패널에서 설비에 물린 자재를 스캔하세요.')}
          </p>
        </section>

        {/* ③ 이전 공정 SFG 스캔 + 회로 */}
        <section className="flex flex-col gap-2 border-b border-border px-4 py-3">
          <StepHeader
            n={3}
            state={stateOf(2)}
            title={t('production.subprocess.inputSgScan', '이전 공정 SFG 스캔')}
            right={
              <span className="flex gap-3">
                {stateText(sgList.length > 0, `SFG ${sgList.length}`)}
                {circuits.length > 0 && stateText(!!circuitNo, t('production.subprocess.circuit', '회로'))}
              </span>
            }
          />
          <p className="pl-10 text-xs text-text-muted">
            {t('production.subprocess.stepSgHint', '오른쪽 아래 스캔 패널에서 이전 공정 SFG 라벨을 담고, 회로는 위 띠에서 고르세요.')}
          </p>
        </section>
      </div>

      {/* ④ 키팅 실행 · 확정 — 스크롤 영역 밖(열 하단 고정) */}
      <section className="flex shrink-0 flex-col gap-2 border-t-2 border-slate-300 px-4 pt-3 pb-3 dark:border-slate-600">
        <StepHeader
          n={4}
          state={stateOf(3)}
          title={t('production.subprocess.issueAndConfirm', '키팅 실행 · 확정')}
          right={<span className="text-text-muted">{issuedSg ? t('production.subprocess.awaitConfirm', '실물 스캔 대기') : t('production.subprocess.awaitIssue', '발행 전')}</span>}
        />
        <div className="pl-10">
          <KitResultEntry
            canIssue={canIssue}
            issuing={issuing}
            issuedSg={issuedSg}
            onIssue={onIssue}
            confirming={confirming}
            onConfirmScan={onConfirmScan}
            onResetIssued={onResetIssued}
            resultQuality={resultQuality}
            onResultQualityChange={setResultQuality}
          />
          {!canIssue && !issuedSg && pendingSteps.length > 0 && (
            <p data-testid="subkit-b-pending-steps" className="pt-2 text-center text-xs font-semibold text-red-600 dark:text-red-400">
              {t('kiosk.stepper.activateAfter', '{{steps}}단계 완료 후 활성화됩니다', { steps: pendingSteps.join('·') })}
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
