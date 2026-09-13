"use client";

/**
 * @file scenario-driver/ScenarioRunOverlay.tsx
 * @description 시나리오 실행 UI — 계획 확인 / 진행 표시 / 쓰기 확인 / 실패 안내 + 클릭 차단
 *
 * 차단이 필요한 이유:
 * 드라이버가 클릭하려는 순간 사용자가 다른 걸 누르면 화면 상태가 어긋난다.
 * 실행 중에는 화면 전체를 덮고 "중단" 버튼만 살린다.
 *
 * 실패는 되돌리지 않는다. 어디서 왜 멈췄는지 보여주고 사용자가 이어받게 한다.
 */
import { useScenarioRunStore, isBusy } from './store';
import { describeStep } from './ScenarioDriverHost';

const VERDICT_MARK: Record<string, string> = {
  PASS: '완료',
  ALREADY_DONE: '이미 처리됨',
  FAIL: '실패',
  RUNNING: '진행 중',
  PENDING: '대기',
};

export default function ScenarioRunOverlay() {
  const { status, scenario, vars, stepIndex, results, failure, pendingWriteNote, approve, approveWrite, cancel, reset } =
    useScenarioRunStore();

  if (status === 'idle' || !scenario) return null;

  const steps = scenario.steps;
  const writeCount = steps.filter((s) => s.write).length;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/45 p-4"
      // 실행 중에는 사용자의 클릭이 화면에 닿지 않게 막는다
      onClickCapture={(e) => { if (isBusy(status)) e.stopPropagation(); }}
      role="dialog"
      aria-modal="true"
      aria-label="시나리오 실행"
    >
      <div className="w-full max-w-lg rounded-lg border border-border bg-card shadow-xl">
        <div className="border-b border-border px-5 py-3">
          <div className="text-sm font-bold text-text">{scenario.title}</div>
          <div className="mt-0.5 text-xs text-text-muted">{scenario.description}</div>
        </div>

        <div className="max-h-[50vh] overflow-y-auto px-5 py-3">
          {/* 실행 계획 — 승인 전에는 무엇을 할지 전부 보여준다 */}
          {status === 'confirming' && (
            <>
              {Object.keys(vars).length > 0 && (
                <div className="mb-3 rounded border border-border bg-surface px-3 py-2 text-xs">
                  {Object.entries(vars).map(([k, v]) => (
                    <div key={k} className="flex gap-2">
                      <span className="text-text-muted">{scenario.params?.[k]?.label ?? k}</span>
                      <span className="font-semibold text-text">{v}</span>
                    </div>
                  ))}
                </div>
              )}
              <ol className="space-y-1 text-xs text-text">
                {steps.map((step, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="w-4 shrink-0 text-right text-text-muted">{i + 1}</span>
                    <span className={step.write ? 'font-semibold text-red-600 dark:text-red-400' : ''}>
                      {describeStep(step, vars)}
                      {step.write && ' — 실제 저장'}
                    </span>
                  </li>
                ))}
              </ol>
              {writeCount > 0 && (
                <p className="mt-3 text-xs text-red-600 dark:text-red-400">
                  실제 데이터를 바꾸는 단계가 {writeCount}개 있습니다. 각 단계 직전에 다시 확인합니다.
                </p>
              )}
            </>
          )}

          {/* 진행 상황 */}
          {status !== 'confirming' && (
            <ol className="space-y-1 text-xs">
              {steps.map((step, i) => {
                const r = results.find((x) => x.index === i);
                const current = i === stepIndex && isBusy(status);
                const mark = r ? VERDICT_MARK[r.verdict] : current ? VERDICT_MARK.RUNNING : VERDICT_MARK.PENDING;
                const tone =
                  r?.verdict === 'FAIL' ? 'text-red-600 dark:text-red-400 font-semibold'
                  : r?.verdict === 'ALREADY_DONE' ? 'text-sky-700 dark:text-sky-300'
                  : r ? 'text-green-700 dark:text-green-400'
                  : current ? 'text-text font-semibold'
                  : 'text-text-muted';
                return (
                  <li key={i} className={`flex gap-2 ${tone}`}>
                    <span className="w-4 shrink-0 text-right">{i + 1}</span>
                    <span className="flex-1">{describeStep(step, vars)}</span>
                    <span className="shrink-0 text-[11px]">{mark}</span>
                  </li>
                );
              })}
            </ol>
          )}

          {status === 'awaitWrite' && pendingWriteNote && (
            <div className="mt-3 rounded border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-700 dark:bg-red-950/40 dark:text-red-300">
              다음 단계는 실제 데이터를 저장합니다.<br />
              <span className="font-semibold">{pendingWriteNote}</span>
            </div>
          )}

          {status === 'failed' && failure && (
            <div className="mt-3 rounded border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-700 dark:bg-red-950/40 dark:text-red-300">
              <div className="font-semibold">{failure.stepIndex + 1}번째 단계에서 멈췄습니다.</div>
              <div className="mt-1">{failure.reason}</div>
              <div className="mt-2 text-[11px] opacity-80">
                이전 단계에서 저장된 내용은 되돌리지 않았습니다. 원인을 해소한 뒤 다시 요청하세요.
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-border px-5 py-3">
          {status === 'confirming' && (
            <>
              <button onClick={() => reset()} className="rounded border border-border px-3 py-1.5 text-xs text-text">
                취소
              </button>
              <button onClick={approve} className="rounded bg-primary px-3 py-1.5 text-xs font-semibold text-white">
                실행
              </button>
            </>
          )}
          {status === 'running' && (
            <button onClick={() => cancel()} className="rounded border border-border px-3 py-1.5 text-xs text-text">
              중단
            </button>
          )}
          {status === 'awaitWrite' && (
            <>
              <button onClick={() => cancel()} className="rounded border border-border px-3 py-1.5 text-xs text-text">
                중단
              </button>
              <button onClick={approveWrite} className="rounded bg-red-600 px-3 py-1.5 text-xs font-semibold text-white">
                저장 진행
              </button>
            </>
          )}
          {(status === 'done' || status === 'failed') && (
            <button onClick={() => reset()} className="rounded bg-primary px-3 py-1.5 text-xs font-semibold text-white">
              닫기
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
