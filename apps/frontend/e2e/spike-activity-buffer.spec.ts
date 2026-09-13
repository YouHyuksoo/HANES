import { test, expect } from '@playwright/test';

/**
 * 스파이크: 활동 이벤트 수집기가 두 채널 모두에서 동작하는지 확인한다.
 *
 *   채널 B (인페이지 링버퍼)  — 드라이버가 즉시 판정하고 체인 파라미터를 읽는 곳
 *   채널 A (서버 ACTIVITY_LOGS) — 감사·실패분석용. 백엔드 AI 가 참조한다
 *
 * 규격: docs/specs/2026-09-12-scenario-runner-schema-v1-design.md
 *
 * 실행:
 *   npx playwright test e2e/spike-activity-buffer.spec.ts --project=chromium --no-deps
 */

interface ActivityEvent {
  ts: number;
  type: string;
  message?: string;
  method?: string;
  path?: string;
  status?: number;
  errorCode?: string;
  pagePath?: string;
  result?: unknown;
}

/**
 * 버퍼에 이벤트가 들어올 때까지 기다린다.
 * 링버퍼는 모듈 로드가 아니라 첫 pushActivityEvent 때 생기므로,
 * networkidle 직후에 바로 단언하면 컴파일이 느린 첫 로드에서 헛집는다.
 */
const waitForEvents = (page: import('@playwright/test').Page, timeout = 15000) =>
  page.waitForFunction(
    () => {
      const w = window as unknown as { __HANES_ACTIVITY__?: unknown[] };
      return Array.isArray(w.__HANES_ACTIVITY__) && w.__HANES_ACTIVITY__.length > 0;
    },
    undefined,
    { timeout },
  );

/** GET /system/activity-logs 응답에서 행 배열을 꺼낸다 (data 가 배열이다) */
function rowsOf(body: unknown): Array<Record<string, unknown>> {
  const data = (body as { data?: unknown })?.data;
  if (Array.isArray(data)) return data as Array<Record<string, unknown>>;
  const nested = (data as { data?: unknown })?.data;
  return Array.isArray(nested) ? (nested as Array<Record<string, unknown>>) : [];
}

const drain = (page: import('@playwright/test').Page) =>
  page.evaluate(() => {
    const w = window as unknown as { __HANES_ACTIVITY__?: ActivityEvent[] };
    const buffer = w.__HANES_ACTIVITY__ ?? [];
    w.__HANES_ACTIVITY__ = [];
    return buffer;
  }) as Promise<ActivityEvent[]>;

test('채널 B — 링버퍼에 API 호출이 쌓이고 drain 이 비운다', async ({ page }) => {
  await page.goto('/production/subprocess-kitting');
  await page.waitForLoadState('networkidle');
  expect(page.url(), '세션 만료').not.toContain('/login');

  await waitForEvents(page);

  const events = await drain(page);
  console.log('[spike] 이벤트', events.length, '건 /', [...new Set(events.map((e) => e.type))].join(', '));
  expect(events.filter((e) => e.type === 'API_CALL').length).toBeGreaterThan(0);

  expect((await drain(page)).length, 'drain 후 비어야 한다').toBe(0);
});

test('채널 A — 여러 화면을 거쳐도 서버에 계속 쌓인다 (SEQ 채번 검증)', async ({ page }) => {
  test.setTimeout(120_000); // 화면 4개를 도는 동안 첫 컴파일이 오래 걸린다
  // 같은 날 2건 이상 저장되는지가 핵심이다.
  // 이전에는 SEQ 기본값이 1이라 2건째가 ORA-00001 로 죽고 서비스가 조용히 삼켰다.
  const routes = [
    '/dashboard',
    '/production/order',
    '/production/subprocess-kitting',
    '/master/part',
  ];

  for (const route of routes) {
    await page.goto(route);
    await page.waitForLoadState('networkidle');
    // PAGE_ACCESS 는 500ms 디바운스 후 전송된다
    await page.waitForTimeout(900);
    console.log('[spike] 방문', route);
  }

  // 서버 저장은 fire-and-forget 이라 약간 기다린다
  await page.waitForTimeout(1500);

  const res = await page.request.get('http://localhost:3003/api/v1/system/activity-logs?limit=50', {
    headers: {
      Authorization: `Bearer ${await page.evaluate(() => localStorage.getItem('harness-token'))}`,
    },
  });
  const rows = rowsOf(await res.json());
  console.log('[spike] 서버 기록', Array.isArray(rows) ? rows.length : 0, '건');
  for (const r of (Array.isArray(rows) ? rows : []).slice(0, 8)) {
    console.log(`[spike]   seq=${r.seq} ${r.activityType} ${r.pagePath ?? ''} actor=${r.actorKind ?? ''}`);
  }

  expect(Array.isArray(rows) && rows.length, '서버에 한 건도 안 쌓였다').toBeGreaterThan(1);
});

test('O1 스파이크: page.pause() 중 수동 조작 가능 여부 — 2026-09-12 확인 완료(가능)', async ({ page }) => {
  test.skip(!process.env.SPIKE_PAUSE, 'SPIKE_PAUSE=1 일 때만 실행 (사람이 지켜봐야 한다)');
  await page.goto('/production/subprocess-kitting');
  await page.pause();
});

test('실패 메시지가 링버퍼와 서버 양쪽에 남는다 (AI 원인분석의 전제)', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto('/production/subprocess-kitting');
  await page.waitForLoadState('networkidle');
  await waitForEvents(page);
  await drain(page);

  // 작업지시 스캔칸은 설비를 고르기 전까지 비활성이다 → 설비부터 선택한다
  await page.getByRole('button', { name: '설비를 선택하세요', exact: true }).click();
  await page.getByText('EQ-SHDCT-HV-01', { exact: false }).first().click();
  await page.waitForTimeout(1500);
  await drain(page);

  // 존재하지 않는 SFG 라벨을 화면에서 스캔한다 → 화면이 평소대로 API를 치고 실패한다.
  // (작업지시 스캔칸은 설비에 지시가 이미 물려 있으면 칩으로 바뀌어 사라진다)
  const scan = page.locator('input[placeholder*="이전 공정 SFG"]').first();
  await scan.fill('SG-NO-SUCH-LABEL-9999');
  await scan.press('Enter');
  await page.waitForTimeout(3000);

  const events = await drain(page);
  const errors = events.filter((e) => e.type === 'API_ERROR' || e.type === 'TOAST_ERROR');
  console.log('[spike] 에러 이벤트', errors.length, '건');
  for (const e of errors) {
    console.log(`[spike]   ${e.type} ${e.method ?? ''} ${e.path ?? ''} ${e.status ?? ''} "${e.message ?? ''}"`);
  }
  expect(errors.length, '실패가 이벤트로 안 잡혔다').toBeGreaterThan(0);
  expect(errors.some((e) => (e.message ?? '').length > 0), '메시지가 비어 있으면 AI가 분석할 수 없다').toBe(true);

  // 서버에도 같은 실패가 남아야 백엔드 AI 가 볼 수 있다
  await page.waitForTimeout(2000);
  const res = await page.request.get(
    'http://localhost:3003/api/v1/system/activity-logs?limit=20&activityType=API_ERROR',
    { headers: { Authorization: `Bearer ${await page.evaluate(() => localStorage.getItem('harness-token'))}` } },
  );
  const rows = rowsOf(await res.json());
  console.log('[spike] 서버 API_ERROR 기록', rows.length, '건');
  for (const r of rows.slice(0, 3)) console.log(`[spike]   seq=${r.seq} "${r.message}"`);
  expect(rows.length, '서버에 실패 기록이 없으면 백엔드 AI 가 분석할 수 없다').toBeGreaterThan(0);
});
