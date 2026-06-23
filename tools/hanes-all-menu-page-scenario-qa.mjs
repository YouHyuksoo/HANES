import fs from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

function loadPlaywright() {
  const localRequire = createRequire(import.meta.url);
  const candidates = [
    'playwright',
    path.resolve('node_modules/.pnpm/playwright@1.61.0/node_modules/playwright'),
    process.env.APPDATA
      ? path.join(process.env.APPDATA, 'npm/node_modules/playwright')
      : null,
  ].filter(Boolean);
  for (const candidate of candidates) {
    try {
      return localRequire(candidate);
    } catch {
      // try next
    }
  }
  throw new Error('playwright module not found');
}

const { chromium } = loadPlaywright();

const reportDate = process.env.HANES_REPORT_DATE ?? new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Seoul',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
}).format(new Date());

const baseUrl = process.env.HANES_FRONTEND_URL ?? 'http://localhost:3002';
const apiUrl = process.env.HANES_API_URL ?? 'http://localhost:3003/api/v1';
const token = process.env.HANES_TOKEN ?? 'admin@hanes.com';
const headed = process.env.HANES_QA_HEADED === '1';
const slowMo = Number(process.env.HANES_QA_SLOWMO ?? 0);
const routeTimeoutMs = Number(process.env.HANES_ROUTE_TIMEOUT_MS ?? 45000);
const prewarmTimeoutMs = Number(process.env.HANES_PREWARM_TIMEOUT_MS ?? 180000);
const runBudgetMs = process.env.HANES_QA_BUDGET_MS ? Number(process.env.HANES_QA_BUDGET_MS) : 0;
const runStartedAt = Date.now();
const limit = process.env.HANES_MENU_LIMIT ? Number(process.env.HANES_MENU_LIMIT) : 0;
const menuOffset = process.env.HANES_MENU_OFFSET ? Number(process.env.HANES_MENU_OFFSET) : 0;
const codeFilter = process.env.HANES_MENU_CODES
  ? new Set(process.env.HANES_MENU_CODES.split(',').map((code) => code.trim()).filter(Boolean))
  : null;

const reportRoot = path.resolve(`docs/reports/hanes-all-menu-scenario-qa-${reportDate}`);
const pageDir = path.join(reportRoot, 'pages');
const pageJsonDir = path.join(reportRoot, 'page-results');
const shotRoot = path.join(reportRoot, 'screenshots');
const indexPath = path.join(reportRoot, 'index.html');
const resultPath = path.join(reportRoot, 'all-menu-result.json');

const authUser = {
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

function isIgnoredRequestFailure(item) {
  return /fonts\.gstatic\.com|fonts\.googleapis\.com/i.test(item.url)
    || /^\/api\/(?:health|db-info)$/i.test(item.url)
    || /^\/api\/master\/companies\/public$/i.test(item.url)
    || /^\/api\/master\/companies\/public\/plants(?:\?.*)?$/i.test(item.url)
    || item.failure === 'net::ERR_ABORTED';
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function safeSlug(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, '-')
    .replace(/^-|-$/g, '') || 'page';
}

function isRunBudgetExhausted() {
  return runBudgetMs > 0 && Date.now() - runStartedAt >= runBudgetMs;
}

function loadMenus() {
  const source = readFileSync('apps/frontend/src/config/menuConfig.ts', 'utf8');
  const entries = [
    { code: 'DASHBOARD', labelKey: 'menu.dashboard', path: '/dashboard', source: 'top-level' },
    { code: 'WORKFLOW', labelKey: 'menu.workflow', path: '/workflow', source: 'top-level' },
  ];
  const pattern = /\{\s*code:\s*"([^"]+)",\s*labelKey:\s*"([^"]+)",\s*path:\s*"([^"]+)"/g;
  for (const match of source.matchAll(pattern)) {
    entries.push({ code: match[1], labelKey: match[2], path: match[3], source: 'menuConfig' });
  }
  const unique = [];
  const seen = new Set();
  for (const entry of entries) {
    const key = `${entry.code}:${entry.path}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (codeFilter && !codeFilter.has(entry.code)) continue;
    unique.push({ ...entry, slug: safeSlug(`${entry.code}-${entry.path}`) });
  }
  const offsetEntries = menuOffset > 0 ? unique.slice(menuOffset) : unique;
  return limit > 0 ? offsetEntries.slice(0, limit) : offsetEntries;
}

async function ensureDirs() {
  await fs.mkdir(pageDir, { recursive: true });
  await fs.mkdir(pageJsonDir, { recursive: true });
  await fs.mkdir(shotRoot, { recursive: true });
}

async function injectAuth(page) {
  await page.goto(`${baseUrl}/login`, { waitUntil: 'domcontentloaded', timeout: routeTimeoutMs });
  await page.evaluate(({ token, user }) => {
    localStorage.setItem('harness-token', token);
    localStorage.setItem('harness-auth', JSON.stringify({
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
    }));
  }, { token, user: authUser });
}

async function healthCheck(url) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    return { ok: res.ok, status: res.status };
  } catch (error) {
    return { ok: false, status: 0, error: String(error.message ?? error) };
  }
}

async function prewarmRoute(url) {
  const startedAt = Date.now();
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(prewarmTimeoutMs) });
    return { ok: res.ok, status: res.status, elapsedMs: Date.now() - startedAt };
  } catch (error) {
    return { ok: false, status: 0, elapsedMs: Date.now() - startedAt, error: String(error.message ?? error) };
  }
}

async function collectVisibleText(locator, max = 60) {
  const values = [];
  const count = await locator.count().catch(() => 0);
  for (let i = 0; i < Math.min(count, max); i += 1) {
    const text = (await locator.nth(i).innerText().catch(() => '')).trim();
    if (text) values.push(text.replace(/\s+/g, ' ').slice(0, 80));
  }
  return [...new Set(values)];
}

async function runMenu(browser, menu) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    ignoreHTTPSErrors: true,
  });
  const page = await context.newPage();
  const apiCalls = [];
  const consoleErrors = [];
  const pageErrors = [];
  const requestFailures = [];
  const routeUrl = `${baseUrl}${menu.path}`;
  const shotDir = path.join(shotRoot, menu.slug);
  const screenshotPath = path.join(shotDir, '01-load.png');
  const prewarm = await prewarmRoute(routeUrl);
  await fs.mkdir(shotDir, { recursive: true });

  page.on('console', (message) => {
    if (['error', 'warning'].includes(message.type())) {
      consoleErrors.push({
        type: message.type(),
        text: message.text().slice(0, 600),
      });
    }
  });
  page.on('pageerror', (error) => {
    pageErrors.push(String(error.message ?? error).slice(0, 800));
  });
  page.on('requestfailed', (request) => {
    requestFailures.push({
      method: request.method(),
      url: request.url().replace(baseUrl, '').replace(apiUrl, '/api/v1'),
      failure: request.failure()?.errorText ?? 'request failed',
    });
  });
  page.on('response', async (response) => {
    const url = response.url();
    if (!url.includes('/api/') && !url.includes('/api/v1/')) return;
    apiCalls.push({
      source: 'ui-network',
      method: response.request().method(),
      url: url.replace(baseUrl, '').replace(apiUrl, '/api/v1'),
      status: response.status(),
      ok: response.status() >= 200 && response.status() < 400,
    });
  });

  const startedAt = Date.now();
  let routeStatus = null;
  let status = 'PASS';
  let error = null;
  let title = '';
  let buttons = [];
  let inputs = 0;
  let selects = 0;
  let tables = 0;
  let grids = 0;
  let bodyPreview = '';
  const featureInventory = [];

  try {
    await injectAuth(page);
    const res = await page.goto(routeUrl, {
      waitUntil: 'domcontentloaded',
      timeout: routeTimeoutMs,
    });
    routeStatus = res?.status() ?? null;
    await page.waitForLoadState('networkidle', { timeout: 12000 }).catch(() => undefined);
    await page.waitForTimeout(800);

    title = (await page.locator('h1, [data-page-title], header').first().innerText().catch(() => '')).trim();
    buttons = await collectVisibleText(page.getByRole('button'), 80);
    inputs = await page.locator('input:visible, textarea:visible').count().catch(() => 0);
    selects = await page.locator('select:visible').count().catch(() => 0);
    tables = await page.locator('table:visible').count().catch(() => 0);
    grids = await page.locator('[role="grid"]:visible, [data-testid*="grid"]:visible, [class*="DataGrid"]:visible').count().catch(() => 0);
    bodyPreview = (await page.locator('body').innerText().catch(() => '')).replace(/\s+/g, ' ').slice(0, 1200);
    await page.screenshot({ path: screenshotPath, fullPage: false }).catch(() => undefined);

    featureInventory.push({ name: '화면 로드', handling: `GET ${menu.path}`, status: routeStatus && routeStatus < 400 ? '실행' : '실패', note: `HTTP ${routeStatus ?? '-'}` });
    featureInventory.push({ name: '라우트 prewarm', handling: '직접 HTTP 확인', status: prewarm.ok ? '실행' : '실패', note: `HTTP ${prewarm.status}, ${prewarm.elapsedMs}ms` });
    featureInventory.push({ name: '초기 API 호출', handling: '브라우저 네트워크 수집', status: apiCalls.length ? '실행' : '목록화', note: `${apiCalls.length}건` });
    for (const button of buttons) {
      featureInventory.push({ name: button, handling: '화면 버튼 목록화', status: '목록화', note: '후속 메뉴별 세부 시나리오 실행 대상' });
    }
    if (inputs > 0) featureInventory.push({ name: '입력 필드', handling: 'DOM 수집', status: '목록화', note: `${inputs}개` });
    if (selects > 0) featureInventory.push({ name: '선택 필드', handling: 'DOM 수집', status: '목록화', note: `${selects}개` });
    if (tables + grids > 0) featureInventory.push({ name: '목록/그리드', handling: 'DOM 수집', status: '목록화', note: `table ${tables}, grid ${grids}` });

    const failedApis = apiCalls.filter((call) => call.status >= 400);
    const fatalConsole = consoleErrors.filter((item) => (
      !/favicon/i.test(item.text)
      && !/ResizeObserver loop/i.test(item.text)
      && !/Download the React DevTools/i.test(item.text)
      && !/^Failed to load resource: the server responded with a status of \d+ \(/i.test(item.text)
    ));
    const fatalRequests = requestFailures.filter((item) => !isIgnoredRequestFailure(item));
    if (!routeStatus || routeStatus >= 400 || pageErrors.length > 0 || failedApis.length > 0 || fatalConsole.length > 0 || fatalRequests.length > 0) {
      status = 'FAIL';
    }
  } catch (err) {
    status = 'FAIL';
    error = String(err.message ?? err);
  } finally {
    await context.close().catch(() => undefined);
  }

  const result = {
    ...menu,
    title,
    status,
    routeUrl,
    routeStatus,
    prewarm,
    elapsedMs: Date.now() - startedAt,
    apiCalls,
    consoleErrors,
    pageErrors,
    requestFailures,
    featureInventory,
    metrics: { buttons: buttons.length, inputs, selects, tables, grids },
    screenshot: existsSync(screenshotPath) ? `screenshots/${menu.slug}/01-load.png` : null,
    bodyPreview,
    error,
  };
  await writePageReport(result);
  return result;
}

async function writePageReport(result) {
  const pagePath = path.join(pageDir, `${result.slug}.html`);
  const pageJsonPath = path.join(pageJsonDir, `${result.slug}.json`);
  const apiRows = result.apiCalls
    .map((call) => `<tr><td>${escapeHtml(call.method)}</td><td>${escapeHtml(call.url)}</td><td>${call.status}</td><td>${call.ok ? 'OK' : 'FAIL'}</td></tr>`)
    .join('\n');
  const featureRows = result.featureInventory
    .map((item) => `<tr><td>${escapeHtml(item.name)}</td><td>${escapeHtml(item.handling)}</td><td>${escapeHtml(item.status)}</td><td>${escapeHtml(item.note)}</td></tr>`)
    .join('\n');
  const errorList = [
    ...(result.error ? [`runner: ${result.error}`] : []),
    ...result.pageErrors.map((item) => `pageerror: ${item}`),
    ...result.consoleErrors.map((item) => `${item.type}: ${item.text}`),
    ...result.requestFailures.map((item) => `requestfailed: ${item.method} ${item.url} ${item.failure}`),
    ...result.apiCalls.filter((call) => call.status >= 400).map((call) => `api: ${call.method} ${call.url} ${call.status}`),
  ];
  const html = `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(result.code)} - HANES 전체 메뉴 QA</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 24px; color: #172033; }
    table { border-collapse: collapse; width: 100%; margin: 12px 0; }
    th, td { border: 1px solid #d8dee9; padding: 8px; font-size: 13px; vertical-align: top; }
    th { background: #f3f6fb; text-align: left; }
    .pass { color: #047857; font-weight: 700; }
    .fail { color: #be123c; font-weight: 700; }
    pre { background: #0f172a; color: #e2e8f0; padding: 12px; overflow: auto; }
    img { max-width: 100%; border: 1px solid #d8dee9; }
  </style>
</head>
<body>
  <h1>${escapeHtml(result.code)} ${escapeHtml(result.title || result.path)}</h1>
  <p>Route: <code>${escapeHtml(result.path)}</code></p>
  <p>Status: <span class="${result.status === 'PASS' ? 'pass' : 'fail'}">${result.status}</span> / HTTP ${escapeHtml(result.routeStatus ?? '-')}</p>
  <h2>기능/버튼 인벤토리</h2>
  <table><thead><tr><th>기능/버튼</th><th>처리 방식</th><th>상태</th><th>비고</th></tr></thead><tbody>${featureRows}</tbody></table>
  <h2>API 호출</h2>
  <table><thead><tr><th>Method</th><th>URL</th><th>Status</th><th>OK</th></tr></thead><tbody>${apiRows || '<tr><td colspan="4">수집된 API 호출 없음</td></tr>'}</tbody></table>
  <h2>오류</h2>
  ${errorList.length ? `<pre>${escapeHtml(errorList.join('\n'))}</pre>` : '<p>수집된 오류 없음</p>'}
  <h2>화면 증거</h2>
  ${result.screenshot ? `<img src="../${escapeHtml(result.screenshot)}" alt="screenshot" />` : '<p>스크린샷 없음</p>'}
  <h2>본문 미리보기</h2>
  <pre>${escapeHtml(result.bodyPreview)}</pre>
</body>
</html>`;
  await fs.writeFile(pagePath, html, 'utf8');
  result.pageReport = `pages/${result.slug}.html`;
  result.pageResult = `page-results/${result.slug}.json`;
  await fs.writeFile(pageJsonPath, JSON.stringify(result, null, 2), 'utf8');
}

async function writeIndex(results, health) {
  const pass = results.filter((item) => item.status === 'PASS').length;
  const fail = results.length - pass;
  const rows = results
    .map((item) => [
      '<tr>',
      `<td><a href="${escapeHtml(item.pageReport)}">${escapeHtml(item.code)}</a></td>`,
      `<td><code>${escapeHtml(item.path)}</code></td>`,
      `<td class="${item.status === 'PASS' ? 'pass' : 'fail'}">${item.status}</td>`,
      `<td>${escapeHtml(item.routeStatus ?? '-')}</td>`,
      `<td>${item.apiCalls.length}</td>`,
      `<td>${item.consoleErrors.length + item.pageErrors.length + item.requestFailures.length}</td>`,
      `<td>${escapeHtml(item.metrics.buttons)}</td>`,
      '</tr>',
    ].join(''))
    .join('\n');
  const html = `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <title>HANES 전체 메뉴 QA ${escapeHtml(reportDate)}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 24px; color: #172033; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid #d8dee9; padding: 8px; font-size: 13px; }
    th { background: #f3f6fb; text-align: left; }
    .pass { color: #047857; font-weight: 700; }
    .fail { color: #be123c; font-weight: 700; }
    code { color: #334155; }
  </style>
</head>
<body>
  <h1>HANES 전체 메뉴 QA</h1>
  <p>일자: ${escapeHtml(reportDate)}</p>
  <p>Frontend: ${escapeHtml(baseUrl)} (${health.frontend.status}) / Backend: ${escapeHtml(apiUrl)} (${health.backend.status})</p>
  <p>요약: 총 ${results.length}개, PASS ${pass}개, FAIL ${fail}개</p>
  ${runBudgetMs > 0 ? `<p>실행 예산: ${Math.round(runBudgetMs / 1000)}초</p>` : ''}
  <p>주의: 이 리포트는 전체 메뉴 1차 스윕입니다. 버튼/입력 기능은 목록화하고, CRUD/업무처리 실행은 실패 및 우선순위 메뉴부터 후속 세부 시나리오로 확장합니다.</p>
  <table>
    <thead><tr><th>메뉴</th><th>Route</th><th>Status</th><th>HTTP</th><th>API</th><th>오류</th><th>버튼</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
</body>
</html>`;
  await fs.writeFile(indexPath, html, 'utf8');
}

async function writeResultSummary(results, health, stoppedReason = null, plannedTotal = results.length) {
  await writeIndex(results, health);
  const result = {
    status: stoppedReason ? 'PARTIAL' : (results.every((item) => item.status === 'PASS') ? 'PASS' : 'FAIL'),
    reportDate,
    baseUrl,
    apiUrl,
    health,
    menuOffset,
    plannedTotal,
    total: results.length,
    pass: results.filter((item) => item.status === 'PASS').length,
    fail: results.filter((item) => item.status === 'FAIL').length,
    runBudgetMs,
    elapsedMs: Date.now() - runStartedAt,
    stoppedReason,
    indexPath,
    resultPath,
    pages: results,
  };
  await fs.writeFile(resultPath, JSON.stringify(result, null, 2), 'utf8');
  return result;
}

async function main() {
  await ensureDirs();
  const health = {
    frontend: await healthCheck(baseUrl),
    backend: await healthCheck(`${apiUrl}/health`),
  };
  if (!health.frontend.ok) throw new Error(`frontend health failed: ${JSON.stringify(health.frontend)}`);
  if (!health.backend.ok) throw new Error(`backend health failed: ${JSON.stringify(health.backend)}`);

  const menus = loadMenus();
  const browser = await chromium.launch({ headless: !headed, slowMo });
  const results = [];
  let stoppedReason = null;
  try {
    for (const [index, menu] of menus.entries()) {
      if (isRunBudgetExhausted()) {
        stoppedReason = `time budget exhausted before ${menu.code}`;
        process.stdout.write(`[STOP] ${stoppedReason}\n`);
        break;
      }
      process.stdout.write(`[${index + 1}/${menus.length}] ${menu.code} ${menu.path}\n`);
      const result = await runMenu(browser, menu);
      results.push(result);
      await writeResultSummary(results, health, null, menus.length);
    }
  } finally {
    await browser.close().catch(() => undefined);
  }
  const result = await writeResultSummary(results, health, stoppedReason, menus.length);
  console.log(JSON.stringify({
    status: result.status,
    menuOffset: result.menuOffset,
    plannedTotal: result.plannedTotal,
    total: result.total,
    pass: result.pass,
    fail: result.fail,
    stoppedReason: result.stoppedReason,
    indexPath,
    resultPath,
  }, null, 2));
  if (result.status === 'FAIL') process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
