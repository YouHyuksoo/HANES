/**
 * @file e2e/scenario-runner/selector.ts
 * @description target 해석 (규격서 5절)
 *
 * 우선순위: testId -> role+name -> label -> ariaLabel -> placeholder -> text
 * label 이 3순위인 이유: HANES 폼은 aria-label 이 아니라 가시 <label> 텍스트로
 * 필드를 식별한다(기존 ui-test-crud-red 러너 실측). 규격서 5.2 참조.
 */
import type { Locator, Page } from '@playwright/test';
import type { TargetSpec } from './types';

/** target 에 해석 가능한 키가 하나도 없으면 파싱 단계에서 걸러야 한다 */
export function hasResolvableKey(target: TargetSpec): boolean {
  return Boolean(
    target.testId
    || (target.role && target.name)
    || target.label
    || target.ariaLabel
    || target.placeholder
    || target.text
    || target.nthButton !== undefined,
  );
}

/** 행 스코프가 있으면 그 tr 로, 없으면 페이지 전체로 */
function scopeOf(page: Page, target: TargetSpec, render: (v: string) => string) {
  if (!target.row) return page;
  return page.locator('tr', { hasText: render(target.row) }).first();
}

export function resolveTarget(
  page: Page,
  target: TargetSpec,
  render: (value: string) => string,
): Locator {
  const scope = scopeOf(page, target, render);

  if (target.testId) return scope.getByTestId(render(target.testId)).first();
  if (target.role && target.name) {
    return scope
      .getByRole(target.role as Parameters<Page['getByRole']>[0], {
        name: render(target.name),
        exact: true,
      })
      .first();
  }
  if (target.label) {
    // label:has-text(...) 의 형제 input/textarea 로 올라간다 (M1)
    return scope
      .locator(`label:has-text("${render(target.label)}")`)
      .locator('..')
      .locator('input, textarea, select')
      .first();
  }
  if (target.ariaLabel) return scope.getByLabel(render(target.ariaLabel)).first();
  if (target.placeholder) {
    return scope.locator(`input[placeholder*="${render(target.placeholder)}"]`).first();
  }
  if (target.text) return scope.getByText(render(target.text), { exact: false }).first();
  if (target.nthButton !== undefined) return scope.locator('button').nth(target.nthButton);

  throw new Error(`해석할 수 없는 target: ${JSON.stringify(target)}`);
}

/** 사람이 읽는 설명 — 리포트와 에러 메시지에 쓴다 */
export function describeTarget(target: TargetSpec): string {
  const inner =
    target.testId ? `testId=${target.testId}`
    : target.role && target.name ? `${target.role}["${target.name}"]`
    : target.label ? `label="${target.label}"`
    : target.ariaLabel ? `aria="${target.ariaLabel}"`
    : target.placeholder ? `placeholder~"${target.placeholder}"`
    : target.text ? `text~"${target.text}"`
    : target.nthButton !== undefined ? `button[${target.nthButton}]`
    : '?';
  return target.row ? `row("${target.row}") > ${inner}` : inner;
}
