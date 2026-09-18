"use client";

/**
 * @file inspection/result/hooks/useInspectPrepGuide.ts
 * @description 준비 안내 모달 열림/단계 상태 — 화면 진입 시 자동으로 열리고, 전부 끝나면 완료 연출 후 자동으로 닫힌다.
 *
 * 초보자 가이드:
 * 1. 단계 계산은 prepGuideSteps.ts(순수 함수)가 한다. 이 훅은 열림 상태와 자동 닫힘 타이밍만 다룬다.
 * 2. 자동 닫힘은 한 번만 — 닫힌 뒤 단계가 다시 미완료가 되어도 자동으로 다시 열지 않는다(잔소리 방지).
 *    필요하면 헤더의 "준비 안내" 버튼으로 다시 연다.
 * 3. "나중에 하기"로 닫으면 그 세션에서는 자동 완료 닫힘 연출도 건너뛴다.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { InspectPrepState } from "./useInspectPrepStatus";
import {
  buildPrepGuideSteps,
  countGuideDone,
  findCurrentGuideStep,
  type PrepGuideStep,
} from "./prepGuideSteps";

/** 완료 연출을 보여준 뒤 닫기까지의 시간(ms) */
export const GUIDE_AUTO_CLOSE_MS = 1400;

interface UseInspectPrepGuideArgs {
  hasEquip: boolean;
  hasOrder: boolean;
  prep: Pick<InspectPrepState, "gate" | "sampleCheck" | "workers">;
}

export interface InspectPrepGuideState {
  open: boolean;
  steps: PrepGuideStep[];
  current: PrepGuideStep | null;
  doneCount: number;
  allReady: boolean;
  openGuide: () => void;
  closeGuide: () => void;
}

export function useInspectPrepGuide({ hasEquip, hasOrder, prep }: UseInspectPrepGuideArgs): InspectPrepGuideState {
  const [open, setOpen] = useState(true);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const steps = useMemo(
    () => buildPrepGuideSteps({ hasEquip, hasOrder, prep }),
    [hasEquip, hasOrder, prep],
  );
  const current = useMemo(() => findCurrentGuideStep(steps), [steps]);
  const doneCount = useMemo(() => countGuideDone(steps), [steps]);
  const allReady = doneCount === steps.length;

  /** 전부 끝나면 완료 연출을 잠깐 보여주고 닫는다. */
  useEffect(() => {
    if (!open || !allReady) return;
    closeTimerRef.current = setTimeout(() => setOpen(false), GUIDE_AUTO_CLOSE_MS);
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

export default useInspectPrepGuide;
