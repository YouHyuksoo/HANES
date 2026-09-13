/**
 * @file scenario-driver/types.ts
 * @description 인앱 시나리오 드라이버 타입 — 규격 schemaVersion 1
 *
 * 규격 단일 출처: docs/specs/2026-09-12-scenario-runner-schema-v1-design.md
 *
 * 핵심 원칙 둘:
 *   1) 시나리오는 **절차만** 담는다. 품목코드·수량 같은 데이터는 실행 시점에 AI가 params로 넣는다.
 *      데이터를 JSON에 박으면 배포 다음 날 썩고, "테스트 완결된 것만 배포"가 성립하지 않는다.
 *   2) 시나리오는 **선언**이고 로직은 드라이버에 있다. JSON에 루프·조건을 넣지 않는다.
 */
import type { TargetSpec } from './dom';

export type { TargetSpec };

export type ActivityEventType =
  | 'TOAST_SUCCESS' | 'TOAST_ERROR' | 'API_CALL' | 'API_ERROR' | 'JS_ERROR' | 'SCAN' | 'PAGE_ACCESS';

/** 링버퍼 이벤트에 대한 술어 — 필드가 여러 개면 AND */
export interface EventPredicate {
  type?: ActivityEventType;
  messageIncludes?: string;
  status?: number;
  method?: string;
  pathIncludes?: string;
  errorCode?: string;
}

export type StepAction =
  | 'goto' | 'click' | 'fill' | 'scan' | 'waitForText' | 'capture' | 'waitMs';

export interface ScenarioStep {
  action: StepAction;
  target?: TargetSpec;
  /** {{param}} 치환 대상 */
  value?: string;
  /** capture 결과를 담을 이름 */
  as?: string;
  /** 사람이 읽는 설명 — 실행 계획과 진행 표시에 그대로 쓰인다 */
  note?: string;
  expect?: EventPredicate;
  alreadyDone?: EventPredicate;
  timeoutMs?: number;
  /**
   * 실데이터를 바꾸는 스텝. 실행 직전에 사용자 확인을 받는다.
   * 저장·확정·발행처럼 되돌리기 어려운 버튼에 반드시 표시한다.
   */
  write?: boolean;
}

/** 시나리오가 요구하는 값 — AI가 사용자 말에서 뽑아 채운다 */
export interface ScenarioParamSpec {
  label: string;
  required?: boolean;
  type?: 'string' | 'number';
  /** 값이 실재하는지 확인할 백엔드 read 도구 이름 (ai-page-tools) */
  resolver?: string;
}

export interface Scenario {
  schemaVersion: 1;
  id: string;
  title: string;
  /** AI가 시나리오를 고를 때 읽는 설명 — 언제 쓰는 절차인지 */
  description: string;
  startRoute: string;
  params?: Record<string, ScenarioParamSpec>;
  steps: ScenarioStep[];
}

export type StepVerdict = 'PASS' | 'ALREADY_DONE' | 'FAIL' | 'PENDING' | 'RUNNING';

export interface StepResult {
  index: number;
  verdict: StepVerdict;
  note?: string;
  error?: string | null;
  /** 그 스텝에서 drain된 이벤트 원본 — 실패 시 AI에게 그대로 넘긴다 */
  events?: unknown[];
}

/**
 * 실행 상태.
 *   idle       대기
 *   confirming 실행 계획을 보여주고 사용자 승인 대기
 *   running    스텝 실행 중 (화면 클릭 차단)
 *   awaitWrite 쓰기 버튼 직전 — 사용자 확인 대기
 *   done       전부 통과
 *   failed     중단 (되돌리지 않는다. AI가 원인을 안내한다)
 */
export type RunStatus = 'idle' | 'confirming' | 'running' | 'awaitWrite' | 'done' | 'failed';
