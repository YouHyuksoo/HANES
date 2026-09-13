import { test, expect } from '@playwright/test';

/**
 * 쓰기 흐름 실증 — awaitWrite(저장 직전 확인)와 실제 저장까지.
 *
 * **이 테스트는 JSHANES 에 작업지시를 실제로 1건 생성한다.**
 * 사용자 승인을 받고 돌린다. 자동 회귀에 넣지 않는다(RUN_WRITE=1 일 때만).
 *
 * Playwright 는 사용자 역할만 한다 — 실행 요청, 계획 승인, 저장 승인.
 * 화면 조작은 전부 인앱 드라이버가 한다.
 */
test('드라이버가 저장 직전에 확인을 받고 실제로 작업지시를 만든다', async ({ page }) => {
  test.skip(!process.env.RUN_WRITE, 'RUN_WRITE=1 일 때만 실행 — 실데이터를 생성한다');
  test.setTimeout(180_000);

  const itemCode = process.env.WRITE_ITEM ?? 'N91H00-X9800';
  const planQty = process.env.WRITE_QTY ?? '10';
  const planDate = process.env.WRITE_DATE ?? new Date().toISOString().slice(0, 10);

  // 다른 화면에서 시작한다 — 드라이버가 스스로 이동해야 한다
  await page.goto('/dashboard');
  await page.waitForLoadState('networkidle');
  expect(page.url(), '세션 만료').not.toContain('/login');

  const token = await page.evaluate(() => localStorage.getItem('harness-token'));
  const scnRes = await page.request.get('http://localhost:3003/api/v1/ai/scenarios/job-order-create', {
    headers: { Authorization: `Bearer ${token}` },
  });
  const scenario = (await scnRes.json())?.data;
  expect(scenario?.id, '시나리오를 서버에서 받지 못했다').toBe('job-order-create');

  // 사용자(=AI)가 실행을 요청하는 자리
  await page.evaluate(
    ([s, vars]) => {
      const w = window as unknown as { __SCENARIO_RUN__?: (s: unknown, v: unknown) => void };
      w.__SCENARIO_RUN__!(s, vars);
    },
    [scenario, { itemCode, planQty, planDate }] as [unknown, unknown],
  );

  const overlay = page.getByRole('dialog', { name: '시나리오 실행' });
  await expect(overlay).toBeVisible({ timeout: 15000 });
  // 계획에 "실제 저장" 단계가 표시돼야 한다
  await expect(overlay).toContainText('실제 저장');
  console.log('[write] 실행 계획에 저장 단계 표시 확인');

  await overlay.getByRole('button', { name: '실행' }).click();

  // 드라이버가 이동·클릭·검색·선택·입력을 거쳐 저장 직전에 멈춰야 한다
  await expect(overlay).toContainText('다음 단계는 실제 데이터를 저장합니다', { timeout: 90000 });
  console.log('[write] 저장 직전 확인 요청 — 드라이버가 스스로 여기까지 왔다');

  // 아직 저장 전이어야 한다
  const beforeSave = await page.request.get(
    `http://localhost:3003/api/v1/production/job-orders?search=${itemCode}&limit=200`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  const beforeRows = (await beforeSave.json())?.data ?? [];
  console.log('[write] 승인 전 작업지시 건수:', Array.isArray(beforeRows) ? beforeRows.length : '?');

  await overlay.getByRole('button', { name: '저장 진행' }).click();
  console.log('[write] 사용자가 저장 승인');

  // 오버레이의 '완료'는 스텝 판정 표시에도 쓰이므로 텍스트로 기다리면 일찍 통과한다.
  // 실행 상태가 끝났는지로 기다린다.
  await page.waitForFunction(
    () => {
      const w = window as unknown as { __SCENARIO_STATE__?: () => { status?: string } };
      const st = w.__SCENARIO_STATE__?.().status;
      return st === 'done' || st === 'failed';
    },
    undefined,
    { timeout: 90000 },
  );

  const state = await page.evaluate(() => {
    const w = window as unknown as { __SCENARIO_STATE__?: () => Record<string, unknown> };
    return w.__SCENARIO_STATE__?.() ?? null;
  });
  const status = String((state as Record<string, unknown>)?.status);
  const results = (state as Record<string, unknown[]>)?.results ?? [];
  for (const r of results as Array<Record<string, unknown>>) {
    console.log(`[write]   ${r.index} ${r.verdict} ${r.note ?? ''}${r.error ? ` :: ${r.error}` : ''}`);
  }
  expect(status, `실행이 완료되지 않았다: ${JSON.stringify((state as Record<string, unknown>)?.failure)}`).toBe('done');

  const afterSave = await page.request.get(
    `http://localhost:3003/api/v1/production/job-orders?search=${itemCode}&limit=200`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  const afterRows = (await afterSave.json())?.data ?? [];
  console.log('[write] 승인 후 작업지시 건수:', Array.isArray(afterRows) ? afterRows.length : '?');
  expect((afterRows as unknown[]).length, '작업지시가 실제로 생성되지 않았다').toBeGreaterThan((beforeRows as unknown[]).length);
});
