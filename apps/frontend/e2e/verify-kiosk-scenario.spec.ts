import { test, expect, type Page } from '@playwright/test';

/**
 * kiosk-prod-result 시나리오 실증.
 *
 * 기본은 **저장 직전까지만** 돌린다(데이터 변경 없음). 저장까지 확인하려면 RUN_WRITE=1.
 * 여기서 Playwright 는 사용자 역할만 한다 — 요청, 계획 승인, (쓰기 승인).
 * 화면 조작은 전부 인앱 드라이버가 한다.
 */
async function waitForDriver(page: Page): Promise<void> {
  await page.waitForFunction(
    () => typeof (window as unknown as { __SCENARIO_RUN__?: unknown }).__SCENARIO_RUN__ === 'function',
    undefined,
    { timeout: 30000 },
  );
}

test('드라이버가 키오스크에서 실적 저장 직전까지 준비를 끝낸다', async ({ page }) => {
  test.setTimeout(300_000);

  const vars = {
    equipCode: process.env.KIOSK_EQUIP ?? 'EQ-ATCNS-HV-01',
    orderNo: process.env.KIOSK_ORDER ?? 'WO2609110377',
    workerCode: process.env.KIOSK_WORKER ?? 'N91H00_WK01',
    qty: process.env.KIOSK_QTY ?? '10',
  };

  await page.goto('/dashboard');
  await page.waitForLoadState('networkidle');
  expect(page.url(), '세션 만료').not.toContain('/login');
  await waitForDriver(page);

  const token = await page.evaluate(() => localStorage.getItem('harness-token'));
  const scnRes = await page.request.get('http://localhost:3003/api/v1/ai/scenarios/kiosk-prod-result', {
    headers: { Authorization: `Bearer ${token}` },
  });
  const scenario = (await scnRes.json())?.data;
  expect(scenario?.id).toBe('kiosk-prod-result');

  await page.evaluate(
    ([s, v]) => {
      const w = window as unknown as { __SCENARIO_RUN__?: (s: unknown, v: unknown) => void };
      w.__SCENARIO_RUN__!(s, v);
    },
    [scenario, vars] as [unknown, unknown],
  );

  const overlay = page.getByRole('dialog', { name: '시나리오 실행' });
  await expect(overlay).toBeVisible({ timeout: 15000 });
  await overlay.getByRole('button', { name: '실행' }).click();

  // 저장 직전 확인까지 오면 준비 14단계가 전부 통과했다는 뜻이다
  await page.waitForFunction(
    () => {
      const w = window as unknown as { __SCENARIO_STATE__?: () => { status?: string } };
      const st = w.__SCENARIO_STATE__?.().status;
      return st === 'awaitWrite' || st === 'failed' || st === 'done';
    },
    undefined,
    { timeout: 240000 },
  );

  const dump = async () => {
    const state = await page.evaluate(() => {
      const w = window as unknown as { __SCENARIO_STATE__?: () => Record<string, unknown> };
      return w.__SCENARIO_STATE__?.() ?? null;
    });
    for (const r of ((state as Record<string, unknown[]>)?.results ?? []) as Array<Record<string, unknown>>) {
      console.log(`[kiosk]   ${r.index} ${r.verdict} ${r.note ?? ''}${r.error ? ` :: ${r.error}` : ''}`);
    }
    return state as Record<string, unknown>;
  };

  let state = await dump();
  expect(
    String(state?.status),
    `준비 단계에서 멈췄다: ${JSON.stringify(state?.failure)}`,
  ).toBe('awaitWrite');
  console.log('[kiosk] 준비 완료 — 저장 직전까지 드라이버가 스스로 왔다');

  if (!process.env.RUN_WRITE) {
    await overlay.getByRole('button', { name: '중단' }).click();
    console.log('[kiosk] RUN_WRITE 없음 — 저장하지 않고 중단');
    return;
  }

  await overlay.getByRole('button', { name: '저장 진행' }).click();
  await page.waitForFunction(
    () => {
      const w = window as unknown as { __SCENARIO_STATE__?: () => { status?: string } };
      const st = w.__SCENARIO_STATE__?.().status;
      return st === 'done' || st === 'failed';
    },
    undefined,
    { timeout: 120000 },
  );
  state = await dump();
  expect(String(state?.status), `저장이 완료되지 않았다: ${JSON.stringify(state?.failure)}`).toBe('done');
});
