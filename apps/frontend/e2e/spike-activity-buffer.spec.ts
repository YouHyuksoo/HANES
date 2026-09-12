import { test, expect } from '@playwright/test';

/**
 * 스파이크: 활동 이벤트 링버퍼가 Playwright에서 읽히는지 확인한다.
 *
 * 시나리오 실행기(docs/specs/2026-09-12-scenario-runner-schema-v1-design.md)는
 * 스텝 판정을 전적으로 이 버퍼에 의존한다. 러너 코드를 쓰기 전에
 * "읽힌다 / 설정과 무관하게 쌓인다 / drain 이 동작한다"를 먼저 못 박는다.
 *
 * 실행:
 *   npx playwright test e2e/spike-activity-buffer.spec.ts --project=chromium --no-deps
 *   (--no-deps 로 저장된 세션을 그대로 재사용. 세션이 만료됐으면 로그인 화면으로 튄다)
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
}

const drain = (page: import('@playwright/test').Page) =>
  page.evaluate(() => {
    const w = window as unknown as { __HANES_ACTIVITY__?: ActivityEvent[] };
    const buffer = w.__HANES_ACTIVITY__ ?? [];
    w.__HANES_ACTIVITY__ = [];
    return buffer;
  }) as Promise<ActivityEvent[]>;

test('링버퍼가 존재하고 API 호출 이벤트가 쌓인다', async ({ page }) => {
  await page.goto('/production/subprocess-kitting');

  // 세션이 살아 있는지 먼저 확인 — 만료면 /login 으로 튄다
  await page.waitForLoadState('networkidle');
  const url = page.url();
  console.log('[spike] 현재 URL:', url);
  expect(url, '세션 만료 — E2E_EMAIL/E2E_PASSWORD 로 setup 프로젝트를 먼저 돌려야 한다').not.toContain('/login');

  const exists = await page.evaluate(() =>
    Array.isArray((window as unknown as { __HANES_ACTIVITY__?: unknown[] }).__HANES_ACTIVITY__),
  );
  expect(exists, 'window.__HANES_ACTIVITY__ 가 없다 — ActivityCollector 마운트 확인').toBe(true);

  const events = await drain(page);
  console.log('[spike] 수집된 이벤트 수:', events.length);
  console.log('[spike] 이벤트 종류:', [...new Set(events.map((e) => e.type))].join(', '));
  for (const e of events.slice(0, 12)) {
    console.log(`[spike]   ${e.type} ${e.method ?? ''} ${e.path ?? ''} ${e.status ?? ''} ${e.message ?? ''}`);
  }

  // 화면 진입만 해도 API_CALL 이 최소 1건은 있어야 한다
  expect(events.filter((e) => e.type === 'API_CALL').length).toBeGreaterThan(0);

  // drain 이 실제로 비웠는지
  const after = await drain(page);
  expect(after.length, 'drain 후에도 남아 있으면 버퍼를 비우지 못한 것').toBe(0);
});

test('의도적 API 에러가 API_ERROR 이벤트로 잡힌다', async ({ page }) => {
  await page.goto('/production/subprocess-kitting');
  await page.waitForLoadState('networkidle');
  test.skip(page.url().includes('/login'), '세션 만료');

  await drain(page);

  // 존재하지 않는 작업지시를 조회해 404/400 을 유도한다
  await page.evaluate(async () => {
    const token = localStorage.getItem('harness-token');
    await fetch('/api/v1/production/job-orders/order-no/__NO_SUCH_ORDER__', {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    }).catch(() => {});
  });

  // 주: 위는 fetch 직접 호출이라 axios 인터셉터를 타지 않는다.
  // 인터셉터 경로를 확인하려면 화면 조작이 필요하므로, 여기서는 버퍼 읽기 자체만 검증한다.
  const events = await drain(page);
  console.log('[spike] 에러 유도 후 이벤트:', JSON.stringify(events, null, 2));
});

test('O1 스파이크: page.pause() 중 수동 조작 가능 여부', async ({ page }) => {
  test.skip(!process.env.SPIKE_PAUSE, 'SPIKE_PAUSE=1 일 때만 실행 (사람이 지켜봐야 한다)');

  await page.goto('/production/subprocess-kitting');
  console.log('[spike] page.pause() 진입 — Inspector 가 열린다.');
  console.log('[spike] 확인할 것: 브라우저 창에서 직접 클릭/입력이 되는가?');
  console.log('[spike] 확인 후 Inspector 의 Resume 을 눌러라.');
  await page.pause();
  console.log('[spike] Resume 됨 — 조작 가능했는지 사람이 판단.');
});
