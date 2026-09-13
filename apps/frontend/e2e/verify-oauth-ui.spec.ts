import { test, expect } from '@playwright/test';

/**
 * OpenAI 계정 연결 UI 확인.
 * 실제 로그인은 하지 않는다 — provider 를 고르면 연결 버튼이 나타나는지까지만 본다.
 */
test('AI 설정에서 계정 연결 provider 를 고르면 연결 버튼이 나온다', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto('/system/config');
  await page.waitForLoadState('networkidle');
  expect(page.url(), '세션 만료').not.toContain('/login');

  // AI 탭으로 이동
  const aiTab = page.getByRole('button', { name: /AI/ }).first();
  if (await aiTab.isVisible().catch(() => false)) await aiTab.click();
  await page.waitForTimeout(1500);

  const providerSelect = page.locator('select').filter({ hasText: 'OpenAI' }).first();
  await expect(providerSelect, 'AI 제공자 셀렉트를 찾지 못했다').toBeVisible({ timeout: 20000 });

  await providerSelect.selectOption('openai-oauth');
  await page.waitForTimeout(1500);

  await expect(page.getByText('OpenAI 계정 연결').first()).toBeVisible({ timeout: 15000 });
  console.log('[oauth] 계정 연결 섹션 표시 확인');

  // API 키 입력칸은 감춰져야 한다
  const keyInput = page.locator('input[type="password"]');
  expect(await keyInput.count(), 'API 키 입력이 아직 보인다').toBe(0);
  console.log('[oauth] API 키 입력 숨김 확인');

  await page.screenshot({ path: 'test-results/oauth-ui.png' });
});
