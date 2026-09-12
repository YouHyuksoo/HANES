/**
 * @file e2e/scenario-runner/engine.ts
 * @description 시나리오 실행 엔진 — 변수 치환, 액션 실행, 스텝 루프
 *
 * 규격 단일 출처: docs/specs/2026-09-12-scenario-runner-schema-v1-design.md
 *
 * 원칙(규격서 1.1): 시나리오 JSON 은 선언이고 로직은 여기 있다.
 * 반복이 필요한 동작(cleanupPrefix, inspection)은 JSON 에 루프 문법을 주지 않고
 * 이 파일의 내장 액션으로 캡슐화한다.
 */
import fs from 'node:fs';
import path from 'node:path';
import type { Page } from '@playwright/test';
import { drain, judgeStep } from './events';
import { describeTarget, resolveTarget } from './selector';
import type {
  ActivityEvent,
  RunResult,
  Scenario,
  ScenarioStep,
  StepResult,
  StepVerdict,
} from './types';

const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_SETTLE_MS = 500;

// ── 변수 ────────────────────────────────────────────────────────────────────

/** YYMMDDHHmmss (KST 기준이 아니라 로컬 — 유니크 키 용도라 타임존 무관) */
function stamp(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${String(d.getFullYear()).slice(2)}${p(d.getMonth() + 1)}${p(d.getDate())}${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

function todayLocal(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function buildVars(scenario: Scenario): Record<string, string> {
  const vars: Record<string, string> = {
    stamp: stamp(),
    reportDate: todayLocal(),
  };
  vars.runId = `${scenario.id}-${vars.stamp}`;
  // vars 끼리 치환 가능 — 선언 순서대로 1패스 (규격서 3절)
  for (const [key, raw] of Object.entries(scenario.vars ?? {})) {
    vars[key] = render(raw, vars);
  }
  return vars;
}

/**
 * {{변수}} 치환.
 * 변수명 패턴을 \w+ 로 좁히면 한글 등 비ASCII 이름이 정규식에 걸리지 않아
 * "치환도 안 되고 검증에도 안 잡히는" 조용한 실패가 된다.
 * 따라서 중괄호 안을 전부 잡고, 미정의 변수는 원문 그대로 남긴다(검증기가 거부한다).
 */
export const VAR_PATTERN = /\{\{\s*([^{}]+?)\s*\}\}/g;

export function render(value: string, vars: Record<string, string>): string {
  return value.replace(VAR_PATTERN, (whole, key: string) =>
    key in vars ? vars[key] : whole,
  );
}

// ── 액션 ────────────────────────────────────────────────────────────────────

interface ActionContext {
  page: Page;
  scenario: Scenario;
  vars: Record<string, string>;
  shotDir: string;
  screenshots: string[];
  apiBase: string;
}

function r(ctx: ActionContext) {
  return (value: string) => render(value, ctx.vars);
}

async function authHeaders(page: Page): Promise<Record<string, string>> {
  const token = await page.evaluate(() => localStorage.getItem('harness-token'));
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function getByPath(body: unknown, listPath?: string): unknown[] {
  if (!listPath) return Array.isArray(body) ? body : [];
  const value = listPath.split('.').reduce<unknown>(
    (acc, key) => (acc && typeof acc === 'object' ? (acc as Record<string, unknown>)[key] : undefined),
    body,
  );
  return Array.isArray(value) ? value : [];
}

/** 접두어 테스트 데이터 일괄 정리 (규격서 6.3) */
async function runCleanupPrefix(ctx: ActionContext, step: ScenarioStep): Promise<string> {
  const render_ = r(ctx);
  const prefix = ctx.vars.prefix;
  if (!prefix) throw new Error('cleanupPrefix 에는 vars.prefix 가 필요하다');
  if (!step.path) throw new Error('cleanupPrefix 에는 path 가 필요하다');
  if (!step.prefixField) throw new Error('cleanupPrefix 에는 prefixField 가 필요하다');

  const base = render_(step.path);
  const headers = await authHeaders(ctx.page);
  const listRes = await ctx.page.request.get(
    `${ctx.apiBase}${base}?search=${encodeURIComponent(prefix)}&limit=100`,
    { headers },
  );
  const body = await listRes.json().catch(() => ({}));
  const rows = getByPath(body, step.listPath ?? 'data');

  let deleted = 0;
  for (const row of rows) {
    const value = (row as Record<string, unknown>)[step.prefixField];
    if (typeof value !== 'string' || !value.startsWith(prefix)) continue;
    const res = await ctx.page.request
      .delete(`${ctx.apiBase}${base}/${encodeURIComponent(value)}`, { headers })
      .catch(() => null);
    if (res?.ok()) deleted += 1;
  }
  return `정리 ${deleted}건 (조회 ${rows.length}건, 접두어 ${prefix})`;
}

/** 직접 HTTP 호출 + 응답 검증 (규격서 6.4) */
async function runApi(ctx: ActionContext, step: ScenarioStep): Promise<string> {
  const render_ = r(ctx);
  if (!step.path) throw new Error('api 에는 path 가 필요하다');
  const method = (step.method ?? 'GET').toUpperCase();
  const url = `${ctx.apiBase}${render_(step.path)}`;
  const headers = await authHeaders(ctx.page);

  const res = await ctx.page.request.fetch(url, { method, headers });
  const body = await res.json().catch(() => ({}));
  const spec = step.expectApi;
  if (!spec) return `${method} ${url} -> ${res.status()}`;

  if (spec.status !== undefined && res.status() !== spec.status) {
    throw new Error(`expectApi.status ${spec.status} 인데 실제 ${res.status()}`);
  }
  const rows = getByPath(body, spec.listPath);
  const hit = (pairs: Record<string, string>) =>
    rows.some((row) =>
      Object.entries(pairs).every(
        ([field, raw]) => String((row as Record<string, unknown>)[field]) === render_(raw),
      ),
    );
  if (spec.contains && !hit(spec.contains)) {
    throw new Error(`expectApi.contains 불일치: ${JSON.stringify(spec.contains)} (목록 ${rows.length}건)`);
  }
  if (spec.notContains && hit(spec.notContains)) {
    throw new Error(`expectApi.notContains 위반: ${JSON.stringify(spec.notContains)} 가 목록에 있다`);
  }
  return `${method} ${url} -> ${res.status()} (목록 ${rows.length}건)`;
}

async function runScreenshot(ctx: ActionContext, step: ScenarioStep): Promise<string> {
  const name = step.as ?? `shot-${Date.now()}.png`;
  const full = path.join(ctx.shotDir, name);
  fs.mkdirSync(ctx.shotDir, { recursive: true });

  const scope = step.scope ?? 'content';
  if (scope === 'viewport') {
    await ctx.page.screenshot({ path: full });
  } else if (scope === 'dialog') {
    const dialog = ctx.page.getByRole('dialog').first();
    if (await dialog.isVisible().catch(() => false)) await dialog.screenshot({ path: full });
    else await ctx.page.screenshot({ path: full });
  } else {
    const content = ctx.page.locator('main').first();
    if (await content.isVisible().catch(() => false)) await content.screenshot({ path: full });
    else await ctx.page.screenshot({ path: full });
  }
  ctx.screenshots.push(name);
  return `캡처 ${name} (${scope})`;
}

/**
 * 점검 인터록 (규격서 7절).
 * 배지가 "완료(합격)" 이면 이미 진행됨. 아니면 모달을 열어 선택형 항목을 합격 처리 후 저장.
 * 저장 후에도 불합격이면 실패 — 측정형 항목이 규격을 벗어난 경우이며 러너가 뚫으면 안 된다.
 */
async function runInspection(ctx: ActionContext, step: ScenarioStep): Promise<StepVerdict> {
  const kind = String(step.value ?? 'DAILY').toUpperCase();
  const badgeLabel = kind === 'WORKER' ? '작업자설비점검' : '설비 일상점검';
  const card = ctx.page.locator('div', { hasText: badgeLabel }).last();
  const text = (await card.innerText().catch(() => '')) ?? '';

  if (text.includes('완료(합격)') || /완료\s*\d{2}:\d{2}/.test(text)) {
    return 'ALREADY_DONE';
  }
  if (text.includes('완료(불합격)')) {
    throw new Error(`${badgeLabel} 종합판정이 불합격이다 — 설비 조치 후 사람이 재점검해야 한다 (규격서 7.1)`);
  }

  await card.getByRole('button', { name: '입력' }).first().click();
  const dialog = ctx.page.getByRole('dialog').first();
  await dialog.waitFor({ state: 'visible', timeout: 5000 });

  // 선택형 항목을 전부 합격으로. 측정형은 건드리지 않는다(자동 판정).
  const passButtons = dialog.getByRole('button', { name: /^(OK|합격|PASS)$/ });
  const count = await passButtons.count();
  for (let i = 0; i < count; i += 1) await passButtons.nth(i).click();

  await dialog.getByRole('button', { name: /저장/ }).first().click();
  await dialog.waitFor({ state: 'hidden', timeout: 10_000 }).catch(() => {});
  return 'PASS';
}

async function runAction(ctx: ActionContext, step: ScenarioStep): Promise<StepVerdict | string> {
  const render_ = r(ctx);
  const timeout = step.timeoutMs ?? ctx.scenario.defaultTimeoutMs ?? DEFAULT_TIMEOUT_MS;

  switch (step.action) {
    case 'goto': {
      // 이동 전 반드시 drain — 리로드하면 window 버퍼가 날아간다 (규격서 4.1)
      await drain(ctx.page).catch(() => []);
      await ctx.page.goto(render_(String(step.value ?? ctx.scenario.startRoute)));
      return `이동 ${step.value}`;
    }
    case 'click': {
      if (!step.target) throw new Error('click 에는 target 이 필요하다');
      await resolveTarget(ctx.page, step.target, render_).click({ timeout });
      return `클릭 ${describeTarget(step.target)}`;
    }
    case 'fill': {
      if (!step.target) throw new Error('fill 에는 target 이 필요하다');
      await resolveTarget(ctx.page, step.target, render_).fill(render_(String(step.value ?? '')), { timeout });
      return `입력 ${describeTarget(step.target)} = ${render_(String(step.value ?? ''))}`;
    }
    case 'scan': {
      if (!step.target) throw new Error('scan 에는 target 이 필요하다');
      const locator = resolveTarget(ctx.page, step.target, render_);
      await locator.fill(render_(String(step.value ?? '')), { timeout });
      await locator.press('Enter');
      return `스캔 ${render_(String(step.value ?? ''))}`;
    }
    case 'press': {
      if (!step.target) throw new Error('press 에는 target 이 필요하다');
      await resolveTarget(ctx.page, step.target, render_).press(String(step.value ?? 'Enter'), { timeout });
      return `키 ${step.value}`;
    }
    case 'waitForText': {
      await ctx.page.getByText(render_(String(step.value ?? '')), { exact: false })
        .first().waitFor({ state: 'visible', timeout });
      return `대기 "${step.value}"`;
    }
    case 'capture': {
      if (!step.target || !step.as) throw new Error('capture 에는 target 과 as 가 필요하다');
      const captured = (await resolveTarget(ctx.page, step.target, render_).innerText({ timeout })).trim();
      ctx.vars[step.as] = captured;
      return `캡처 ${step.as} = ${captured}`;
    }
    case 'screenshot':
      return runScreenshot(ctx, step);
    case 'api':
      return runApi(ctx, step);
    case 'cleanupPrefix':
      return runCleanupPrefix(ctx, step);
    case 'inspection':
      return runInspection(ctx, step);
    case 'waitMs': {
      await ctx.page.waitForTimeout(Number(step.value ?? 0));
      return `대기 ${step.value}ms`;
    }
    case 'pause': {
      await ctx.page.pause();
      return '개입 대기 종료';
    }
    default:
      throw new Error(`알 수 없는 action: ${String(step.action)}`);
  }
}

// ── 스텝 루프 ───────────────────────────────────────────────────────────────

/** api / cleanupPrefix 는 화면 이벤트를 만들지 않으므로 이벤트 판정을 건너뛴다 */
const NON_UI_ACTIONS = new Set(['api', 'cleanupPrefix']);

export async function runSteps(
  ctx: ActionContext,
  steps: ScenarioStep[],
  phase: StepResult['phase'],
  results: StepResult[],
): Promise<boolean> {
  const settleMs = ctx.scenario.settleMs ?? DEFAULT_SETTLE_MS;
  const scenarioIgnores = ctx.scenario.ignoreErrors ?? [];

  for (const [index, step] of steps.entries()) {
    const startedAt = Date.now();
    const screenshotsBefore = ctx.screenshots.length;
    let verdict: StepVerdict = 'PASS';
    let error: string | null = null;
    let events: ActivityEvent[] = [];
    let candidateErrors: ActivityEvent[] = [];

    try {
      const outcome = await runAction(ctx, step);
      if (outcome === 'ALREADY_DONE') verdict = 'ALREADY_DONE';

      if (!NON_UI_ACTIONS.has(step.action) && verdict !== 'ALREADY_DONE') {
        const judged = await judgeStep(ctx.page, {
          expect: step.expect,
          alreadyDone: step.alreadyDone,
          timeoutMs: step.timeoutMs ?? ctx.scenario.defaultTimeoutMs ?? DEFAULT_TIMEOUT_MS,
          settleMs,
          ignoreErrors: [...scenarioIgnores, ...(step.ignoreErrors ?? [])],
        });
        verdict = judged.verdict;
        events = judged.events;
        candidateErrors = judged.candidateErrors;
        error = judged.error;
      }
      if (typeof outcome === 'string') {
        // 액션 자체의 설명을 note 가 없을 때 대신 쓴다
        step.note ??= outcome;
      }
    } catch (e: unknown) {
      verdict = 'FAIL';
      error = e instanceof Error ? e.message : String(e);
    }

    if (verdict === 'FAIL' && step.optional) verdict = 'SKIPPED';

    results.push({
      index,
      phase,
      action: step.action,
      note: step.note,
      verdict,
      durationMs: Date.now() - startedAt,
      events,
      candidateErrors,
      screenshots: ctx.screenshots.slice(screenshotsBefore),
      error: verdict === 'SKIPPED' ? null : error,
    });

    const mark = verdict === 'PASS' ? 'OK' : verdict === 'ALREADY_DONE' ? '이미' : verdict === 'SKIPPED' ? '건너뜀' : '실패';
    console.log(`[${phase} ${index}] ${mark} ${step.action} — ${step.note ?? ''}${error ? ` :: ${error}` : ''}`);

    if (verdict === 'FAIL') {
      const onFailure = ctx.scenario.onFailure ?? 'abort';
      if (onFailure === 'pause') {
        console.log('[runner] onFailure=pause — 브라우저에서 수동 조작 후 Resume 하라.');
        await ctx.page.pause();
      } else if (onFailure === 'abort') {
        return false;
      }
    }
  }
  return true;
}

export function createContext(
  page: Page,
  scenario: Scenario,
  vars: Record<string, string>,
  shotDir: string,
  apiBase: string,
): ActionContext {
  return { page, scenario, vars, shotDir, screenshots: [], apiBase };
}

export function summarize(
  scenario: Scenario,
  vars: Record<string, string>,
  steps: StepResult[],
  startedAt: string,
  fatalError: string | null = null,
): RunResult {
  // 스텝이 하나도 안 돌았어도(진입 실패) PASS 로 집계하지 않는다.
  const failed = fatalError !== null || steps.length === 0 || steps.some((s) => s.verdict === 'FAIL');
  return {
    fatalError,
    id: scenario.id,
    title: scenario.title,
    runId: vars.runId,
    startedAt,
    finishedAt: new Date().toISOString(),
    verdict: failed ? 'FAIL' : 'PASS',
    vars,
    steps,
  };
}
