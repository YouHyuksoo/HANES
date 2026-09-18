"use client";

/**
 * @file components/shared/prep-guide/prepGuide.ts
 * @description 화면 진입 시 "다음에 뭘 해야 하는지"를 한 단계씩 유도하는 준비 안내의 공용 규칙·훅
 *
 * 초보자 가이드:
 * 1. 화면(통전검사, 실적입력 키오스크 등)은 자기 상태로 "각 단계가 끝났는지 / 지금 실행 가능한지"만 계산해
 *    `PrepGuideRawStep[]`으로 넘긴다. 어느 단계가 '진행 중'인지 고르는 규칙은 여기 한 곳(assignPrepGuideStatuses)이다.
 * 2. current = 첫 번째 미완료·실행 가능 단계. 그 뒤 단계는 앞 단계가 안 끝나 locked.
 *    notTarget = 이 화면·품목에서는 할 필요가 없는 단계(완료로 센다).
 * 3. usePrepGuide는 열림 상태만 다룬다 — 진입 시 열리고, 전부 끝나면 완료 연출 후 한 번만 자동으로 닫힌다.
 *    닫힌 뒤 단계가 다시 미완료가 돼도 자동으로 다시 열지 않는다(잔소리 방지). 헤더의 "준비 안내" 버튼으로 다시 연다.
 * 4. 그리기는 PrepGuideModal이 한다. 단계 라벨·힌트·아이콘·실행 버튼은 화면이 PrepGuideStepView로 채운다.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ComponentType, type ReactNode } from "react";

export type PrepGuideStatus = "done" | "current" | "locked" | "notTarget";

/** 화면이 계산해 넘기는 단계 원본 */
export interface PrepGuideRawStep<K extends string = string> {
  key: K;
  done: boolean;
  /** 앞 단계 조건이 갖춰져 지금 실행할 수 있는가 */
  runnable: boolean;
  /** 이 화면·품목에서는 필요 없는 단계 (완료로 센다) */
  notTarget?: boolean;
  /** 완료 시 보조 문구(점검 시각, 선택한 이름 등) */
  detail?: string;
}

export interface PrepGuideStep<K extends string = string> {
  key: K;
  status: PrepGuideStatus;
  detail?: string;
}

/** PrepGuideModal이 그리는 단계 뷰 — 화면이 라벨·힌트·아이콘·실행을 채운다 */
export interface PrepGuideStepView<K extends string = string> extends PrepGuideStep<K> {
  label: string;
  hint: string;
  icon: ComponentType<{ className?: string }>;
  /** 현재 단계의 실행 버튼(공용 모달 열기 등). 없으면 content만 보여준다 */
  action?: () => void;
  /** 실행 버튼 문구. 없으면 prepGuide.actionOpen({step: label}) */
  actionLabel?: string;
  /** 현재 단계일 때 패널 안에 직접 그릴 내용(목록에서 바로 고르기 등) */
  content?: ReactNode;
}

/** 첫 번째 미완료·실행 가능 단계를 current로, 나머지 미완료는 locked로 배정한다. */
export function assignPrepGuideStatuses<K extends string>(raw: PrepGuideRawStep<K>[]): PrepGuideStep<K>[] {
  let currentAssigned = false;
  return raw.map((s) => {
    if (s.notTarget) return { key: s.key, status: "notTarget", detail: s.detail };
    if (s.done) return { key: s.key, status: "done", detail: s.detail };
    if (s.runnable && !currentAssigned) {
      currentAssigned = true;
      return { key: s.key, status: "current", detail: s.detail };
    }
    return { key: s.key, status: "locked", detail: s.detail };
  });
}

/** 현재 진행해야 할 단계. 전부 끝났으면 null. */
export function findCurrentGuideStep<S extends PrepGuideStep>(steps: S[]): S | null {
  return steps.find((s) => s.status === "current") ?? null;
}

/** 완료(대상 없음 포함) 단계 수 */
export function countGuideDone(steps: PrepGuideStep[]): number {
  return steps.filter((s) => s.status === "done" || s.status === "notTarget").length;
}

/** 완료 연출을 보여준 뒤 닫기까지의 시간(ms) */
export const PREP_GUIDE_AUTO_CLOSE_MS = 1400;

export interface PrepGuideState<S extends PrepGuideStep> {
  open: boolean;
  steps: S[];
  current: S | null;
  doneCount: number;
  allReady: boolean;
  openGuide: () => void;
  closeGuide: () => void;
}

/** 열림/자동 닫힘 상태. steps는 이미 status가 배정된 배열이다. */
export function usePrepGuide<S extends PrepGuideStep>(steps: S[]): PrepGuideState<S> {
  const [open, setOpen] = useState(true);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const current = useMemo(() => findCurrentGuideStep(steps), [steps]);
  const doneCount = useMemo(() => countGuideDone(steps), [steps]);
  const allReady = steps.length > 0 && doneCount === steps.length;

  /** 전부 끝나면 완료 연출을 잠깐 보여주고 닫는다. */
  useEffect(() => {
    if (!open || !allReady) return;
    closeTimerRef.current = setTimeout(() => setOpen(false), PREP_GUIDE_AUTO_CLOSE_MS);
    return () => {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    };
  }, [open, allReady]);

  const openGuide = useCallback(() => setOpen(true), []);
  const closeGuide = useCallback(() => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    setOpen(false);
  }, []);

  return { open, steps, current, doneCount, allReady, openGuide, closeGuide };
}
