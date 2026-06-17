import { defineConfig, devices } from '@playwright/test';
import path from 'path';

/**
 * Playwright E2E 설정 — HANES MES 프론트엔드.
 *
 * - 실제 사용자 UI 흐름·컴포넌트 경계 검증에만 사용한다(CLAUDE.md 규칙).
 * - dev 서버(포트 3002)가 이미 떠 있으면 그대로 재사용한다.
 *   prod build를 자동으로 띄우지 않는다(.next 캐시 손상 방지).
 * - `setup` 프로젝트에서 1회 로그인 후 세션(storageState)을 저장하고,
 *   `chromium` 프로젝트의 모든 테스트가 그 세션을 재사용한다.
 *   로그인 계정은 환경변수 E2E_EMAIL / E2E_PASSWORD 로 주입한다.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3002',
    // 앱이 navigator 언어로 i18n을 감지하므로 한국어로 고정한다.
    // (고정하지 않으면 Chromium 기본 en-US 로 영어 UI가 렌더링됨)
    locale: 'ko-KR',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    // headed 로 눈으로 따라갈 때: E2E_SLOWMO=600 처럼 동작 간 지연(ms) 부여
    launchOptions: {
      slowMo: process.env.E2E_SLOWMO ? Number(process.env.E2E_SLOWMO) : 0,
    },
  },
  projects: [
    // 1) 로그인 → 세션 저장
    { name: 'setup', testMatch: /.*\.setup\.ts/ },
    // 2) 저장된 세션을 재사용해 실제 화면 테스트 실행
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState: path.join(__dirname, 'e2e/.auth/user.json'),
      },
      dependencies: ['setup'],
      testIgnore: /.*\.setup\.ts/,
    },
  ],
});
