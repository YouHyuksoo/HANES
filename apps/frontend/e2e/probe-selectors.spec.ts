import { test } from '@playwright/test';

/**
 * 임시 프로브: 시나리오를 쓰기 위해 실제 화면의 셀렉터를 뽑는다.
 * 시나리오 작성이 끝나면 지운다.
 *
 *   PROBE_ROUTE=/production/subprocess-kitting npx playwright test e2e/probe-selectors.spec.ts --project=chromium --no-deps
 */
test('화면의 버튼/입력/testid 를 나열한다', async ({ page }) => {
  // 시나리오 작성용 도구다. 일반 e2e 실행에서는 돌지 않게 한다.
  test.setTimeout(120_000);
  test.skip(!process.env.PROBE_ROUTE, 'PROBE_ROUTE=<경로> 를 지정했을 때만 실행한다');
  const route = process.env.PROBE_ROUTE ?? '/production/subprocess-kitting';
  await page.goto(route);
  await page.waitForLoadState('networkidle');
  if (page.url().includes('/login')) throw new Error('세션 만료');

  const dump = await page.evaluate(() => {
    const text = (el: Element) => (el.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 60);
    const visible = (el: Element) => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    };
    return {
      buttons: [...document.querySelectorAll('button')]
        .filter(visible)
        .map((b) => ({ text: text(b), testId: b.getAttribute('data-testid'), disabled: (b as HTMLButtonElement).disabled }))
        .filter((b) => b.text || b.testId),
      inputs: [...document.querySelectorAll('input, textarea, select')]
        .filter(visible)
        .map((i) => ({
          placeholder: i.getAttribute('placeholder'),
          ariaLabel: i.getAttribute('aria-label'),
          testId: i.getAttribute('data-testid'),
          type: i.getAttribute('type'),
        })),
      testIds: [...document.querySelectorAll('[data-testid]')].map((e) => e.getAttribute('data-testid')),
      headings: [...document.querySelectorAll('h1,h2,h3')].filter(visible).map(text),
    };
  });

  console.log('=== ROUTE ===', route);
  console.log('=== BUTTONS ===');
  for (const b of dump.buttons) console.log(`  "${b.text}"${b.testId ? ` [testId=${b.testId}]` : ''}${b.disabled ? ' (disabled)' : ''}`);
  console.log('=== INPUTS ===');
  for (const i of dump.inputs) console.log(`  placeholder="${i.placeholder ?? ''}" aria="${i.ariaLabel ?? ''}" testId="${i.testId ?? ''}" type=${i.type ?? ''}`);
  console.log('=== TESTIDS ===', JSON.stringify(dump.testIds));
  console.log('=== HEADINGS ===', JSON.stringify(dump.headings));
});
