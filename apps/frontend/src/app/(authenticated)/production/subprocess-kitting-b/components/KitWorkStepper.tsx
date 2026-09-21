"use client";

/**
 * @file production/subprocess-kitting-b/components/KitWorkStepper.tsx
 * @description B 배치 우측 열 — 작업 순서 스테퍼 5단계
 *   ① 작업자 ② 설비 점검 ③ 설비 자재 장착 ④ 이전 공정 SFG 스캔 ⑤ 키팅 실행·확정
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
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, Scan, ShieldCheck, UserCheck, XCircle } from 'lucide-react';
import { HeaderCheckItem } from '@/components/inspect';
import WorkerSlot from '../../input-kiosk/components/WorkerSlot';
import KitResultEntry from './KitResultEntry';
import KitMaterialMountModal from './KitMaterialMountModal';
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
    equipCode, selectedOrder, selectedWorkers, removeWorker, interlock,
    dailyInspectRequired, workerInspectRequired, dailyInspectResult, workerInspectResult,
    inspectDoneDetail, inspectNgDetail,
    sgList, issuedSg, circuits, circuitNo,
    canIssue, issuing, onIssue, confirming, onConfirmScan, onResetIssued,
    resultQuality, setResultQuality,
  } = c;

  const [materialMountOpen, setMaterialMountOpen] = useState(false);

  // 단계 완료 여부 — 컨트롤러 값 그대로. 여기서 새 규칙을 만들지 않는다.
  // 작업자(①)와 설비점검(②)은 성격이 다르므로 단계를 나눈다(2026-09-21 지시).
  const doneWorker = selectedWorkers.length > 0;
  const doneInspect = (!dailyInspectRequired || interlock.dailyInspectDone) && (!workerInspectRequired || interlock.workerInspectDone);
  const doneSg = sgList.length > 0 && (circuits.length === 0 || !!circuitNo);
  const doneIssue = !!issuedSg;

  // ③ 자재 장착은 완료 신호가 없다 — EquipMaterialMountPanel 이 장착 완료를 컨트롤러에 알려주지 않고,
  //    canIssue 게이트에도 들어가지 않는다. 그래서 "완료"를 주장하지 않고 진행 체인에서도 뺀다.
  //    (가공은 interlock.materialScanDone 이 있어 완료 표시가 가능하다. 키팅에 같은 인터록을 만들려면 별도 작업.)
  const gateDones = [doneWorker, doneInspect, doneSg, doneIssue];
  const gateStepNo = [1, 2, 4, 5];
  const firstOpenGate = gateDones.findIndex((done) => !done); // -1 = 전부 완료
  const stateOfGate = (i: number): StepState => (gateDones[i] ? 'done' : i === firstOpenGate ? 'blocked' : 'idle');
  const pendingSteps = gateDones.slice(0, 3)
    .map((done, i) => (done ? null : gateStepNo[i]))
    .filter((n): n is number => n !== null);

  const workerInspectDisabledReason = !workerInspectRequired
    ? t('kiosk.header.inspectNotRequired', '환경설정에서 필수 점검이 아닙니다.')
    : dailyInspectRequired && !interlock.dailyInspectDone
      ? t('kiosk.header.dailyInspectRequired', '설비 일상점검을 먼저 완료하세요.')
      : !selectedOrder
        ? t('kiosk.header.selectJobOrderFirst', '작업지시를 먼저 선택하세요.')
        : selectedWorkers.length === 0
          ? t('kiosk.header.workerRequiredForInspect', '작업자를 먼저 선택하세요.')
          : undefined;

  // 스캔 버튼 — 가공 B안 ②단계와 같은 규칙(높이·테두리·굵기)
  const scanBtn = 'inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded border px-3 text-xs font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-40';

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
        {/* ① 작업자 */}
        <section className="flex flex-col gap-2 border-b border-border px-4 py-3">
          <StepHeader
            n={1}
            state={stateOfGate(0)}
            title={t('kiosk.stepper.worker', '작업자')}
            right={stateText(doneWorker, t('kiosk.stepper.worker', '작업자'))}
          />
          {/* 실적입력 3화면 공용 WorkerSlot */}
          <div className="pl-10">
            <WorkerSlot
              workers={selectedWorkers}
              hasEquip={!!equipCode}
              onOpenWorker={() => c.setWorkerModalOpen(true)}
              onRemoveWorker={(id) => void removeWorker(id)}
            />
          </div>
        </section>

        {/* ② 설비 점검 */}
        <section className="flex flex-col gap-2 border-b border-border px-4 py-3">
          <StepHeader n={2} state={stateOfGate(1)} title={t('kiosk.stepper.step1', '설비 점검')} />
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

        {/* ③ 설비 자재 장착 — 가공 ②단계와 같은 버튼→모달 방식 */}
        <section className="flex flex-col gap-2 border-b border-border px-4 py-3">
          <StepHeader
            n={3}
            state="idle"
            title={t('production.inputAssembly.equipMaterialMount', '설비 자재 장착')}
          />
          <div className="flex gap-2 pl-10">
            <button
              type="button"
              data-testid="subkit-material-scan-open"
              onClick={() => setMaterialMountOpen(true)}
              disabled={!equipCode}
              title={equipCode
                ? t('production.equipMaterial.mountTitle', '설비 자재 장착 (지속)')
                : t('kiosk.header.selectEquipFirst', '설비를 먼저 선택하세요.')}
              className={`${scanBtn} border-slate-900 bg-slate-900 text-white hover:bg-slate-800 dark:border-white dark:bg-white dark:text-slate-900`}
            >
              <Scan className="h-3.5 w-3.5" />
              {t('production.subprocess.materialScan', '자재 스캔')}
            </button>
          </div>
        </section>

        {/* ④ 이전 공정 SFG 스캔 + 회로 */}
        <section className="flex flex-col gap-2 border-b border-border px-4 py-3">
          <StepHeader
            n={4}
            state={stateOfGate(2)}
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

      {/* ⑤ 키팅 실행 · 확정 — 스크롤 영역 밖(열 하단 고정) */}
      <section className="flex shrink-0 flex-col gap-2 border-t-2 border-slate-300 px-4 pt-3 pb-3 dark:border-slate-600">
        <StepHeader
          n={5}
          state={stateOfGate(3)}
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

      <KitMaterialMountModal
        isOpen={materialMountOpen}
        onClose={() => setMaterialMountOpen(false)}
        equipCode={equipCode}
        orderNo={selectedOrder?.orderNo}
        itemCode={selectedOrder?.itemCode}
      />
    </div>
  );
}
