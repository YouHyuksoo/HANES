/**
 * @file modules/ai-scenarios/scenario.types.ts
 * @description 시나리오 규격 schemaVersion 1 (백엔드 측)
 *
 * 규격 단일 출처: docs/specs/2026-09-12-scenario-runner-schema-v1-design.md
 * 프론트 타입: apps/frontend/src/scenario-driver/types.ts — 같은 규격을 양쪽이 공유한다.
 *
 * 시나리오는 **절차만** 담는다. 품목코드·수량 같은 데이터는 실행 시점에 AI 가 params 로 넣는다.
 * JSON 에 데이터를 박으면 배포 다음 날 썩고, "테스트 완결된 것만 배포"가 성립하지 않는다.
 */

export type ScenarioStepAction =
  | 'goto' | 'click' | 'fill' | 'scan' | 'waitForText' | 'capture' | 'waitMs';

export interface ScenarioTarget {
  testId?: string;
  role?: string;
  name?: string;
  label?: string;
  ariaLabel?: string;
  placeholder?: string;
  text?: string;
  row?: string;
  nthButton?: number;
}

export interface ScenarioEventPredicate {
  type?: string;
  messageIncludes?: string;
  status?: number;
  method?: string;
  pathIncludes?: string;
  errorCode?: string;
}

export interface ScenarioStep {
  action: ScenarioStepAction;
  target?: ScenarioTarget;
  value?: string;
  as?: string;
  note?: string;
  expect?: ScenarioEventPredicate;
  alreadyDone?: ScenarioEventPredicate;
  timeoutMs?: number;
  /** 실데이터를 바꾸는 스텝 — 실행 직전에 사용자 확인을 받는다 */
  write?: boolean;
}

export interface ScenarioParamSpec {
  label: string;
  required?: boolean;
  type?: 'string' | 'number';
  /** 값이 실재하는지 확인할 ai-page-tools read 도구 이름 */
  resolver?: string;
}

export interface Scenario {
  schemaVersion: 1;
  id: string;
  title: string;
  /** AI 가 시나리오를 고를 때 읽는 설명 — 언제 쓰는 절차인지 */
  description: string;
  startRoute: string;
  params?: Record<string, ScenarioParamSpec>;
  steps: ScenarioStep[];
}

/** 목록 응답 — AI 가 선택에 쓸 최소 정보만. steps 는 담지 않는다(프롬프트 낭비) */
export interface ScenarioSummary {
  id: string;
  title: string;
  description: string;
  startRoute: string;
  params: Record<string, ScenarioParamSpec>;
  /** 실데이터를 바꾸는 단계 수 — 0 이면 읽기 전용 절차다 */
  writeStepCount: number;
}
