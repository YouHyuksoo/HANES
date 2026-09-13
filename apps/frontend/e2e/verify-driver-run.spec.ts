import { test, expect } from '@playwright/test';

/**
 * 인앱 드라이버 실행 검증 — 사람이 쓰듯 화면이 스스로 움직이는지.
 *
 * Playwright 는 "사용자 역할"만 한다(요청 주입 + 확인 버튼 클릭).
 * 화면 조작은 전부 인앱 드라이버가 한다 — 그게 검증 대상이다.
 *
 * 쓰기 스텝은 넣지 않는다. 실데이터를 만들지 않고 드라이버 동작만 본다.
 */

const SCENARIO = {
  schemaVersion: 1,
  id: 'driver-smoke',
  title: '드라이버 스모크 (읽기 전용)',
  description: '생산계획 화면으로 이동해 계획 추가 패널을 열고 수량을 입력한다. 저장하지 않는다.',
  startRoute: '/production/monthly-plan',
  params: { planQty: { label: '계획수량', required: true, type: 'number' } },
  steps: [
    { action: 'goto', value: '/production/monthly-plan', note: '생산계획 화면으로 이동' },
    { action: 'click', target: { testId: 'prod-plan-add' }, note: '계획 추가 패널 열기' },
    { action: 'fill', target: { testId: 'prod-plan-qty' }, value: '{{planQty}}', note: '계획수량 입력' },
    { action: 'capture', target: { testId: 'prod-plan-qty' }, as: 'echoQty', note: '입력된 수량 확인' },
  ],
};

test('드라이버가 화면을 스스로 조작한다', async ({ page }) => {
  test.setTimeout(120_000);
  // 다른 화면에서 시작한다 — 드라이버가 스스로 이동해야 한다
  await page.goto('/dashboard');
  await page.waitForLoadState('networkidle');
  expect(page.url(), '세션 만료').not.toContain('/login');

  // 사용자(=AI)가 실행을 요청하는 자리. 실제로는 채팅 응답이 이걸 호출한다.
  await page.evaluate((scenario) => {
    const w = window as unknown as { __SCENARIO_RUN__?: (s: unknown, v: Record<string, string>) => void };
    if (!w.__SCENARIO_RUN__) throw new Error('드라이버가 전역에 노출되지 않았습니다.');
    w.__SCENARIO_RUN__(scenario, { planQty: '777' });
  }, SCENARIO);

  // 계획 확인 화면이 떠야 한다
  const overlay = page.getByRole('dialog', { name: '시나리오 실행' });
  await expect(overlay).toBeVisible({ timeout: 10000 });
  await expect(overlay).toContainText('생산계획 화면으로 이동');
  console.log('[run] 실행 계획 표시 확인');

  // 사용자 승인
  await overlay.getByRole('button', { name: '실행' }).click();

  // 드라이버가 스스로 화면을 옮기고 조작한다
  await expect(overlay).toContainText('완료', { timeout: 40000 });
  await page.waitForTimeout(2000);

  const state = await page.evaluate(() => {
    const w = window as unknown as { __SCENARIO_STATE__?: () => Record<string, unknown> };
    return w.__SCENARIO_STATE__?.() ?? null;
  });
  console.log('[run] 최종 상태:', JSON.stringify(state));

  expect(page.url(), '드라이버가 화면을 옮기지 못했다').toContain('/production/monthly-plan');
  expect(String((state as Record<string, unknown>)?.status), '실행이 완료되지 않았다').toBe('done');
  expect(String(((state as Record<string, Record<string, string>>)?.vars)?.echoQty), '입력이 반영되지 않았다').toContain('777');
  console.log('[run] 이동·클릭·입력·캡처 전부 드라이버가 수행함');
});
