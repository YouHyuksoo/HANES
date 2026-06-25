// 진입 시 빈 화면인 조회형 화면을 실제 조회를 수행한 상태로 캡처한다.
//  - 추적성조회(QC_TRACE): 제품 시리얼로 검색 후 결과 화면 캡처
//  - 출하이력조회(SHIP_HISTORY): 날짜 범위를 넓혀 재조회 후 캡처
// 실패해도 기존 진입 캡처를 유지한다(덮어쓰지 않음).
// 사용: node docs/presentation/scripts/capture-interactive.mjs [제품시리얼]

import path from 'node:path';
import { createRequire } from 'node:module';

function loadPlaywright() {
  const localRequire = createRequire(import.meta.url);
  try { return localRequire('playwright'); }
  catch {
    const globalRequire = createRequire(path.join(process.env.APPDATA, 'npm/node_modules/playwright/package.json'));
    return globalRequire('playwright');
  }
}
const { chromium } = loadPlaywright();

const baseUrl = process.env.HANES_FRONTEND_URL ?? 'http://localhost:3002';
const token = 'admin@hanes.com';
const VIEWPORT = { width: 1600, height: 900 };
const assetsDir = path.join(process.cwd(), 'docs/presentation/assets');
const TRACE_SERIAL = process.argv[2] ?? 'FG26062300301';

const user = { id: token, email: token, name: '시스템관리자', role: 'ADMIN', status: 'ACTIVE', company: '40', plant: '1000' };

async function newPage(browser) {
  const ctx = await browser.newContext({ viewport: VIEWPORT, locale: 'ko-KR', timezoneId: 'Asia/Seoul' });
  await ctx.addInitScript(({ token, user }) => {
    const auth = { state: { user, token, selectedCompany: '40', selectedPlant: '1000', isAuthenticated: true, allowedMenus: [], currentWorker: null, pdaAllowedMenus: [] }, version: 0 };
    localStorage.setItem('harness-token', token);
    localStorage.setItem('harness-auth', JSON.stringify(auth));
  }, { token, user });
  const page = await ctx.newPage();
  page.setDefaultTimeout(15000);
  await page.route('**/*', (r) => {
    const h = r.request().headers();
    if (h['next-router-prefetch'] === '1' || h['purpose'] === 'prefetch') return r.abort();
    return r.continue();
  });
  return { ctx, page };
}

async function captureTrace(browser) {
  const { ctx, page } = await newPage(browser);
  try {
    await page.goto(`${baseUrl}/quality/trace`, { waitUntil: 'domcontentloaded', timeout: 90000 });
    await page.waitForLoadState('networkidle', { timeout: 4000 }).catch(() => {});
    // 상단 글로벌 검색(Ctrl+K)이 아니라 추적성 페이지의 검색창을 placeholder로 정확히 타겟
    const input = page.getByPlaceholder(/시리얼번호.*LOT/).first();
    await input.fill(TRACE_SERIAL);
    // 페이지 본문의 검색 버튼 클릭 후 결과 대기
    const searchBtn = page.getByRole('button', { name: /검색/ }).last();
    await searchBtn.click().catch(async () => { await input.press('Enter'); });
    // 로딩(버튼 disabled) 해제될 때까지 대기 → 결과 렌더 후 캡처
    await page.waitForFunction(() => {
      const btns = [...document.querySelectorAll('button')].filter((b) => /검색/.test(b.textContent || ''));
      const b = btns[btns.length - 1];
      return b && !b.disabled;
    }, null, { timeout: 30000 }).catch(() => {});
    await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(assetsDir, 'menu-captures/23-quality-qc_trace.png'), type: 'png', clip: { x: 0, y: 0, ...VIEWPORT } });
    console.log(`TRACE OK (serial=${TRACE_SERIAL})`);
  } catch (err) {
    console.log(`TRACE FAIL: ${err instanceof Error ? err.message : err} (기존 진입 캡처 유지)`);
  } finally { await ctx.close().catch(() => {}); }
}

async function captureShipHistory(browser) {
  const { ctx, page } = await newPage(browser);
  try {
    await page.goto(`${baseUrl}/shipping/history`, { waitUntil: 'domcontentloaded', timeout: 90000 });
    await page.waitForLoadState('networkidle', { timeout: 4000 }).catch(() => {});
    const dateInputs = page.locator('input[type="date"]');
    if (await dateInputs.count() > 0) {
      await dateInputs.first().fill('2026-01-01');
      await page.waitForTimeout(500);
      // 새로고침 버튼이 있으면 클릭
      await page.getByRole('button', { name: /새로고침|조회|검색/ }).first().click().catch(() => {});
    }
    await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(2500);
    await page.screenshot({ path: path.join(assetsDir, 'menu-captures/29-shipping-ship_history.png'), type: 'png', clip: { x: 0, y: 0, ...VIEWPORT } });
    console.log('SHIP_HISTORY OK (date from 2026-01-01)');
  } catch (err) {
    console.log(`SHIP_HISTORY FAIL: ${err instanceof Error ? err.message : err} (기존 진입 캡처 유지)`);
  } finally { await ctx.close().catch(() => {}); }
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  try {
    await captureTrace(browser);
    await captureShipHistory(browser);
  } finally { await browser.close().catch(() => {}); }
}
main().catch((e) => { console.error(e); process.exitCode = 1; });
