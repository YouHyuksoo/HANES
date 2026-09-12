/**
 * @file e2e/scenario-runner/types.ts
 * @description 시나리오 JSON 규격 schemaVersion 1 의 타입 정의
 *
 * 규격 단일 출처: docs/specs/2026-09-12-scenario-runner-schema-v1-design.md
 * 이 파일을 고치기 전에 규격서를 먼저 고친다.
 */

/** 수집기(services/activity-collector.ts)가 링버퍼에 넣는 이벤트 */
export interface ActivityEvent {
  ts: number;
  type: ActivityEventType;
  message?: string;
  method?: string;
  path?: string;
  status?: number;
  errorCode?: string;
  pagePath?: string;
  value?: string;
  /** 러너가 붙이는 표시 — ignoreErrors 에 걸려 판정에서 제외된 이벤트 */
  ignored?: boolean;
}

export type ActivityEventType =
  | 'TOAST_SUCCESS'
  | 'TOAST_ERROR'
  | 'API_CALL'
  | 'API_ERROR'
  | 'JS_ERROR'
  | 'SCAN'
  | 'PAGE_ACCESS';

/** 판정에 쓰는 에러 이벤트 종류 (규격서 6.2) */
export const ERROR_EVENT_TYPES: ActivityEventType[] = ['TOAST_ERROR', 'API_ERROR', 'JS_ERROR'];

/** 이벤트 술어 — 필드가 여러 개면 AND (규격서 6.1) */
export interface EventPredicate {
  type?: ActivityEventType;
  messageIncludes?: string;
  status?: number;
  method?: string;
  pathIncludes?: string;
  errorCode?: string;
}

/** 셀렉터 — 해석 우선순위는 규격서 5.1 */
export interface TargetSpec {
  testId?: string;
  role?: string;
  name?: string;
  label?: string;
  ariaLabel?: string;
  placeholder?: string;
  text?: string;
  /** 행 스코프 — 이 텍스트를 포함하는 tr 안에서 위 키를 다시 해석한다 (규격서 5.3) */
  row?: string;
  /** 행 안 버튼의 0-based 인덱스. 취약하므로 testId/role 이 가능하면 그쪽을 쓴다 */
  nthButton?: number;
}

export type StepAction =
  | 'goto'
  | 'click'
  | 'fill'
  | 'scan'
  | 'press'
  | 'waitForText'
  | 'capture'
  | 'screenshot'
  | 'api'
  | 'cleanupPrefix'
  | 'inspection'
  | 'waitMs'
  | 'pause';

export interface ExpectApiSpec {
  status?: number;
  listPath?: string;
  contains?: Record<string, string>;
  notContains?: Record<string, string>;
}

export interface ScenarioStep {
  action: StepAction;
  target?: TargetSpec;
  value?: string | number;
  /** capture / screenshot 결과를 담을 이름 */
  as?: string;
  note?: string;
  expect?: EventPredicate;
  alreadyDone?: EventPredicate;
  timeoutMs?: number;
  optional?: boolean;
  /** 이 스텝 한정 추가 무시 규칙 */
  ignoreErrors?: EventPredicate[];

  // screenshot
  label?: string;
  scope?: 'content' | 'viewport' | 'dialog';

  // api / cleanupPrefix
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path?: string;
  expectApi?: ExpectApiSpec;
  listPath?: string;
  prefixField?: string;
}

export type DataPolicy = 'readonly' | 'consumes' | 'creates';
export type OnFailure = 'pause' | 'abort' | 'continue';

export interface Scenario {
  schemaVersion: 1;
  id: string;
  title: string;
  startRoute: string;
  dataPolicy: DataPolicy;
  reportSlug?: string;
  vars?: Record<string, string>;
  preconditions?: string[];
  onFailure?: OnFailure;
  defaultTimeoutMs?: number;
  settleMs?: number;
  ignoreErrors?: EventPredicate[];
  setup?: ScenarioStep[];
  steps: ScenarioStep[];
  teardown?: ScenarioStep[];
}

export type StepVerdict = 'PASS' | 'ALREADY_DONE' | 'FAIL' | 'SKIPPED';

export interface StepResult {
  index: number;
  phase: 'setup' | 'steps' | 'teardown';
  action: StepAction;
  note?: string;
  verdict: StepVerdict;
  durationMs: number;
  events: ActivityEvent[];
  candidateErrors: ActivityEvent[];
  screenshots: string[];
  error: string | null;
}

export interface RunResult {
  id: string;
  title: string;
  runId: string;
  startedAt: string;
  finishedAt: string;
  verdict: 'PASS' | 'FAIL';
  /** 스텝 루프 밖에서 터진 오류 (진입 실패·세션 만료 등). 있으면 무조건 FAIL */
  fatalError: string | null;
  vars: Record<string, string>;
  steps: StepResult[];
}
