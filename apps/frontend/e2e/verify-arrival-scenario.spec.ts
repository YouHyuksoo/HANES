import { test, expect, type Page } from '@playwright/test';

/**
 * mat-arrival-po-line 시나리오 실증 — 작성 스킬이 요구하는 1회 실행 검증.
 *
 * **JSHANES 에 입하를 실제로 1건 등록한다.** 사용자 승인을 받고 돌린다.
 * 자동 회귀에 넣지 않는다(RUN_WRITE=1 일 때만).
 *
 * 여기서 Playwright 는 사용자 역할만 한다 — 실행 요청, 계획 승인, 저장 승인.
 * 화면 조작(이동·클릭·입력·select)은 전부 인앱 드라이버가 한다.
 * 이 시나리오가 특히 확인하려는 것은 3단 모달이다:
 *   PO 라인 그리드 → 입하 모달 → 시리얼 발급 확인 모달.
 */
async function waitForDriver(page: Page): Promise<void> {
  await page.waitForFunction(
    () => typeof (window as unknown as { __SCENARIO_RUN__?: unknown }).__SCENARIO_RUN__ === 'function',
    undefined,
    { timeout: 30000 },
  );
}

test('드라이버가 PO 라인을 찾아 입하를 등록한다', async ({ page }) => {
  test.skip(!process.env.RUN_WRITE, 'RUN_WRITE=1 일 때만 실행 — 실데이터를 생성한다');
  test.setTimeout(180_000);

  const itemCode = process.env.ARRIVAL_ITEM ?? '6TBE11A000';
  const qty = process.env.ARRIVAL_QTY ?? '100';

  // 다른 화면에서 시작한다 — 드라이버가 스스로 이동해야 한다
  await page.goto('/dashboard');
  await page.waitForLoadState('networkidle');
  expect(page.url(), '세션 만료').not.toContain('/login');

  await waitForDriver(page);
  const token = await page.evaluate(() => localStorage.getItem('harness-token'));
  const scnRes = await page.request.get('http://localhost:3003/api/v1/ai/scenarios/mat-arrival-po-line', {
    headers: { Authorization: `Bearer ${token}` },
  });
  const scenario = (await scnRes.json())?.data;
  expect(scenario?.id, '시나리오를 서버에서 받지 못했다').toBe('mat-arrival-po-line');

  const before = await page.request.get(
    'http://localhost:3003/api/v1/material/arrivals/po-lines',
    { headers: { Authorization: `Bearer ${token}`, 'X-Company': '40', 'X-Plant': '1000' } },
  );
  const beforeLine = ((await before.json())?.data ?? []).find(
    (r: { itemCode: string }) => r.itemCode === itemCode,
  );
  console.log('[arrival] 실행 전 잔량:', beforeLine?.remainingQty);

  await page.evaluate(
    ([s, vars]) => {
      const w = window as unknown as { __SCENARIO_RUN__?: (s: unknown, v: unknown) => void };
      w.__SCENARIO_RUN__!(s, vars);
    },
    [scenario, { itemCode, qty }] as [unknown, unknown],
  );

  const overlay = page.getByRole('dialog', { name: '시나리오 실행' });
  await expect(overlay).toBeVisible({ timeout: 15000 });
  await expect(overlay).toContainText('실제 저장');

  await overlay.getByRole('button', { name: '실행' }).click();

  // 드라이버가 이동 → 행 버튼 → 수량/제조사/창고 → 저장까지 스스로 와야 한다
  await expect(overlay).toContainText('다음 단계는 실제 데이터를 저장합니다', { timeout: 120000 });
  console.log('[arrival] 저장 직전 확인 요청 — 여기까지 드라이버가 왔다');

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

  const state = await page.evaluate(() => {
    const w = window as unknown as { __SCENARIO_STATE__?: () => Record<string, unknown> };
    return w.__SCENARIO_STATE__?.() ?? null;
  });
  const results = (state as Record<string, unknown[]>)?.results ?? [];
  for (const r of results as Array<Record<string, unknown>>) {
    console.log(`[arrival]   ${r.index} ${r.verdict} ${r.note ?? ''}${r.error ? ` :: ${r.error}` : ''}`);
  }
  const status = String((state as Record<string, unknown>)?.status);
  expect(status, `실행이 완료되지 않았다: ${JSON.stringify((state as Record<string, unknown>)?.failure)}`).toBe('done');

  // 잔량이 실제로 줄었는지 — 화면 판정이 아니라 서버 데이터로 확인한다
  const after = await page.request.get(
    'http://localhost:3003/api/v1/material/arrivals/po-lines',
    { headers: { Authorization: `Bearer ${token}`, 'X-Company': '40', 'X-Plant': '1000' } },
  );
  const afterLine = ((await after.json())?.data ?? []).find(
    (r: { itemCode: string }) => r.itemCode === itemCode,
  );
  console.log('[arrival] 실행 후 잔량:', afterLine?.remainingQty);
  expect(Number(afterLine?.remainingQty)).toBe(Number(beforeLine?.remainingQty) - Number(qty));
});
