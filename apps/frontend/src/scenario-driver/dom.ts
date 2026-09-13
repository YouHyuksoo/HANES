/**
 * @file scenario-driver/dom.ts
 * @description 인앱 드라이버의 DOM 조작 — 사람이 누르는 것과 같은 경로로만 움직인다
 *
 * 원칙: 에이전트의 손끝은 화면 버튼까지다.
 * 여기서 API를 직접 호출하지 않는다. 버튼을 눌러야 api.ts 인터셉터·권한·검증·토스트·
 * 활동로그가 평소와 똑같이 타고, 그래야 화면의 에러 모달·토스트가 그대로 진실이 된다.
 *
 * Playwright 와 달리 자동 대기가 없어서 직접 만들어야 하는 것이 둘 있다.
 *   1) 요소가 나타날 때까지 대기 — router 이동 직후엔 아직 렌더 전이다
 *   2) React 상태를 실제로 바꾸는 입력 — el.value = x 만 하면 React 가 모른다
 */

/** 셀렉터 — 규격 5.1 의 해석 우선순위를 인앱에서 구현한다 */
export interface TargetSpec {
  testId?: string;
  role?: string;
  name?: string;
  label?: string;
  ariaLabel?: string;
  placeholder?: string;
  text?: string;
  /** 이 텍스트를 포함하는 tr 안에서 위 키를 다시 해석한다 */
  row?: string;
  /** 행 안 버튼의 0-based 인덱스 */
  nthButton?: number;
}

const VISIBLE = (el: Element): boolean => {
  const rect = el.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) return false;
  const style = window.getComputedStyle(el);
  return style.visibility !== 'hidden' && style.display !== 'none';
};

function scopeOf(target: TargetSpec): ParentNode | null {
  if (!target.row) return document;
  const rows = [...document.querySelectorAll('tr')];
  return rows.find((tr) => (tr.textContent ?? '').includes(target.row!)) ?? null;
}

/** 가시 <label> 텍스트로 폼 필드를 찾는다 — HANES 폼은 aria-label 이 아니라 label 로 식별된다 */
function byLabel(scope: ParentNode, labelText: string): HTMLElement | null {
  const labels = [...scope.querySelectorAll('label')];
  const hit = labels.find((l) => (l.textContent ?? '').includes(labelText));
  if (!hit) return null;
  // for=id 연결이 있으면 그것을 우선
  const forId = hit.getAttribute('for');
  if (forId) {
    const byId = document.getElementById(forId);
    if (byId) return byId as HTMLElement;
  }
  // 없으면 형제/부모 안의 첫 입력 요소
  const container = hit.parentElement ?? scope;
  return container.querySelector('input, textarea, select');
}

function byRole(scope: ParentNode, role: string, name: string): HTMLElement | null {
  const selector =
    role === 'button' ? 'button, [role="button"]'
    : role === 'link' ? 'a, [role="link"]'
    : `[role="${role}"]`;
  const found = [...scope.querySelectorAll(selector)].filter(VISIBLE);
  return (found.find((el) => (el.textContent ?? '').trim() === name)
    ?? found.find((el) => (el.textContent ?? '').includes(name))
    ?? null) as HTMLElement | null;
}

/**
 * 규격 5.1 우선순위대로 요소를 찾는다.
 *   testId → role+name → label → ariaLabel → placeholder → text
 */
export function resolveTarget(target: TargetSpec): HTMLElement | null {
  const scope = scopeOf(target);
  if (!scope) return null;

  if (target.testId) {
    return scope.querySelector(`[data-testid="${target.testId}"]`);
  }
  if (target.role && target.name) return byRole(scope, target.role, target.name);
  if (target.label) return byLabel(scope, target.label);
  if (target.ariaLabel) {
    return scope.querySelector(`[aria-label="${target.ariaLabel}"]`);
  }
  if (target.placeholder) {
    return scope.querySelector(`input[placeholder*="${target.placeholder}"], textarea[placeholder*="${target.placeholder}"]`);
  }
  if (target.text) {
    const all = [...scope.querySelectorAll<HTMLElement>('button, a, td, span, div, label')].filter(VISIBLE);
    return all.find((el) => (el.textContent ?? '').includes(target.text!)) ?? null;
  }
  if (target.nthButton !== undefined) {
    return [...scope.querySelectorAll<HTMLElement>('button')][target.nthButton] ?? null;
  }
  return null;
}

/** 사람이 읽는 설명 — 실행 계획과 실패 메시지에 쓴다 */
export function describeTarget(target: TargetSpec): string {
  const inner =
    target.testId ? target.testId
    : target.role && target.name ? `${target.role}"${target.name}"`
    : target.label ? `${target.label} 입력칸`
    : target.ariaLabel ? target.ariaLabel
    : target.placeholder ? `"${target.placeholder}" 입력칸`
    : target.text ? `"${target.text}"`
    : target.nthButton !== undefined ? `${target.nthButton + 1}번째 버튼`
    : '?';
  return target.row ? `"${target.row}" 행의 ${inner}` : inner;
}

export class DriverTimeoutError extends Error {}

/** 조건이 참이 될 때까지 폴링한다. Playwright 의 자동 대기를 대신한다. */
export async function waitFor<T>(
  fn: () => T | null | undefined,
  { timeoutMs = 10_000, intervalMs = 100, what = '요소' }: { timeoutMs?: number; intervalMs?: number; what?: string } = {},
): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const value = fn();
    if (value) return value;
    if (Date.now() >= deadline) {
      throw new DriverTimeoutError(`${what}을(를) ${timeoutMs}ms 안에 찾지 못했습니다.`);
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
}

/** 화면에 보이고 조작 가능한 상태가 될 때까지 기다린 뒤 요소를 돌려준다 */
export async function waitForTarget(target: TargetSpec, timeoutMs = 10_000): Promise<HTMLElement> {
  return waitFor(
    () => {
      const el = resolveTarget(target);
      return el && VISIBLE(el) ? el : null;
    },
    { timeoutMs, what: describeTarget(target) },
  );
}

function isDisabled(el: HTMLElement): boolean {
  if ((el as HTMLButtonElement).disabled) return true;
  return el.getAttribute('aria-disabled') === 'true';
}

/**
 * 클릭한다. 비활성이면 잠시 기다렸다가, 그래도 비활성이면 실패로 세운다.
 *
 * 이 실패가 중요하다. "확정 버튼이 비활성"은 선행조건이 안 갖춰졌다는 뜻이고,
 * 그걸 조용히 넘기면 시나리오가 아무 일도 안 하고 성공한 것처럼 끝난다.
 */
export async function clickTarget(target: TargetSpec, timeoutMs = 10_000): Promise<void> {
  const el = await waitForTarget(target, timeoutMs);
  if (isDisabled(el)) {
    await waitFor(() => (isDisabled(el) ? null : true), {
      timeoutMs: Math.min(timeoutMs, 5_000),
      what: `${describeTarget(target)} 활성화`,
    }).catch(() => {
      throw new Error(
        `${describeTarget(target)}이(가) 비활성 상태입니다. 선행 조건이 갖춰지지 않았습니다.`,
      );
    });
  }
  el.click();
}

/**
 * React 가 인식하는 방식으로 입력값을 넣는다.
 *
 * el.value = x 만 하면 React 의 상태는 그대로다 — React 가 value 프로퍼티를
 * 자체 setter 로 가로채고 있어서, 네이티브 setter 를 직접 호출한 뒤
 * input 이벤트를 올려야 onChange 가 돈다.
 */
export function setNativeValue(el: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement, value: string): void {
  const proto =
    el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype
    : el instanceof HTMLSelectElement ? HTMLSelectElement.prototype
    : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
  if (setter) setter.call(el, value);
  else el.value = value;
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
}

export async function fillTarget(target: TargetSpec, value: string, timeoutMs = 10_000): Promise<void> {
  const el = await waitForTarget(target, timeoutMs);
  const input = (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement)
    ? el
    : el.querySelector<HTMLInputElement>('input, textarea, select');
  if (!input) throw new Error(`${describeTarget(target)}은(는) 입력 요소가 아닙니다.`);
  if (isDisabled(input)) {
    throw new Error(`${describeTarget(target)}이(가) 비활성 상태입니다.`);
  }
  input.focus();
  setNativeValue(input, value);
}

/** 스캔 = 입력 + Enter (BarcodeScanInput 동작과 일치) */
export async function scanTarget(target: TargetSpec, value: string, timeoutMs = 10_000): Promise<void> {
  await fillTarget(target, value, timeoutMs);
  const el = await waitForTarget(target, timeoutMs);
  const input = (el instanceof HTMLInputElement ? el : el.querySelector<HTMLInputElement>('input')) ?? null;
  if (!input) return;
  for (const type of ['keydown', 'keypress', 'keyup'] as const) {
    input.dispatchEvent(new KeyboardEvent(type, { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }));
  }
}

/** 화면 텍스트를 읽어 변수로 담는다 */
export async function captureText(target: TargetSpec, timeoutMs = 10_000): Promise<string> {
  const el = await waitForTarget(target, timeoutMs);
  const input = el instanceof HTMLInputElement ? el : null;
  return (input ? input.value : el.textContent ?? '').trim();
}
