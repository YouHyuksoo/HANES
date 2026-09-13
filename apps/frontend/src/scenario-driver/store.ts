"use client";

/**
 * @file scenario-driver/store.ts
 * @description 시나리오 실행 상태 — 화면 전환을 넘어 살아남아야 한다
 *
 * 왜 store 인가:
 * 시나리오는 여러 화면을 넘나든다(router.push). 상태를 화면 컴포넌트가 들고 있으면
 * 이동하는 순간 stepIndex·vars 가 같이 사라진다. 그래서 전역 store 에 둔다.
 * 같은 이유로 실행 주체(ScenarioDriverHost)도 providers.tsx 레벨에 전역 마운트한다.
 *
 * 되돌림(rollback)·재개(resume)는 없다. 실패하면 그 자리에서 멈추고
 * 원인을 AI 에게 넘겨 사용자에게 안내한다 — 그게 이 기능의 범위다.
 */
import { create } from 'zustand';
import type { RunStatus, Scenario, StepResult } from './types';

export interface ScenarioFailure {
  stepIndex: number;
  /** 사람이 읽는 원인 */
  reason: string;
  /** 그 시점 링버퍼 이벤트 — AI 원인 분석의 재료 */
  events: unknown[];
}

interface ScenarioRunState {
  status: RunStatus;
  scenario: Scenario | null;
  /** AI 가 채운 값 + capture 로 얻은 값 */
  vars: Record<string, string>;
  stepIndex: number;
  results: StepResult[];
  failure: ScenarioFailure | null;
  /** 쓰기 스텝 확인 대기 중일 때 그 스텝 설명 */
  pendingWriteNote: string | null;

  /** 실행 요청 — 계획 확인 화면을 띄운다 */
  request: (scenario: Scenario, vars: Record<string, string>) => void;
  /** 사용자가 계획을 승인 */
  approve: () => void;
  /** 사용자가 쓰기 스텝을 승인 */
  approveWrite: () => void;
  /** 사용자가 취소하거나 중단 */
  cancel: (reason?: string) => void;

  // 드라이버 전용
  setStatus: (status: RunStatus) => void;
  setStepIndex: (index: number) => void;
  setVar: (key: string, value: string) => void;
  recordStep: (result: StepResult) => void;
  askWrite: (note: string) => void;
  fail: (failure: ScenarioFailure) => void;
  finish: () => void;
  reset: () => void;
}

/** 실행 중인지 — 오버레이가 화면 클릭을 막을지 판단한다 */
export function isBusy(status: RunStatus): boolean {
  return status === 'running' || status === 'awaitWrite';
}

const INITIAL = {
  status: 'idle' as RunStatus,
  scenario: null,
  vars: {},
  stepIndex: 0,
  results: [] as StepResult[],
  failure: null,
  pendingWriteNote: null,
};

export const useScenarioRunStore = create<ScenarioRunState>((set, get) => ({
  ...INITIAL,

  request: (scenario, vars) => {
    // 이미 돌고 있으면 새 요청을 무시한다 — 중복 실행하면 지시가 두 번 생긴다
    if (isBusy(get().status)) return;
    set({ ...INITIAL, status: 'confirming', scenario, vars });
  },

  approve: () => {
    if (get().status !== 'confirming') return;
    set({ status: 'running' });
  },

  approveWrite: () => {
    if (get().status !== 'awaitWrite') return;
    set({ status: 'running', pendingWriteNote: null });
  },

  cancel: (reason) => {
    const { status, stepIndex } = get();
    if (status === 'idle' || status === 'done') return set({ ...INITIAL });
    set({
      status: 'failed',
      pendingWriteNote: null,
      failure: { stepIndex, reason: reason ?? '사용자가 중단했습니다.', events: [] },
    });
  },

  setStatus: (status) => set({ status }),
  setStepIndex: (stepIndex) => set({ stepIndex }),
  setVar: (key, value) => set((s) => ({ vars: { ...s.vars, [key]: value } })),
  recordStep: (result) =>
    set((s) => ({ results: [...s.results.filter((r) => r.index !== result.index), result] })),
  askWrite: (note) => set({ status: 'awaitWrite', pendingWriteNote: note }),
  fail: (failure) => set({ status: 'failed', failure, pendingWriteNote: null }),
  finish: () => set({ status: 'done', pendingWriteNote: null }),
  reset: () => set({ ...INITIAL }),
}));
