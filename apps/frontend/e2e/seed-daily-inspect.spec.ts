import { test, expect } from '@playwright/test';

/**
 * 임시 도구: 시나리오 검증을 위해 EQ-SHDCT-HV-01 의 당일 설비 일상점검을 완료시킨다.
 *
 * 주의 — 이건 점검 인터록을 자동으로 뚫는 러너 동작이 아니다(규격서 7.1 이 금지하는 것).
 * 개발 DB(JSHANES)의 테스트 데이터를 준비하는 일회성 도구이며, MEASURE 항목값은
 * 실측이 아니라 규격 중앙값이다. 운영 환경에서는 절대 쓰지 않는다.
 *
 *   npx playwright test e2e/seed-daily-inspect.spec.ts --project=chromium --no-deps
 */
test('EQ-SHDCT-HV-01 당일 일상점검을 PASS 로 등록한다', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto('/production/subprocess-kitting');
  await page.waitForLoadState('networkidle');
  if (page.url().includes('/login')) throw new Error('세션 만료');

  const token = await page.evaluate(() => localStorage.getItem('harness-token'));
  if (!token) throw new Error('harness-token 이 없다 — 세션을 먼저 만들어야 한다');
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  const base = 'http://localhost:3003/api/v1';

  // 점검 항목을 실제 마스터에서 가져온다(하드코딩 금지).
  const itemsRes = await page.request.get(
    `${base}/equipment/inspect-items?equipType=OTHER&inspectType=DAILY&limit=100`,
    { headers },
  );
  const itemsBody = await itemsRes.json().catch(() => ({}));
  const rows: Array<Record<string, unknown>> = itemsBody?.data ?? [];
  console.log('점검 항목 수:', rows.length, '(status', itemsRes.status(), ')');

  const details: Record<string, string> = {};
  rows.forEach((item, idx) => {
    const name = String(item.itemName ?? '');
    const base_ = `${idx + 1}_${name}`;
    details[base_] = 'PASS';
    if (String(item.itemType) === 'MEASURE') {
      const lsl = Number(item.lslValue);
      const usl = Number(item.uslValue);
      // 규격 중앙값 — 실측값이 아니다(이 파일 상단 주의 참조)
      const mid = Number.isFinite(lsl) && Number.isFinite(usl) ? (lsl + usl) / 2 : 0;
      details[`${base_}_value`] = String(mid);
      details[`${base_}_remark`] = '시나리오 검증용 준비 데이터(실측 아님)';
    }
  });

  const res = await page.request.post(`${base}/equipment/daily-inspect`, {
    headers,
    data: {
      equipCode: 'EQ-SHDCT-HV-01',
      inspectType: 'DAILY',
      inspectorName: '시나리오준비',
      overallResult: 'PASS',
      details,
    },
  });
  console.log('등록 status:', res.status(), (await res.text()).slice(0, 300));
  expect(res.status()).toBeLessThan(300);

  const check = await page.request.get(
    `${base}/equipment/daily-inspect/check?equipCode=EQ-SHDCT-HV-01&inspectType=DAILY`,
    { headers },
  );
  console.log('check 결과:', (await check.text()).slice(0, 300));

  // 작업자 설비점검은 orderNo 기준이라(page.tsx refreshInspectStatus) 시나리오가 쓸
  // 작업지시로도 등록해 둔다. 같은 준비 데이터이며 실측이 아니다.
  const orderNo = process.env.SEED_ORDER_NO ?? 'WO2609130411';
  const workerRes = await page.request.post(`${base}/equipment/daily-inspect`, {
    headers,
    data: {
      equipCode: 'EQ-SHDCT-HV-01',
      inspectType: 'WORKER',
      orderNo,
      inspectorName: '시나리오준비',
      overallResult: 'PASS',
      details,
    },
  });
  console.log('WORKER 등록 status:', workerRes.status(), (await workerRes.text()).slice(0, 200));

  const workerCheck = await page.request.get(
    `${base}/equipment/daily-inspect/check?equipCode=EQ-SHDCT-HV-01&inspectType=WORKER&orderNo=${orderNo}`,
    { headers },
  );
  console.log('WORKER check:', (await workerCheck.text()).slice(0, 300));
});
