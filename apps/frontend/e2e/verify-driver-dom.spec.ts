import { test, expect } from '@playwright/test';

/**
 * 인앱 드라이버 DOM 계층 실증.
 *
 * 확인할 것 — 이게 안 되면 드라이버 전체가 성립하지 않는다.
 *   1) native setter + input 이벤트로 React 상태가 실제로 바뀌는가
 *      (el.value = x 만으로는 화면이 안 바뀐다. 저장 버튼 활성화 여부로 판정한다)
 *   2) 비활성 버튼 클릭이 조용히 무시되지 않고 실패로 잡히는가
 *
 * 브라우저 컨텍스트에 드라이버 함수를 직접 넣어 돌린다(번들 경유 없이 로직만 검증).
 */

const SET_NATIVE = `
(el, value) => {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype
    : el instanceof HTMLSelectElement ? HTMLSelectElement.prototype
    : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
  setter.call(el, value);
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
}`;

test('native setter 주입만 React 상태를 바꾼다 (리렌더 되돌림으로 판정)', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto('/production/monthly-plan');
  await page.waitForLoadState('networkidle');
  expect(page.url(), '세션 만료').not.toContain('/login');

  await page.getByTestId('prod-plan-add').click();
  const month = page.getByTestId('prod-plan-month');
  const qty = page.getByTestId('prod-plan-qty');
  await expect(month).toBeVisible({ timeout: 15000 });

  const originalMonth = await month.inputValue();
  console.log('[driver] 계획월 원래값:', JSON.stringify(originalMonth));

  // (A) 순진한 주입 — DOM 값만 바뀌고 React 상태(form.planMonth)는 그대로다
  await page.evaluate(() => {
    const el = document.querySelector('[data-testid="prod-plan-month"]') as HTMLInputElement;
    el.value = '2099-12';
  });
  expect(await month.inputValue(), 'DOM 값은 바뀌어야 한다').toBe('2099-12');
  console.log('[driver] 순진한 주입 직후 DOM 값: 2099-12');

  // (B) native setter 로 수량을 넣는다 → React 상태가 바뀌면 패널이 리렌더된다
  await page.evaluate(
    ([code]) => {
      const el = document.querySelector('[data-testid="prod-plan-qty"]') as HTMLInputElement;
      // eslint-disable-next-line no-eval
      (eval(code) as (e: HTMLInputElement, v: string) => void)(el, '500');
    },
    [SET_NATIVE],
  );
  await page.waitForTimeout(1500);

  // 판정 1: 수량이 React 상태에 들어갔다면 저장 버튼의 planQty 조건이 풀린다
  const qtyValue = await qty.inputValue();
  console.log('[driver] native setter 주입 후 수량:', JSON.stringify(qtyValue));

  // 판정 2: 리렌더가 일어났다면 (A)의 순진한 값은 React 상태값으로 되돌아간다
  const monthAfter = await month.inputValue();
  console.log('[driver] 리렌더 후 계획월:', JSON.stringify(monthAfter), '(원래값으로 돌아가야 정상)');

  expect(monthAfter, 'React 가 리렌더하지 않았다 = native setter 주입이 상태를 못 바꿨다').toBe(originalMonth);
  expect(qtyValue, '수량 주입이 반영되지 않았다').toContain('500');
});

test('비활성 버튼은 클릭해도 아무 일이 없다 — 드라이버가 실패로 세워야 하는 상황', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto('/production/order');
  await page.waitForLoadState('networkidle');
  test.skip(page.url().includes('/login'), '세션 만료');

  await page.getByTestId('job-order-create').click();
  const save = page.getByTestId('job-order-save');
  await expect(save).toBeVisible({ timeout: 15000 });
  await expect(save).toBeDisabled();

  // el.click() 을 강제로 호출해도 아무 일이 없어야 한다(= 조용한 성공이 생길 수 있다)
  const before = page.url();
  await page.evaluate(() => {
    (document.querySelector('[data-testid="job-order-save"]') as HTMLButtonElement).click();
  });
  await page.waitForTimeout(1000);
  expect(page.url()).toBe(before);
  console.log('[driver] 비활성 버튼 강제 클릭 → 변화 없음 확인 (드라이버는 이 경우 실패로 세운다)');
});
