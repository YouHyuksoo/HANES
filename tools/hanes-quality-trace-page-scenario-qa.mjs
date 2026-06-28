import fs from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';

function loadPlaywright() {
  const localRequire = createRequire(import.meta.url);
  try {
    return localRequire('playwright');
  } catch {
    const appData = process.env.APPDATA;
    if (!appData) throw new Error('playwright module not found and APPDATA is not set');
    return createRequire(path.join(appData, 'npm/node_modules/playwright/package.json'))('playwright');
  }
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
const oracleConnector = 'C:/Users/hsyou/.codex/skills/oracle-db/scripts/oracle_connector.py';
const oracleSite = process.env.HANES_ORACLE_SITE ?? 'JSHANES';
const reportRoot = path.resolve(`docs/reports/hanes-page-scenario-qa-${reportDate}`);
const pageDir = path.join(reportRoot, 'pages');
const shotDir = path.join(reportRoot, 'screenshots', 'quality-trace');
const indexPath = path.join(reportRoot, 'index.html');
const pagePath = path.join(pageDir, 'quality-trace.html');
const resultPath = path.join(reportRoot, 'quality-trace-result.json');

const testKeys = {
  product: 'FG-N91-X9800-001',
  box: 'BX2606260001',
  workOrder: 'WO-SEED-N91-X9800',
};

const user = {
  id: 'admin@hanes.com',
  email: 'admin@hanes.com',
  name: '시스템관리자',
  role: 'ADMIN',
  status: 'ACTIVE',
  company: '40',
  plant: '1000',
};

const steps = [];
const apiEvents = [];
const consoleErrors = [];
const pageErrors = [];
const requestFailures = [];
let currentStepId = 'init';

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function stripTrailingWhitespace(value) {
  return String(value).replace(/[ \t]+$/gm, '');
}

function safeSlug(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9가-힣]+/g, '-').replace(/^-|-$/g, '');
}

function authHeaders() {
  return {
    Authorization: `Bearer ${token}`,
    'X-Company': '40',
    'X-Plant': '1000',
    'Content-Type': 'application/json',
  };
}

function apiPath(url) {
  const parsed = new URL(url);
  return `${parsed.pathname}${parsed.search}`;
}

function previewJson(value) {
  if (!value) return null;
  const compact = JSON.parse(JSON.stringify(value));
  if (Array.isArray(compact?.data) && compact.data.length > 5) {
    compact.data = compact.data.slice(0, 5);
    compact.dataPreviewTruncated = true;
  }
  if (compact?.meta?.debugSql?.queries?.length > 3) {
    compact.meta.debugSql.queries = compact.meta.debugSql.queries.slice(0, 3);
    compact.meta.debugSql.queriesPreviewTruncated = true;
  }
  return compact;
}

async function directApi(method, urlPath) {
  const startedAt = new Date().toISOString();
  const res = await fetch(`${apiUrl}${urlPath}`, {
    method,
    headers: authHeaders(),
    signal: AbortSignal.timeout(30000),
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  const event = {
    source: 'direct-api',
    stepId: currentStepId,
    method,
    url: `/api/v1${urlPath}`,
    status: res.status,
    ok: res.ok,
    responsePreview: previewJson(json),
  };
  apiEvents.push(event);
  return { res, json, event };
}

function dbQuery(sql) {
  const output = execFileSync('python', [oracleConnector, '--site', oracleSite, '--query', sql], {
    cwd: process.cwd(),
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 30000,
  });
  return JSON.parse(output);
}

function fgSql(fgBarcode = testKeys.product) {
  return [
    `SELECT FG_BARCODE, ITEM_CODE, ORDER_NO, BOX_NO, STATUS, TO_CHAR(ISSUED_AT, 'YYYY-MM-DD HH24:MI:SS') AS ISSUED_AT`,
    'FROM FG_LABELS',
    `WHERE COMPANY = '40' AND PLANT_CD = '1000' AND FG_BARCODE = '${fgBarcode}'`,
  ].join(' ');
}

function boxSql() {
  return [
    `SELECT BOX_NO, ITEM_CODE, QTY, STATUS, PALLET_NO, SHIP_ORDER_NO, TO_CHAR(CLOSE_TIME, 'YYYY-MM-DD HH24:MI:SS') AS CLOSE_TIME`,
    'FROM BOX_MASTERS',
    `WHERE COMPANY = '40' AND PLANT_CD = '1000' AND BOX_NO = '${testKeys.box}'`,
  ].join(' ');
}

function boxFgCountSql() {
  return [
    'SELECT COUNT(*) AS CNT',
    'FROM FG_LABELS',
    `WHERE COMPANY = '40' AND PLANT_CD = '1000' AND BOX_NO = '${testKeys.box}'`,
  ].join(' ');
}

function workOrderFgCountSql() {
  return [
    'SELECT COUNT(*) AS CNT',
    'FROM FG_LABELS',
    `WHERE COMPANY = '40' AND PLANT_CD = '1000' AND ORDER_NO = '${testKeys.workOrder}'`,
  ].join(' ');
}

function residueSql() {
  return [
    'SELECT COUNT(*) AS TEST_RESIDUE',
    'FROM FG_LABELS',
    "WHERE COMPANY = '40' AND PLANT_CD = '1000' AND FG_BARCODE LIKE 'TRACEQA-%'",
  ].join(' ');
}

async function capture(page, name, label) {
  const fileName = `${String(steps.length + 1).padStart(2, '0')}-${safeSlug(name)}.png`;
  const fullPath = path.join(shotDir, fileName);
  const main = page.locator('main').first();
  if (await main.isVisible().catch(() => false)) {
    await main.screenshot({ path: fullPath, timeout: 25000 });
  } else {
    await page.screenshot({ path: fullPath, fullPage: false, timeout: 25000 });
  }
  return {
    label,
    file: path.relative(pageDir, fullPath).replaceAll('\\', '/'),
    abs: fullPath,
  };
}

function relatedApi(stepId) {
  return apiEvents.filter((event) => event.stepId === stepId);
}

async function addStep(page, step) {
  steps.push({
    ...step,
    apiCalls: relatedApi(step.id),
    consoleErrors: consoleErrors.filter((event) => event.stepId === step.id),
    pageErrors: pageErrors.filter((event) => event.stepId === step.id),
  });
}

async function runStep(page, id, title, objective, actions, fn) {
  currentStepId = id;
  console.log(`[quality-trace-qa] START ${id} - ${title}`);
  try {
    const out = await fn();
    const evidence = out?.evidence ?? await capture(page, id, title);
    await addStep(page, {
      id,
      title,
      objective,
      actions,
      result: 'PASS',
      dbChecks: out?.dbChecks ?? [],
      evidence,
      notes: out?.notes ?? [],
    });
    console.log(`[quality-trace-qa] PASS ${id}`);
  } catch (err) {
    const evidence = await capture(page, `${id}-fail`, `${title} 실패`);
    await addStep(page, {
      id,
      title,
      objective,
      actions,
      result: 'FAIL',
      dbChecks: [],
      evidence,
      notes: [err.stack ?? err.message],
    });
    console.log(`[quality-trace-qa] FAIL ${id}: ${err.message}`);
    throw err;
  } finally {
    currentStepId = 'idle';
  }
}

async function injectAuth(page) {
  await page.goto(`${baseUrl}/login`, { waitUntil: 'domcontentloaded', timeout: 90000 });
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

async function waitForApi(page, pattern) {
  return page.waitForResponse((response) => response.url().includes(pattern), { timeout: 30000 });
}

async function openWizard(page) {
  if (await page.getByText('추적 방식 선택').isVisible().catch(() => false)) {
    return;
  }
  const changeButton = page.getByRole('button', { name: /방식 변경|추적 시작/ }).first();
  if (await changeButton.isVisible().catch(() => false)) {
    await changeButton.click({ timeout: 10000 });
  }
  await page.getByText('추적 방식 선택').waitFor({ state: 'visible', timeout: 10000 });
}

async function submitWizard(page, modeName, value) {
  await openWizard(page);
  await page.getByRole('button', { name: new RegExp(modeName) }).click({ timeout: 10000 });
  const dialog = page.locator('.fixed.inset-0').last();
  await dialog.getByRole('textbox').first().fill(value, { timeout: 10000 });
  const waitCandidates = waitForApi(page, '/quality/trace/candidates').catch(() => null);
  await dialog.getByRole('button', { name: /^(조회|검색)$/ }).click({ timeout: 10000 });
  await Promise.race([
    waitCandidates,
    dialog.waitFor({ state: 'hidden', timeout: 10000 }).catch(() => null),
  ]);
}

async function selectCandidate(page, fgBarcode) {
  const waitDetail = waitForApi(page, `/quality/trace?serial=${encodeURIComponent(fgBarcode)}`).catch(() => null);
  await page.getByRole('button', { name: new RegExp(fgBarcode) }).first().click({ timeout: 10000 });
  await waitDetail;
  await page.getByText(fgBarcode).first().waitFor({ state: 'visible', timeout: 15000 });
}

async function ensureText(page, text) {
  await page.getByText(text).first().waitFor({ state: 'visible', timeout: 15000 });
}

function apiEventToRows(events) {
  return events.map((event) => `
    <tr>
      <td>${escapeHtml(event.source)}</td>
      <td>${escapeHtml(event.method)}</td>
      <td><code>${escapeHtml(event.url)}</code></td>
      <td>${escapeHtml(event.status)}</td>
      <td>${event.ok ? 'OK' : 'FAIL'}</td>
    </tr>
  `).join('');
}

function dbCheckToHtml(checks) {
  if (checks.length === 0) return '<p>DB 확인 없음</p>';
  return checks.map((check) => `
    <section class="db-check">
      <h4>${escapeHtml(check.title)}</h4>
      <pre><code>${escapeHtml(check.sql)}</code></pre>
      <pre><code>${escapeHtml(JSON.stringify(check.result, null, 2))}</code></pre>
    </section>
  `).join('');
}

function makePageHtml(result) {
  const inventory = [
    ['추적 방식 선택 모달', 'UI 버튼/입력', '실행', '제품 바코드, 박스번호, 작업지시번호 방식 입력 검증'],
    ['제품 바코드 후보 조회', 'GET /quality/trace/candidates', '실행', testKeys.product],
    ['제품 상세 조회', 'GET /quality/trace?serial=', '실행', 'FG 후보 선택 및 상세 카드 표시 검증'],
    ['박스번호 후보 조회', 'GET /quality/trace/candidates', '실행', `${testKeys.box}, 후보 5건 기대`],
    ['작업지시번호 후보 조회', 'GET /quality/trace/candidates', '실행', `${testKeys.workOrder}, 후보 5건 기대`],
    ['자재/업체 LOT/팔레트/설비/작업자/SG 방식', '동일 모달 진입점', '목록화', '이번 요청 범위에서는 실제 데이터 3종만 실행'],
    ['데이터 생성/수정/삭제', '없음', '해당 없음', '조회 화면이라 테스트 데이터 생성 없음'],
  ];

  return stripTrailingWhitespace(`<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <title>HANES /quality/trace page QA</title>
  <style>
    body { font-family: Arial, "Malgun Gothic", sans-serif; margin: 24px; color: #17202a; }
    h1, h2, h3 { margin-bottom: 8px; }
    .summary { display: grid; grid-template-columns: repeat(4, minmax(120px, 1fr)); gap: 10px; margin: 16px 0; }
    .metric { border: 1px solid #d6dde6; border-radius: 8px; padding: 12px; background: #f8fafc; }
    table { width: 100%; border-collapse: collapse; margin: 12px 0; }
    th, td { border: 1px solid #d6dde6; padding: 8px; text-align: left; vertical-align: top; }
    th { background: #eef2f7; }
    article { border-top: 2px solid #d6dde6; margin-top: 24px; padding-top: 16px; }
    code, pre { background: #f6f8fa; }
    pre { padding: 10px; overflow-x: auto; border: 1px solid #d6dde6; border-radius: 6px; }
    img { max-width: 100%; border: 1px solid #d6dde6; border-radius: 6px; }
    .pass { color: #147d3f; font-weight: 700; }
    .fail { color: #b42318; font-weight: 700; }
  </style>
</head>
<body>
  <h1>추적관리 /quality/trace 실제 데이터 QA</h1>
  <p>Route: <code>/quality/trace</code> / Frontend: <code>${escapeHtml(baseUrl)}</code> / API: <code>${escapeHtml(apiUrl)}</code></p>
  <p>Test keys: <code>${escapeHtml(testKeys.product)}</code>, <code>${escapeHtml(testKeys.box)}</code>, <code>${escapeHtml(testKeys.workOrder)}</code></p>
  <p>Final status: <span class="${result.status === 'PASS' ? 'pass' : 'fail'}">${escapeHtml(result.status)}</span></p>
  <div class="summary">
    <div class="metric">Steps<br><strong>${result.steps.length}</strong></div>
    <div class="metric">API calls<br><strong>${result.apiEvents.length}</strong></div>
    <div class="metric">DB checks<br><strong>${result.dbCheckCount}</strong></div>
    <div class="metric">Screenshots<br><strong>${result.screenshotCount}</strong></div>
  </div>

  <h2>기능 인벤토리</h2>
  <table>
    <thead><tr><th>기능/버튼</th><th>처리 방식</th><th>상태</th><th>비고</th></tr></thead>
    <tbody>${inventory.map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`).join('')}</tbody>
  </table>

  <h2>시나리오 목차</h2>
  <ol>${result.steps.map((step) => `<li><a href="#${escapeHtml(step.id)}">${escapeHtml(step.title)}</a> - ${escapeHtml(step.result)}</li>`).join('')}</ol>

  ${result.steps.map((step) => `
    <article id="${escapeHtml(step.id)}">
      <h2>${escapeHtml(step.title)} <span class="${step.result === 'PASS' ? 'pass' : 'fail'}">${escapeHtml(step.result)}</span></h2>
      <p>${escapeHtml(step.objective)}</p>
      <h3>처리 액션</h3>
      <ol>${step.actions.map((action) => `<li>${escapeHtml(action)}</li>`).join('')}</ol>
      <h3>API 호출</h3>
      <table>
        <thead><tr><th>source</th><th>method</th><th>url</th><th>status</th><th>ok</th></tr></thead>
        <tbody>${apiEventToRows(step.apiCalls)}</tbody>
      </table>
      <h3>DB 확인</h3>
      ${dbCheckToHtml(step.dbChecks)}
      <h3>스크린샷</h3>
      <p>${escapeHtml(step.evidence.label)}</p>
      <img src="${escapeHtml(step.evidence.file)}" alt="${escapeHtml(step.evidence.label)}" />
      ${step.notes.length ? `<h3>Notes</h3><pre><code>${escapeHtml(step.notes.join('\n'))}</code></pre>` : ''}
    </article>
  `).join('')}
</body>
</html>`);
}

function makeIndexHtml(result) {
  return stripTrailingWhitespace(`<!doctype html>
<html lang="ko">
<head><meta charset="utf-8" /><title>HANES page scenario QA</title></head>
<body>
  <h1>HANES Page Scenario QA - ${escapeHtml(reportDate)}</h1>
  <ul>
    <li><a href="pages/quality-trace.html">/quality/trace 추적관리 실제 데이터 QA</a> - ${escapeHtml(result.status)}</li>
  </ul>
  <p>Result JSON: <a href="quality-trace-result.json">quality-trace-result.json</a></p>
</body>
</html>`);
}

async function main() {
  await fs.mkdir(pageDir, { recursive: true });
  await fs.mkdir(shotDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });

  page.on('console', (message) => {
    if (message.type() === 'error') {
      consoleErrors.push({ stepId: currentStepId, text: message.text() });
    }
  });
  page.on('pageerror', (error) => {
    pageErrors.push({ stepId: currentStepId, text: error.message });
  });
  page.on('requestfailed', (request) => {
    requestFailures.push({
      stepId: currentStepId,
      method: request.method(),
      url: request.url(),
      failure: request.failure()?.errorText ?? null,
    });
  });
  page.on('response', async (response) => {
    const url = response.url();
    if (!url.includes('/api/v1/quality/trace')) return;
    let preview = null;
    try {
      const text = await response.text();
      preview = text ? previewJson(JSON.parse(text)) : null;
    } catch {
      preview = null;
    }
    apiEvents.push({
      source: 'ui-network',
      stepId: currentStepId,
      method: response.request().method(),
      url: apiPath(url),
      status: response.status(),
      ok: response.ok(),
      responsePreview: preview,
    });
  });

  try {
    await runStep(page, 'load-page', '페이지 로드 및 모달 표시', '인증 세션을 주입하고 /quality/trace가 추적 방식 선택 모달로 시작하는지 확인한다.', [
      '로그인 페이지에서 localStorage 인증 상태를 주입한다.',
      '/quality/trace로 이동한다.',
      '추적 방식 선택 모달과 주요 방식 버튼이 표시되는지 확인한다.',
    ], async () => {
      await injectAuth(page);
      await page.goto(`${baseUrl}/quality/trace`, { waitUntil: 'domcontentloaded', timeout: 90000 });
      await ensureText(page, '추적 방식 선택');
      await ensureText(page, '제품 바코드');
      await ensureText(page, '박스번호');
      const dbChecks = [
        {
          title: 'Oracle 접속 컨텍스트',
          sql: "SELECT USER AS CURRENT_USER, SYS_CONTEXT('USERENV','CURRENT_SCHEMA') AS CURRENT_SCHEMA FROM DUAL",
          result: dbQuery("SELECT USER AS CURRENT_USER, SYS_CONTEXT('USERENV','CURRENT_SCHEMA') AS CURRENT_SCHEMA FROM DUAL"),
        },
      ];
      return { dbChecks, evidence: await capture(page, 'load-page', '초기 추적 방식 선택 모달') };
    });

    await runStep(page, 'product-barcode-search', '제품 바코드 실제 입력 조회', '제품 바코드를 직접 입력해 후보 1건과 제품 상세가 표시되는지 확인한다.', [
      `제품 바코드 방식을 선택한다.`,
      `${testKeys.product} 값을 입력하고 조회한다.`,
      '후보 및 상세 제품정보가 표시되는지 확인한다.',
      '동일 키로 직접 API와 Oracle FG_LABELS 근거를 확인한다.',
    ], async () => {
      const waitDetail = page.waitForResponse((response) => response.url().includes(`/quality/trace?serial=${encodeURIComponent(testKeys.product)}`), { timeout: 30000 }).catch(() => null);
      await submitWizard(page, '제품 바코드', testKeys.product);
      await waitDetail;
      await ensureText(page, testKeys.product);
      await page.getByText(/제품\s*정보/).first().waitFor({ state: 'visible', timeout: 15000 });
      const api = await directApi('GET', `/quality/trace?serial=${encodeURIComponent(testKeys.product)}`);
      const dbChecks = [
        { title: 'FG 라벨 단건', sql: fgSql(), result: dbQuery(fgSql()) },
        { title: '박스 마스터 연결', sql: boxSql(), result: dbQuery(boxSql()) },
      ];
      if (!api.res.ok || api.json?.data?.product?.serialNo !== testKeys.product) {
        throw new Error('제품 상세 API가 기대한 serialNo를 반환하지 않음');
      }
      return { dbChecks, evidence: await capture(page, 'product-barcode-search', '제품 바코드 조회 상세') };
    });

    await runStep(page, 'box-search', '박스번호 실제 입력 조회', '박스번호를 직접 입력해 박스 내 제품 후보가 목록화되고 후보 선택 시 상세가 표시되는지 확인한다.', [
      '방식 변경 버튼을 누른다.',
      '박스번호 방식을 선택한다.',
      `${testKeys.box} 값을 입력하고 조회한다.`,
      `${testKeys.product} 후보를 선택해 상세를 연다.`,
      '직접 API와 Oracle count로 박스 내 후보 수를 확인한다.',
    ], async () => {
      await submitWizard(page, '박스번호', testKeys.box);
      await ensureText(page, testKeys.product);
      await selectCandidate(page, testKeys.product);
      const api = await directApi('GET', `/quality/trace/candidates?mode=box&value=${encodeURIComponent(testKeys.box)}`);
      const dbChecks = [
        { title: '박스 내 FG 수량', sql: boxFgCountSql(), result: dbQuery(boxFgCountSql()) },
        { title: '박스 마스터', sql: boxSql(), result: dbQuery(boxSql()) },
      ];
      if (!api.res.ok || !Array.isArray(api.json?.data) || api.json.data.length !== 5) {
        throw new Error(`박스 후보 수가 기대값 5와 다름: ${api.json?.data?.length}`);
      }
      return { dbChecks, evidence: await capture(page, 'box-search', '박스번호 조회 후 후보 선택 상세') };
    });

    await runStep(page, 'work-order-search', '작업지시번호 실제 입력 조회', '작업지시번호를 직접 입력해 생산 제품 후보가 목록화되고 후보 선택 시 상세가 표시되는지 확인한다.', [
      '방식 변경 버튼을 누른다.',
      '작업지시번호 방식을 선택한다.',
      `${testKeys.workOrder} 값을 입력하고 조회한다.`,
      `${testKeys.product} 후보를 선택해 상세를 연다.`,
      '직접 API와 Oracle count로 작업지시 후보 수를 확인한다.',
    ], async () => {
      await submitWizard(page, '작업지시번호', testKeys.workOrder);
      await ensureText(page, testKeys.product);
      await selectCandidate(page, testKeys.product);
      const api = await directApi('GET', `/quality/trace/candidates?mode=workOrder&value=${encodeURIComponent(testKeys.workOrder)}`);
      const dbChecks = [
        { title: '작업지시 FG 수량', sql: workOrderFgCountSql(), result: dbQuery(workOrderFgCountSql()) },
        { title: '대표 FG 라벨', sql: fgSql(), result: dbQuery(fgSql()) },
      ];
      if (!api.res.ok || !Array.isArray(api.json?.data) || api.json.data.length !== 5) {
        throw new Error(`작업지시 후보 수가 기대값 5와 다름: ${api.json?.data?.length}`);
      }
      return { dbChecks, evidence: await capture(page, 'work-order-search', '작업지시번호 조회 후 후보 선택 상세') };
    });

    await runStep(page, 'final-readonly-cleanup', '읽기 전용 최종 확인', '조회 QA가 테스트 데이터를 생성하지 않았고 TRACEQA 잔여 데이터가 없는지 확인한다.', [
      '조회 시나리오 종료 후 DB residue query를 실행한다.',
      'TRACEQA 접두 테스트 데이터가 0건인지 확인한다.',
    ], async () => {
      const result = dbQuery(residueSql());
      const count = Number(result.data?.[0]?.TEST_RESIDUE ?? -1);
      if (count !== 0) throw new Error(`TRACEQA residue count is ${count}`);
      return {
        dbChecks: [{ title: 'TRACEQA 잔여 데이터', sql: residueSql(), result }],
        evidence: await capture(page, 'final-readonly-cleanup', '최종 조회 화면'),
        notes: ['이번 QA는 조회 전용이라 INSERT/UPDATE/DELETE를 수행하지 않았다.'],
      };
    });
  } finally {
    await browser.close();
  }

  const status = steps.every((step) => step.result === 'PASS') && pageErrors.length === 0 ? 'PASS' : 'FAIL';
  const result = {
    status,
    route: '/quality/trace',
    baseUrl,
    apiUrl,
    oracleSite,
    testKeys,
    generatedAt: new Date().toISOString(),
    steps,
    apiEvents,
    consoleErrors,
    pageErrors,
    requestFailures,
    dbCheckCount: steps.reduce((sum, step) => sum + step.dbChecks.length, 0),
    screenshotCount: steps.filter((step) => step.evidence?.file).length,
    reportPaths: {
      index: indexPath,
      page: pagePath,
      result: resultPath,
      screenshots: shotDir,
    },
  };

  await fs.writeFile(resultPath, JSON.stringify(result, null, 2), 'utf8');
  await fs.writeFile(pagePath, makePageHtml(result), 'utf8');
  await fs.writeFile(indexPath, makeIndexHtml(result), 'utf8');

  if (status !== 'PASS') {
    throw new Error(`quality trace page scenario status ${status}`);
  }
  console.log(JSON.stringify({
    status,
    indexPath,
    pagePath,
    resultPath,
    stepCount: steps.length,
    apiCallCount: apiEvents.length,
    dbCheckCount: result.dbCheckCount,
    screenshotCount: result.screenshotCount,
  }, null, 2));
}

main().catch((err) => {
  console.error(err.stack ?? err.message);
  process.exit(1);
});
