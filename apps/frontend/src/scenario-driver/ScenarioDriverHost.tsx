"use client";

/**
 * @file scenario-driver/ScenarioDriverHost.tsx
 * @description 시나리오 실행기 — 전역에 단 하나만 마운트한다
 *
 * 왜 전역인가:
 * 시나리오는 router.push 로 화면을 넘나든다. 이 컴포넌트를 화면 안에 두면
 * 이동하는 순간 **실행 주체가 자기 자신을 언마운트한다**. 그래서 providers.tsx 레벨에 둔다.
 *
 * 무엇을 하지 않는가:
 *   - API 직접 호출. 화면 버튼만 누른다. 그래야 인터셉터·권한·검증·토스트·활동로그가
 *     평소와 똑같이 타고, 화면의 에러가 그대로 진실이 된다.
 *   - 판단. 어떤 시나리오를 어떤 값으로 돌릴지는 AI 가 이미 정해서 넘긴다.
 *   - 되돌림·재개. 실패하면 그 자리에서 멈추고 원인을 남긴다.
 */
import { useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { setActivityActorKind } from '@/services/activity-reporter';
import { captureText, clickTarget, fillTarget, scanTarget, waitFor, describeTarget } from './dom';
import { clearEvents, judgeStep } from './judge';
import { useScenarioRunStore } from './store';
import type { Scenario, ScenarioStep, TargetSpec } from './types';

/**
 * 화면 이동 한도. App Router 는 라우트가 준비돼야 URL 을 바꾸고,
 * 개발 서버는 첫 방문 시 그 화면을 컴파일하느라 오래 걸린다.
 */
const GOTO_TIMEOUT_MS = 60_000;

/** {{param}} 치환 */
function render(value: string | undefined, vars: Record<string, string>): string {
  if (!value) return '';
  return value.replace(/\{\{\s*([^{}]+?)\s*\}\}/g, (whole, key: string) =>
    key in vars ? vars[key] : whole,
  );
}

/**
 * target 안의 {{변수}}도 치환한다.
 * row/text/label 처럼 "어느 행/어느 요소"를 값으로 지정하는 키가 있어서,
 * value 만 치환하면 화면에서 "{{itemCode}}" 라는 문자열을 찾다가 실패한다.
 */
function renderTarget(target: TargetSpec | undefined, vars: Record<string, string>): TargetSpec | undefined {
  if (!target) return undefined;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(target)) {
    out[k] = typeof v === 'string' ? render(v, vars) : v;
  }
  return out as TargetSpec;
}

/** 사람이 읽는 스텝 설명 — note 가 없으면 액션에서 만들어 준다 */
export function describeStep(step: ScenarioStep, vars: Record<string, string> = {}): string {
  if (step.note) return render(step.note, vars);
  const t = step.target ? describeTarget(renderTarget(step.target, vars)!) : '';
  switch (step.action) {
    case 'goto': return `${render(step.value, vars)} 화면으로 이동`;
    case 'click': return `${t} 누르기`;
    case 'fill': return `${t}에 "${render(step.value, vars)}" 입력`;
    case 'scan': return `${t}에 "${render(step.value, vars)}" 스캔`;
    case 'waitForText': return `"${render(step.value, vars)}" 나타날 때까지 대기`;
    case 'capture': return `${t} 값 읽기`;
    case 'waitMs': return `${step.value}ms 대기`;
    default: return step.action;
  }
}

export default function ScenarioDriverHost() {
  const router = useRouter();
  const status = useScenarioRunStore((s) => s.status);
  const scenario = useScenarioRunStore((s) => s.scenario);
  /** 실행 루프가 이미 돌고 있는지 — StrictMode 이중 실행과 재진입을 막는다 */
  const runningRef = useRef(false);

  const runStep = useCallback(
    async (step: ScenarioStep, vars: Record<string, string>): Promise<void> => {
      const timeoutMs = step.timeoutMs ?? 10_000;
      const value = render(step.value, vars);
      const target = renderTarget(step.target, vars);
      const store = useScenarioRunStore.getState();

      switch (step.action) {
        case 'goto': {
          // 이동 전에 버퍼를 비운다 — 직전 화면의 이벤트가 다음 스텝 판정에 섞이면 안 된다
          clearEvents();
          router.push(value);
          // App Router 는 새 라우트가 준비될 때까지 URL 을 바꾸지 않는다.
          // 개발 서버에서 처음 여는 화면은 컴파일에 수십 초가 걸리므로
          // 일반 스텝보다 넉넉한 한도를 준다(실측: 10초로는 모자랐다).
          await waitFor(() => (window.location.pathname === value.split('?')[0] ? true : null), {
            timeoutMs: Math.max(timeoutMs, GOTO_TIMEOUT_MS),
            what: `${value} 화면`,
          });
          return;
        }
        case 'click':
          if (!target) throw new Error('click 스텝에 target 이 없습니다.');
          await clickTarget(target, timeoutMs);
          return;
        case 'fill':
          if (!target) throw new Error('fill 스텝에 target 이 없습니다.');
          await fillTarget(target, value, timeoutMs);
          return;
        case 'scan':
          if (!target) throw new Error('scan 스텝에 target 이 없습니다.');
          await scanTarget(target, value, timeoutMs);
          return;
        case 'waitForText':
          await waitFor(
            () => (document.body.innerText.includes(value) ? true : null),
            { timeoutMs, what: `"${value}" 문구` },
          );
          return;
        case 'capture': {
          if (!target || !step.as) throw new Error('capture 스텝에 target/as 가 없습니다.');
          const text = await captureText(target, timeoutMs);
          store.setVar(step.as, text);
          return;
        }
        case 'waitMs':
          await new Promise((r) => setTimeout(r, Number(step.value ?? 0)));
          return;
        default:
          throw new Error(`알 수 없는 동작입니다: ${String(step.action)}`);
      }
    },
    [router],
  );

  const run = useCallback(
    async (target: Scenario) => {
      const store = useScenarioRunStore.getState;
      // 이 실행이 만든 기록을 사람 조작과 구분한다
      setActivityActorKind('SCENARIO');
      try {
        // 사용자 중단은 확인 대기 중에도 일어난다. 그 예외가 여기서 안 잡히면
        // unhandled rejection 이 되고 상태가 running 에 멈춘 채로 남는다.
        for (let i = 0; i < target.steps.length; i += 1) {
          const step = target.steps[i];
          store().setStepIndex(i);

          // 쓰기 스텝은 실행 직전에 사용자 확인을 받는다.
          // 실행 전 한 번만 받으면 2·3번째 쓰기는 계획서만 보고 승인한 것이 된다.
          if (step.write) {
            store().askWrite(describeStep(step, store().vars));
            await waitFor(
              () => {
                const s = store().status;
                if (s === 'running') return true;
                if (s === 'failed' || s === 'idle') throw new Error('사용자가 중단했습니다.');
                return null;
              },
              { timeoutMs: 10 * 60_000, what: '사용자 확인' },
            );
          }

          if (store().status === 'failed' || store().status === 'idle') return;

          clearEvents();
          try {
            await runStep(step, store().vars);
          } catch (e: unknown) {
            const reason = e instanceof Error ? e.message : String(e);
            store().recordStep({ index: i, verdict: 'FAIL', note: describeStep(step, store().vars), error: reason });
            store().fail({ stepIndex: i, reason, events: [] });
            return;
          }

          const judged = await judgeStep({
            expect: step.expect,
            alreadyDone: step.alreadyDone,
            timeoutMs: step.timeoutMs,
          });
          store().recordStep({
            index: i,
            verdict: judged.verdict,
            note: describeStep(step, store().vars),
            error: judged.error,
            events: judged.events,
          });
          if (judged.verdict === 'FAIL') {
            store().fail({
              stepIndex: i,
              reason: judged.error ?? '알 수 없는 실패',
              events: judged.events,
            });
            return;
          }
        }
        store().finish();
      } catch (e: unknown) {
        const reason = e instanceof Error ? e.message : String(e);
        if (store().status !== 'failed') {
          store().fail({ stepIndex: store().stepIndex, reason, events: [] });
        }
      } finally {
        setActivityActorKind('HUMAN');
      }
    },
    [runStep],
  );

  /**
   * 개발 환경에서만 전역 훅을 연다.
   * e2e 가 "사용자가 실행을 요청하는 순간"을 흉내내려면 진입점이 필요하다.
   * 운영에는 노출하지 않는다 — 실제 실행 요청은 AI 채팅 응답이 store.request 로 넣는다.
   */
  useEffect(() => {
    if (process.env.NODE_ENV === 'production') return;
    const w = window as unknown as Record<string, unknown>;
    w.__SCENARIO_RUN__ = (s: Scenario, vars: Record<string, string>) =>
      useScenarioRunStore.getState().request(s, vars);
    w.__SCENARIO_STATE__ = () => {
      const { status: st, stepIndex, vars, results, failure } = useScenarioRunStore.getState();
      return { status: st, stepIndex, vars, results, failure };
    };
    return () => {
      delete w.__SCENARIO_RUN__;
      delete w.__SCENARIO_STATE__;
    };
  }, []);

  useEffect(() => {
    if (status !== 'running' || !scenario || runningRef.current) return;
    runningRef.current = true;
    void run(scenario).finally(() => {
      runningRef.current = false;
    });
  }, [status, scenario, run]);

  return null;
}
