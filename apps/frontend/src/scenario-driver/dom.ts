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

/**
 * 조작 대상의 탐색 기준점.
 *
 * 모달이 떠 있으면 그 안에서만 찾는다. 사람이 보는 것과 같다 —
 * 위에 뜬 창을 조작하지 뒤에 가려진 화면을 조작하지 않는다.
 *
 * 이게 없어서 실제로 결함을 겪었다(2026-09-13): 품목검색 모달이 떠 있는데
 * 행 탐색이 문서 전체를 훑어 **배경 그리드의 행**을 집었고,
 * 그 화면은 패널이 열린 상태에서 행을 누르면 수정 모드로 바뀌는 구조라
 * 신규 저장(POST)이 기존 건 수정(PUT)으로 나가 400 이 났다.
 *
 * 시나리오 실행 오버레이 자신은 제외한다(그것도 role=dialog 다).
 */
function rootOf(): ParentNode {
  const dialogs = [...document.querySelectorAll<HTMLElement>('[role="dialog"]')]
    .filter((d) => !d.hasAttribute('data-scenario-overlay'))
    .filter(VISIBLE);
  // 여러 개면 가장 마지막(위에 뜬) 것
  return dialogs.length > 0 ? dialogs[dialogs.length - 1] : document;
}

function scopeOf(target: TargetSpec): ParentNode | null {
  const root = rootOf();
  if (!target.row) return root;
  const rows = [...root.querySelectorAll('tr')];
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
  // row 만 지정된 경우 그 행 자체가 대상이다.
  // DataGrid 는 onRowClick 으로 선택을 처리하므로 행 안에 버튼이 없는 화면이 많다.
  if (target.row && scope instanceof HTMLElement) return scope;
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
  // select 는 없는 값을 넣으면 조용히 "" 로 남는다. 그대로 두면 이 스텝이 성공으로 지나가고
  // 실패는 몇 단계 뒤 "저장 버튼이 비활성"으로 나타나 원인이 가려진다(2026-09-14 실측).
  if (input instanceof HTMLSelectElement && input.value !== value) {
    const choices = [...input.options].map((o) => o.value).filter(Boolean).join(', ');
    throw new Error(
      `${describeTarget(target)}에 "${value}"를 선택할 수 없습니다. 고를 수 있는 값: ${choices || '(없음)'}`,
    );
  }
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

// ── 실패 증거 수집 ────────────────────────────────────────────────────────
//
// 왜 이벤트만으로는 모자란가:
// 실제로 겪은 실패(2026-09-14)는 "저장 버튼이 비활성"이었다. API 도 토스트도 없으니
// 활동 링버퍼는 텅 비어 있었고, 원인(제조사 목록에 그 코드가 없어 선택이 빈 채로 남음)은
// 사람이 브라우저를 열어 select.options 를 들여다봐야만 보였다. 그건 현장 사용자가 못 한다.
// 그래서 멈춘 순간의 화면 상태를 구조화해 남긴다 — AI 가 읽을 수 있는 형태로.

export interface FieldSnapshot {
  testId?: string;
  label?: string;
  tag: string;
  value: string;
  disabled: boolean;
  /** select 일 때 고를 수 있었던 값 — "그 코드가 목록에 없었다"를 여기서 본다 */
  options?: string[];
}

export interface FailureSnapshot {
  /** 멈춘 시점의 화면 경로 */
  path: string;
  /** 모달 안이었는지 — 조작 기준점이 어디였는지가 원인 해석을 바꾼다 */
  inDialog: boolean;
  /** 대상 요소를 찾았는지, 찾았다면 어떤 상태였는지 */
  target?: { describe: string; found: boolean; tag?: string; disabled?: boolean; text?: string };
  /** 기준점 안의 입력 필드 전량 */
  fields: FieldSnapshot[];
  /** 화면에 떠 있던 빨간 문구(검증 메시지·에러) */
  messages: string[];
}

function labelOf(el: Element): string | undefined {
  const id = el.getAttribute('id');
  if (id) {
    const lab = document.querySelector(`label[for="${id}"]`);
    if (lab?.textContent) return lab.textContent.trim();
  }
  const wrap = el.closest('div')?.parentElement;
  const lab = wrap?.querySelector('label');
  return lab?.textContent?.trim() || undefined;
}

const MAX_FIELDS = 40;
const MAX_OPTIONS = 30;

export function snapshotFailure(target?: TargetSpec): FailureSnapshot {
  const root = rootOf();
  const el = target ? resolveTarget(target) : null;

  const fields: FieldSnapshot[] = [...root.querySelectorAll<HTMLElement>('input, textarea, select')]
    .filter(VISIBLE)
    .slice(0, MAX_FIELDS)
    .map((f) => {
      const input = f as HTMLInputElement | HTMLSelectElement;
      return {
        testId: f.getAttribute('data-testid') ?? undefined,
        label: labelOf(f),
        tag: f.tagName.toLowerCase(),
        value: input.value ?? '',
        disabled: isDisabled(f),
        options:
          f instanceof HTMLSelectElement
            ? [...f.options].slice(0, MAX_OPTIONS).map((o) => `${o.value}|${o.textContent?.trim() ?? ''}`)
            : undefined,
      };
    });

  // 빨간 문구만 모은다. 화면 전체 텍스트를 담으면 프롬프트가 터지고 신호가 묻힌다.
  const messages = [...(root instanceof Element ? root : document).querySelectorAll<HTMLElement>('[class*="text-red"], [role="alert"]')]
    .filter(VISIBLE)
    .map((m) => (m.textContent ?? '').trim())
    // 필수표시 * 같은 기호만 있는 것은 문구가 아니다 — 프롬프트에서 신호를 흐린다
    .filter((t) => t.length < 200 && /[\p{L}\p{N}]/u.test(t))
    .slice(0, 10);

  return {
    path: window.location.pathname,
    inDialog: root !== document,
    target: target
      ? {
          describe: describeTarget(target),
          found: !!el,
          tag: el?.tagName.toLowerCase(),
          disabled: el ? isDisabled(el) : undefined,
          text: el ? (el.textContent ?? '').trim().slice(0, 80) : undefined,
        }
      : undefined,
    fields,
    messages: [...new Set(messages)],
  };
}
