import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';

function loadPlaywright() {
  const localRequire = createRequire(import.meta.url);
  try {
    return localRequire('playwright');
  } catch {
    const appData = process.env.APPDATA;
    if (!appData) throw new Error('playwright module not found and APPDATA is not set');
    const globalRequire = createRequire(path.join(appData, 'npm/node_modules/playwright/package.json'));
    return globalRequire('playwright');
  }
}

const { chromium } = loadPlaywright();

const baseUrl = process.env.HANES_FRONTEND_URL ?? 'http://localhost:3002';
const apiUrl = process.env.HANES_API_URL ?? 'http://localhost:3003/api/v1';
const token = process.env.HANES_TOKEN ?? 'admin@hanes.com';
const stamp = new Date().toISOString().replace(/\D/g, '').slice(2, 14);
const itemCode = `FECRUD-${stamp}`;
const itemName = `프론트CRUD-${stamp}`;
const editedName = `프론트CRUD수정-${stamp}`;
const outDir = path.resolve('docs/reports/hanes-master-part-ui-crud-qa-2026-06-12');
const shotDir = path.join(outDir, 'screenshots');
const reportPath = path.resolve('docs/reports/hanes-master-part-ui-crud-qa-2026-06-12.html');

const user = {
  id: 'admin@hanes.com',
  email: 'admin@hanes.com',
  name: '시스템관리자',
  empNo: null,
  dept: null,
  role: 'ADMIN',
  status: 'ACTIVE',
  company: '40',
  plant: '1000',
};

function htmlEscape(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

async function apiRequest(method, url) {
  return fetch(`${apiUrl}${url}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'X-Company': '40',
      'X-Plant': '1000',
      'Content-Type': 'application/json',
    },
  });
}

async function cleanupExisting() {
  await apiRequest('DELETE', `/master/parts/${encodeURIComponent(itemCode)}`).catch(() => {});
}

async function cleanupPriorFeCrudRows() {
  const res = await fetch(`${apiUrl}/master/parts?search=FECRUD&limit=100`, {
    headers: { Authorization: `Bearer ${token}`, 'X-Company': '40', 'X-Plant': '1000' },
  });
  if (!res.ok) return;
  const body = await res.json().catch(() => null);
  for (const item of body?.data ?? []) {
    if (typeof item?.itemCode === 'string' && item.itemCode.startsWith('FECRUD-')) {
      await apiRequest('DELETE', `/master/parts/${encodeURIComponent(item.itemCode)}`).catch(() => {});
    }
  }
}

async function injectAuth(page) {
  await page.goto(`${baseUrl}/login`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.evaluate(({ token, user }) => {
    const auth = {
      state: {
        user,
        token,
        selectedCompany: '40',
        selectedPlant: '1000',
        isAuthenticated: true,
        allowedMenus: [],
        currentWorker: null,
        pdaAllowedMenus: [],
      },
      version: 0,
    };
    localStorage.setItem('harness-token', token);
    localStorage.setItem('harness-auth', JSON.stringify(auth));
  }, { token, user });
}

function workArea(page) {
  return page.locator('main > div.flex-1').first();
}

async function capture(page, name, evidence, label, mode = 'content') {
  const fullPath = path.join(shotDir, name);
  if (mode === 'viewport') {
    await page.screenshot({ path: fullPath, fullPage: false });
    evidence.push({ label, src: path.relative(path.dirname(reportPath), fullPath).replaceAll('\\', '/') });
    return;
  }
  if (mode === 'dialog') {
    const dialog = page.getByRole('dialog').first();
    if (await dialog.isVisible().catch(() => false)) {
      await dialog.screenshot({ path: fullPath });
      evidence.push({ label, src: path.relative(path.dirname(reportPath), fullPath).replaceAll('\\', '/') });
      return;
    }
  }
  const target = workArea(page);
  if (await target.isVisible().catch(() => false)) {
    await target.screenshot({ path: fullPath });
  } else {
    await page.screenshot({ path: fullPath, fullPage: false });
  }
  evidence.push({ label, src: path.relative(path.dirname(reportPath), fullPath).replaceAll('\\', '/') });
}

async function fillByLabel(page, label, value) {
  await page.locator(`label:has-text("${label}")`).locator('..').locator('input').first().fill(value);
}

async function searchItem(page, value) {
  const root = workArea(page);
  const input = root.locator('input[placeholder*="검색"]').first();
  await input.fill(value);
  await page.keyboard.press('Enter').catch(() => {});
  await page.waitForTimeout(900);
}

async function waitForText(page, text) {
  await workArea(page).getByText(text, { exact: false }).first().waitFor({ state: 'visible', timeout: 10000 });
}

async function clickRowAction(page, rowText, actionIndex) {
  const row = page.locator('tr', { hasText: rowText }).first();
  await row.waitFor({ state: 'visible', timeout: 10000 });
  await row.locator('button').nth(actionIndex).click();
}

function renderReport(evidence, steps) {
  return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <title>HANES 품목관리 UI CRUD 실테스트</title>
  <style>
    body { font-family: Arial, "Malgun Gothic", sans-serif; margin: 0; background: #f6f7f9; color: #111827; }
    header { padding: 24px 32px; color: #fff; background: #111827; }
    main { padding: 22px 32px 40px; }
    h1 { margin: 0 0 8px; font-size: 24px; }
    .summary, .card { background: #fff; border: 1px solid #d8dee8; border-radius: 8px; padding: 16px; margin-bottom: 16px; }
    li { margin: 6px 0; }
    code { background: #eef2f7; padding: 2px 5px; border-radius: 4px; }
    .shots { display: grid; grid-template-columns: repeat(auto-fit, minmax(360px, 1fr)); gap: 14px; }
    figure { margin: 0; background: #fff; border: 1px solid #d8dee8; border-radius: 8px; overflow: hidden; }
    figcaption { padding: 9px 12px; font-weight: 700; border-bottom: 1px solid #d8dee8; }
    img { display: block; width: 100%; }
  </style>
</head>
<body>
  <header>
    <h1>HANES 품목관리 UI CRUD 실테스트</h1>
    <div>대상: <code>${htmlEscape(baseUrl)}/master/part</code> / 테스트 품목: <code>${htmlEscape(itemCode)}</code></div>
  </header>
  <main>
    <section class="summary">
      <strong>결과: PASS</strong>
      <p>정상 CRUD와 강제 RED(중복 품목코드 등록 오류)를 같은 실제 UI 흐름에서 검증했다.</p>
      <ol>${steps.map((s) => `<li>${htmlEscape(s)}</li>`).join('')}</ol>
    </section>
    <section class="shots">
      ${evidence.map((e) => `<figure><figcaption>${htmlEscape(e.label)}</figcaption><a href="${htmlEscape(e.src)}"><img src="${htmlEscape(e.src)}" alt="${htmlEscape(e.label)}"></a></figure>`).join('')}
    </section>
  </main>
</body>
</html>`;
}

async function main() {
  await fs.mkdir(shotDir, { recursive: true });
  await cleanupPriorFeCrudRows();
  await cleanupExisting();

  const evidence = [];
  const steps = [];
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: 'ko-KR', timezoneId: 'Asia/Seoul' });
  const page = await context.newPage();
  page.setDefaultTimeout(10000);

  const failures = [];
  const expectedRedResponses = [];
  let expectingRed = false;
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      if (expectingRed && /status of 4\d\d|Conflict|409/.test(msg.text())) {
        expectedRedResponses.push(`console: ${msg.text()}`);
      } else {
        failures.push(`console: ${msg.text()}`);
      }
    }
  });
  page.on('pageerror', (err) => failures.push(`pageerror: ${err.message}`));
  page.on('response', (res) => {
    const url = res.url();
    if (res.status() >= 400 && url.includes('/api/')) {
      if (expectingRed) expectedRedResponses.push(`http ${res.status()} ${url}`);
      else failures.push(`http ${res.status()} ${url}`);
    }
  });

  try {
    await injectAuth(page);
    await page.goto(`${baseUrl}/master/part`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForLoadState('networkidle', { timeout: 7000 }).catch(() => {});
    await capture(page, '01-initial-list.png', evidence, '01. 품목관리 초기 목록');

    await workArea(page).getByRole('button', { name: /품목 추가/ }).click();
    await page.waitForTimeout(500);
    await fillByLabel(page, '품목코드', itemCode);
    await fillByLabel(page, '품번', itemCode);
    await fillByLabel(page, '품목명', itemName);
    await fillByLabel(page, '리비전', 'A');
    await fillByLabel(page, '마킹문구', `MARK-${stamp}`);
    await capture(page, '02-create-panel-filled.png', evidence, '02. 등록 패널 입력 완료');
    await page.getByRole('button', { name: /^추가$/ }).click();
    await page.waitForTimeout(1200);
    steps.push(`등록: ${itemCode} / ${itemName}`);

    await searchItem(page, itemCode);
    await waitForText(page, itemCode);
    await capture(page, '03-created-search-result.png', evidence, '03. 등록 후 검색 결과');

    await workArea(page).getByRole('button', { name: /품목 추가/ }).click();
    await page.waitForTimeout(500);
    await fillByLabel(page, '품목코드', itemCode);
    await fillByLabel(page, '품번', itemCode);
    await fillByLabel(page, '품목명', `${itemName}-중복`);
    await capture(page, '04-red-duplicate-create-panel.png', evidence, '04. RED 유도: 중복 품목코드 등록 입력');
    expectingRed = true;
    await page.getByRole('button', { name: /^추가$/ }).click();
    await page.getByText('오류가 발생했습니다').waitFor({ state: 'visible', timeout: 10000 });
    await capture(page, '05-red-error-modal.png', evidence, '05. RED 결과: API 오류 상세 모달', 'viewport');
    steps.push(`RED: 동일 품목코드 ${itemCode} 중복 등록 시도 -> 오류 모달 표시`);
    await page.getByRole('button', { name: /^닫기$/ }).click();
    await page.waitForTimeout(400);
    await page.getByRole('button', { name: /^취소$/ }).click();
    await page.waitForTimeout(600);
    expectingRed = false;

    await clickRowAction(page, itemCode, 0);
    await page.waitForTimeout(700);
    await fillByLabel(page, '품목명', editedName);
    await fillByLabel(page, '마킹문구', `EDIT-${stamp}`);
    await capture(page, '06-edit-panel-filled.png', evidence, '06. 수정 패널 입력 완료');
    await page.getByRole('button', { name: /^수정$/ }).click();
    await page.waitForTimeout(1200);
    steps.push(`수정: 품목명 ${itemName} -> ${editedName}`);

    await searchItem(page, itemCode);
    await waitForText(page, editedName);
    await capture(page, '07-edited-search-result.png', evidence, '07. 수정 후 검색 결과');

    await clickRowAction(page, itemCode, 1);
    await page.waitForTimeout(500);
    await capture(page, '08-delete-confirm-modal.png', evidence, '08. 삭제 확인 모달', 'dialog');
    await page.getByRole('button', { name: /^확인$/ }).click();
    await page.waitForTimeout(1200);
    steps.push(`삭제: 확인 모달 캡처 후 ${itemCode} 삭제`);

    await searchItem(page, itemCode);
    await page.waitForTimeout(900);
    await capture(page, '09-after-delete-search-result.png', evidence, '09. 삭제 후 검색 결과');

    const verify = await fetch(`${apiUrl}/master/parts?search=${encodeURIComponent(itemCode)}&limit=20`, {
      headers: { Authorization: `Bearer ${token}`, 'X-Company': '40', 'X-Plant': '1000' },
    });
    const verifyBody = await verify.json().catch(() => null);
    if (!verify.ok || (verifyBody?.data ?? []).some((item) => item.itemCode === itemCode)) {
      failures.push(`delete verification failed HTTP ${verify.status}`);
    }
  } finally {
    await browser.close().catch(() => {});
  }

  if (failures.length) {
    await cleanupExisting();
    throw new Error(failures.join('\n'));
  }

  await fs.writeFile(reportPath, renderReport(evidence, steps), 'utf8');
  await fs.writeFile(path.join(outDir, 'result.json'), JSON.stringify({
    status: 'PASS',
    route: '/master/part',
    itemCode,
    itemName,
    editedName,
    steps,
    evidence,
    expectedRedResponses,
    reportPath,
  }, null, 2), 'utf8');

  console.log(JSON.stringify({ status: 'PASS', itemCode, reportPath, screenshots: evidence.length }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
