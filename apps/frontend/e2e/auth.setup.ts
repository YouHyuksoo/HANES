import { test as setup } from '@playwright/test';
import path from 'path';
import fs from 'fs';

/**
 * 로그인 1회 → 세션(localStorage harness-token / harness-auth) 저장.
 * 이후 모든 테스트가 이 파일을 storageState 로 재사용한다.
 *
 * 계정은 환경변수로 주입한다:
 *   E2E_EMAIL=admin@harness.com E2E_PASSWORD=*** pnpm test:e2e
 * 회사/사업장은 로그인 화면이 기본값(첫 항목)으로 자동 선택한다.
 */
const authFile = path.join(__dirname, '.auth/user.json');

setup('인증: 로그인 후 세션 저장', async ({ page }) => {
  const email = process.env.E2E_EMAIL;
  const password = process.env.E2E_PASSWORD;
  if (!email || !password) {
    throw new Error(
      'E2E_EMAIL / E2E_PASSWORD 환경변수가 필요합니다.\n' +
        '예) E2E_EMAIL=admin@harness.com E2E_PASSWORD=secret pnpm test:e2e',
    );
  }

  await page.goto('/login');

  // 연결확인 오버레이가 사라지고 회사/사업장 목록이 자동 선택될 때까지
  // 입력 필드가 actionable 해질 때까지 Playwright 가 자동 대기한다.
  // 입력/버튼은 언어 설정과 무관하게 동작하도록 타입 기반으로 지정한다.
  await page.getByPlaceholder('admin@harness.com').fill(email);
  await page.locator('form input[type="password"]').fill(password);
  await page.locator('form button[type="submit"]').click();

  // 로그인 성공 → 대시보드 이동
  await page.waitForURL('**/dashboard', { timeout: 15000 });

  fs.mkdirSync(path.dirname(authFile), { recursive: true });
  await page.context().storageState({ path: authFile });
});
