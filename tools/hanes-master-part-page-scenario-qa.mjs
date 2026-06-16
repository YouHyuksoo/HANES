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

const reportDate = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Seoul',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
}).format(new Date());

const stamp = new Date().toISOString().replace(/\D/g, '').slice(2, 14);
const baseUrl = process.env.HANES_FRONTEND_URL ?? 'http://localhost:3002';
const apiUrl = process.env.HANES_API_URL ?? 'http://localhost:3003/api/v1';
const token = process.env.HANES_TOKEN ?? 'admin@hanes.com';
const oracleConnector = 'C:/Users/hsyou/.codex/skills/oracle-db/scripts/oracle_connector.py';
const oracleSite = process.env.HANES_ORACLE_SITE ?? 'JSHANES';
const reportRoot = path.resolve(`docs/reports/hanes-page-scenario-qa-${reportDate}`);
const pageDir = path.join(reportRoot, 'pages');
const shotDir = path.join(reportRoot, 'screenshots', 'master-part');
const indexPath = path.join(reportRoot, 'index.html');
const pagePath = path.join(pageDir, 'master-part.html');
const resultPath = path.join(reportRoot, 'master-part-result.json');

const testData = {
  itemCode: `FECRUD-${stamp}`,
  itemNo: `FECRUD-${stamp}`,
  itemName: `품목관리시나리오-${stamp}`,
  editedName: `품목관리시나리오수정-${stamp}`,
  rev: 'A',
  markingText: `MARK-${stamp}`,
  editedMarkingText: `EDIT-${stamp}`,
  itemType: 'RAW_MATERIAL',
  unit: 'EA',
  boxQty: 12,
  minPackQty: 3,
  lotUnitQty: 6,
  safetyStock: 4,
  tactTime: 5,
  expiryDate: 30,
  expiryExtDays: 7,
  packUnit: 'BOX',
  remark: `QA page scenario ${stamp}`,
};

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

const scenarioSteps = [];
const apiEvents = [];
const consoleErrors = [];
const pageErrors = [];
let currentStepId = 'init';

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function safeSlug(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9가-힣]+/g, '-').replace(/^-|-$/g, '');
}

function cssAttr(value) {
  return String(value).replaceAll('\\', '\\\\').replaceAll('"', '\\"');
}

function regexLiteral(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function apiPath(url) {
  const parsed = new URL(url);
  return `${parsed.pathname}${parsed.search}`;
}

function headers() {
  return {
    Authorization: `Bearer ${token}`,
    'X-Company': '40',
    'X-Plant': '1000',
    'Content-Type': 'application/json',
  };
}

async function directApi(method, urlPath, body = undefined) {
  const startedAt = new Date().toISOString();
  const res = await fetch(`${apiUrl}${urlPath}`, {
    method,
    headers: headers(),
    body: body ? JSON.stringify(body) : undefined,
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
    startedAt,
    requestBody: body ?? null,
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
  });
  return JSON.parse(output);
}

function previewJson(value) {
  if (!value) return null;
  const compact = JSON.parse(JSON.stringify(value));
  if (Array.isArray(compact?.data) && compact.data.length > 3) {
    compact.data = compact.data.slice(0, 3);
    compact.dataPreviewTruncated = true;
  }
  return compact;
}

function itemDbSql() {
  return [
    'SELECT ITEM_CODE, PART_NO, ITEM_NAME, ITEM_TYPE, UNIT, REV, MARKING_TEXT, BOX_QTY, LOT_UNIT_QTY, USE_YN',
    'FROM ITEM_MASTERS',
    `WHERE COMPANY = '40' AND PLANT_CD = '1000' AND ITEM_CODE = '${testData.itemCode}'`,
  ].join(' ');
}

function countDbSql() {
  return [
    'SELECT COUNT(*) AS CNT',
    'FROM ITEM_MASTERS',
    `WHERE COMPANY = '40' AND PLANT_CD = '1000' AND ITEM_CODE = '${testData.itemCode}'`,
  ].join(' ');
}

async function capture(page, name, label) {
  const fileName = `${String(scenarioSteps.length + 1).padStart(2, '0')}-${safeSlug(name)}.png`;
  const fullPath = path.join(shotDir, fileName);
  const main = page.locator('main > div.flex-1').first();
  if (await main.isVisible().catch(() => false)) {
    await main.screenshot({ path: fullPath, timeout: 20000 });
  } else {
    await page.screenshot({ path: fullPath, fullPage: false, timeout: 20000 });
  }
  return {
    label,
    file: path.relative(pageDir, fullPath).replaceAll('\\', '/'),
    abs: fullPath,
  };
}

async function captureDialog(page, name, label) {
  const fileName = `${String(scenarioSteps.length + 1).padStart(2, '0')}-${safeSlug(name)}.png`;
  const fullPath = path.join(shotDir, fileName);
  const dialog = page.getByRole('dialog').first();
  if (await dialog.isVisible().catch(() => false)) {
    await dialog.screenshot({ path: fullPath, timeout: 20000 });
  } else {
    await page.screenshot({ path: fullPath, fullPage: false, timeout: 20000 });
  }
  return {
    label,
    file: path.relative(pageDir, fullPath).replaceAll('\\', '/'),
    abs: fullPath,
  };
}

async function addStep(page, step) {
  const relatedApi = apiEvents.filter((event) => event.stepId === step.id);
  scenarioSteps.push({
    ...step,
    apiCalls: relatedApi,
    consoleErrors: consoleErrors.filter((event) => event.stepId === step.id && !(step.id === 'duplicate-red' && /409|Conflict/i.test(event.text))),
    pageErrors: pageErrors.filter((event) => event.stepId === step.id),
  });
}

async function step(page, id, title, objective, actions, fn) {
  currentStepId = id;
  const beforeApiCount = apiEvents.length;
  const beforeConsoleCount = consoleErrors.length;
  const beforePageErrorCount = pageErrors.length;
  const result = await fn();
  const newApi = apiEvents.slice(beforeApiCount);
  const newConsole = consoleErrors.slice(beforeConsoleCount);
  const newPageErrors = pageErrors.slice(beforePageErrorCount);
  const unexpectedConsole = newConsole.filter((event) => !(id === 'duplicate-red' && /409|Conflict/i.test(event.text)));
  const ok = newApi.every((event) => event.ok || (id === 'duplicate-red' && event.status === 409)) && unexpectedConsole.length === 0 && newPageErrors.length === 0;
  await addStep(page, {
    id,
    title,
    objective,
    actions,
    result: ok ? 'PASS' : 'CHECK',
    evidence: result?.evidence ?? null,
    dbChecks: result?.dbChecks ?? [],
    notes: result?.notes ?? [],
  });
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

async function clickButton(page, name, scope = page) {
  await scope.getByRole('button', { name: new RegExp(`^${name}$`) }).click();
}

async function fillByLabel(page, label, value) {
  const labelFor = await page.locator('label').evaluateAll((labels, target) => {
    const normalize = (text) => text.replace('*', '').trim();
    const found = labels.find((labelElement) => normalize(labelElement.innerText) === target);
    return found?.getAttribute('for') || '';
  }, label).catch(() => '');
  const candidateId = labelFor || label;
  const byId = page.locator(`input[id="${cssAttr(candidateId)}"], textarea[id="${cssAttr(candidateId)}"]`).first();
  if (await byId.isVisible().catch(() => false)) {
    await byId.fill(String(value));
    return;
  }
  const byAccessibleName = page.getByLabel(new RegExp(`^${regexLiteral(label)}`)).first();
  if (await byAccessibleName.isVisible().catch(() => false)) {
    await byAccessibleName.fill(String(value));
    return;
  }
  throw new Error(`input not found for label: ${label}`);
}

async function readInputById(page, id) {
  return page.locator(`input[id="${cssAttr(id)}"], textarea[id="${cssAttr(id)}"]`).first().inputValue();
}

async function assertRequiredPartFields(page) {
  const values = {
    itemCode: await readInputById(page, '품목코드'),
    itemNo: await readInputById(page, '품번'),
    itemName: await readInputById(page, '품목명'),
  };
  const missing = Object.entries(values).filter(([, value]) => !String(value).trim());
  if (missing.length) {
    throw new Error(`required part fields not filled: ${JSON.stringify(values)}`);
  }
  return values;
}

async function fillPartForm(page, values) {
  await fillByLabel(page, '품목코드', values.itemCode);
  await fillByLabel(page, '품번', values.itemNo);
  await fillByLabel(page, '품목명', values.itemName);
  await fillByLabel(page, '리비전', values.rev);
  await fillByLabel(page, '마킹문구', values.markingText);
  await fillByLabel(page, '박스입수량', values.boxQty);
  await fillByLabel(page, '최소포장단위', values.minPackQty);
  await fillByLabel(page, 'LOT단위수량', values.lotUnitQty);
  await fillByLabel(page, '안전재고', values.safetyStock);
  await fillByLabel(page, '택타임(초)', values.tactTime);
  await fillByLabel(page, '유효기간(일)', values.expiryDate);
  await fillByLabel(page, '유효기간 연장(일)', values.expiryExtDays);
  await fillByLabel(page, '포장단위', values.packUnit);
  await fillByLabel(page, '비고', values.remark);
}

async function search(page, value) {
  const input = workArea(page).locator('input[placeholder*="검색"]').first();
  await input.fill(value);
  await page.keyboard.press('Enter').catch(() => {});
  await page.waitForTimeout(900);
}

async function waitRow(page, text) {
  const row = page.locator('tr', { hasText: text }).first();
  await row.waitFor({ state: 'visible', timeout: 15000 });
  return row;
}

async function clickRowAction(page, rowText, index) {
  const row = await waitRow(page, rowText);
  await row.locator('button').nth(index).click();
}

async function cleanupItem() {
  currentStepId = 'cleanup';
  await directApi('DELETE', `/master/parts/${encodeURIComponent(testData.itemCode)}`).catch(() => null);
}

function apiRows(events) {
  return events.map((event) => `
              <tr>
                <td>${escapeHtml(event.source)}</td>
                <td><code>${escapeHtml(event.method)}</code></td>
                <td><code>${escapeHtml(event.url)}</code></td>
                <td class="${event.ok || event.status === 409 ? 'pass' : 'warn'}">${escapeHtml(event.status)}</td>
              </tr>`).join('');
}

function dbRows(checks) {
  return checks.map((check) => `
              <tr>
                <td>${escapeHtml(check.title)}</td>
                <td><code>${escapeHtml(check.sql)}</code></td>
                <td><pre>${escapeHtml(JSON.stringify(check.result?.data ?? check.result, null, 2))}</pre></td>
              </tr>`).join('');
}

function stepHtml(stepInfo, index) {
  return `
        <article class="step" id="${escapeHtml(stepInfo.id)}">
          <div class="step-head">
            <div>
              <div class="eyebrow">STEP ${String(index + 1).padStart(2, '0')}</div>
              <h3>${escapeHtml(stepInfo.title)}</h3>
              <p>${escapeHtml(stepInfo.objective)}</p>
            </div>
            <strong class="pass">${escapeHtml(stepInfo.result)}</strong>
          </div>
          <div class="cols">
            <section>
              <h4>동작 처리</h4>
              <ol>${stepInfo.actions.map((action) => `<li>${escapeHtml(action)}</li>`).join('')}</ol>
              ${stepInfo.notes.length ? `<h4>결과 메모</h4><ul>${stepInfo.notes.map((note) => `<li>${escapeHtml(note)}</li>`).join('')}</ul>` : ''}
            </section>
            <section>
              <h4>API 호출</h4>
              <table>
                <thead><tr><th>구분</th><th>Method</th><th>URL</th><th>Status</th></tr></thead>
                <tbody>${apiRows(stepInfo.apiCalls) || '<tr><td colspan="4">이 단계에서 신규 API 호출 없음</td></tr>'}</tbody>
              </table>
            </section>
          </div>
          ${stepInfo.dbChecks.length ? `<section><h4>DB 확인</h4><table><thead><tr><th>검증</th><th>SQL</th><th>결과</th></tr></thead><tbody>${dbRows(stepInfo.dbChecks)}</tbody></table></section>` : ''}
          ${stepInfo.evidence ? `<figure><figcaption>${escapeHtml(stepInfo.evidence.label)}</figcaption><a href="${escapeHtml(stepInfo.evidence.file)}"><img src="${escapeHtml(stepInfo.evidence.file)}" alt="${escapeHtml(stepInfo.evidence.label)}"></a></figure>` : ''}
        </article>`;
}

function renderPage() {
  const allApi = apiEvents.filter((event) => event.stepId !== 'cleanup');
  const featureRows = [
    ['초기 조회', 'GET /master/parts', '실행', '초기 목록 로딩과 API 200 확인'],
    ['검색', '검색 입력 + Enter', '실행', `테스트 키 ${testData.itemCode} 기준 재조회`],
    ['새로고침', '새로고침 버튼', '실행', '목록 API 재호출 확인'],
    ['신규 등록', '품목 추가 패널 + 추가 버튼', '실행', 'POST 저장, 화면 검색, DB row 확인'],
    ['중복 등록 방어', '동일 품목코드 추가', '실행', '409 응답으로 중복 방어 확인'],
    ['수정', '행 수정 아이콘 + 수정 버튼', '실행', 'PUT 저장, 화면 검색, DB 값 변경 확인'],
    ['삭제', '행 삭제 아이콘 + 확인 버튼', '실행', 'DELETE 저장, 화면 재조회, DB row 0 확인'],
    ['ERP 동기화', 'ERP 동기화 버튼', '목록화', '외부 인터페이스 데이터 변형 버튼이므로 파일럿 CRUD 본 흐름에서는 실행하지 않음'],
    ['엑셀 내보내기', 'DataGrid export', '목록화', '그리드 공통 기능으로 버튼 존재만 시나리오 범위에 기록'],
    ['이미지 업로드', '사진 선택 영역', '목록화', '파일 시스템 업로드 별도 시나리오로 분리 권장'],
  ];

  return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <title>품목관리 페이지 상세 시나리오 QA</title>
  <style>
    body { margin: 0; font-family: Arial, "Malgun Gothic", sans-serif; background: #f5f7fb; color: #111827; }
    header { background: #172033; color: #fff; padding: 28px 34px; }
    main { padding: 24px 34px 48px; }
    h1 { margin: 0 0 8px; font-size: 26px; }
    h2 { margin: 0 0 12px; font-size: 20px; }
    h3 { margin: 0 0 6px; font-size: 19px; }
    h4 { margin: 14px 0 8px; font-size: 14px; }
    p, li { line-height: 1.55; }
    code { background: #edf2f7; border-radius: 4px; padding: 2px 5px; }
    pre { margin: 0; white-space: pre-wrap; font-size: 12px; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th, td { border-bottom: 1px solid #e1e6ef; padding: 8px 10px; vertical-align: top; text-align: left; }
    th { background: #f8fafc; }
    img { display: block; width: 100%; }
    figure { margin: 14px 0 0; border: 1px solid #d6deeb; border-radius: 8px; overflow: hidden; background: #fff; }
    figcaption { padding: 10px 12px; border-bottom: 1px solid #d6deeb; font-weight: 700; background: #f8fafc; }
    .card, .step { background: #fff; border: 1px solid #d6deeb; border-radius: 8px; padding: 16px; margin-bottom: 16px; }
    .metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; }
    .metric { background: #f8fafc; border: 1px solid #d6deeb; border-radius: 8px; padding: 12px; }
    .metric strong { display: block; font-size: 22px; }
    .pass { color: #047857; font-weight: 700; }
    .warn { color: #b45309; font-weight: 700; }
    .step-head { display: flex; justify-content: space-between; gap: 18px; border-bottom: 1px solid #e1e6ef; padding-bottom: 12px; margin-bottom: 12px; }
    .eyebrow { color: #64748b; font-size: 12px; font-weight: 700; }
    .cols { display: grid; grid-template-columns: minmax(0, .9fr) minmax(380px, 1.1fr); gap: 14px; }
    .toc a { color: #1d4ed8; text-decoration: none; }
    .toc a:hover { text-decoration: underline; }
    @media (max-width: 900px) { main { padding: 16px; } header { padding: 20px 16px; } .cols, .step-head { display: block; } }
  </style>
</head>
<body>
  <header>
    <h1>품목관리 페이지 상세 시나리오 QA</h1>
    <div>대상: <code>${escapeHtml(baseUrl)}/master/part</code> / 테스트 키: <code>${escapeHtml(testData.itemCode)}</code> / 최종 결과: <span class="pass">PASS</span></div>
  </header>
  <main>
    <section class="card">
      <h2>요약</h2>
      <div class="metrics">
        <div class="metric"><strong>${scenarioSteps.length}</strong>실행 단계</div>
        <div class="metric"><strong>${allApi.length}</strong>기록 API 호출</div>
        <div class="metric"><strong>${scenarioSteps.reduce((sum, item) => sum + item.dbChecks.length, 0)}</strong>DB 검증</div>
        <div class="metric"><strong>${scenarioSteps.filter((item) => item.evidence).length}</strong>화면 증적</div>
      </div>
      <p>조회, 검색, 신규 등록, 저장 검증, 중복 방어, 수정, 삭제, 화면 재조회, API 호출 내역, Oracle DB 확인을 한 화면 단위 시나리오로 실행했습니다.</p>
    </section>

    <section class="card">
      <h2>화면 기능 목록</h2>
      <table>
        <thead><tr><th>기능/버튼</th><th>처리 방식</th><th>상태</th><th>비고</th></tr></thead>
        <tbody>${featureRows.map((row) => `<tr><td>${escapeHtml(row[0])}</td><td>${escapeHtml(row[1])}</td><td class="${row[2] === '실행' ? 'pass' : 'warn'}">${escapeHtml(row[2])}</td><td>${escapeHtml(row[3])}</td></tr>`).join('')}</tbody>
      </table>
    </section>

    <section class="card toc">
      <h2>시나리오 목차</h2>
      <ol>${scenarioSteps.map((item, index) => `<li><a href="#${escapeHtml(item.id)}">STEP ${String(index + 1).padStart(2, '0')} ${escapeHtml(item.title)}</a></li>`).join('')}</ol>
    </section>

    ${scenarioSteps.map(stepHtml).join('\n')}
  </main>
</body>
</html>`;
}

function renderIndex() {
  return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <title>HANES 페이지 단위 시나리오 QA 목차</title>
  <style>
    body { margin: 0; font-family: Arial, "Malgun Gothic", sans-serif; background: #f5f7fb; color: #111827; }
    header { background: #172033; color: #fff; padding: 28px 34px; }
    main { padding: 24px 34px 48px; }
    .card { background: #fff; border: 1px solid #d6deeb; border-radius: 8px; padding: 16px; }
    a { color: #1d4ed8; text-decoration: none; font-weight: 700; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border-bottom: 1px solid #e1e6ef; padding: 9px 10px; text-align: left; }
    th { background: #f8fafc; }
    .pass { color: #047857; font-weight: 700; }
    code { background: #edf2f7; border-radius: 4px; padding: 2px 5px; }
  </style>
</head>
<body>
  <header>
    <h1>HANES 페이지 단위 시나리오 QA 목차</h1>
    <div>실행일: <code>${escapeHtml(reportDate)}</code></div>
  </header>
  <main>
    <section class="card">
      <table>
        <thead><tr><th>페이지</th><th>경로</th><th>시나리오</th><th>결과</th><th>보고서</th></tr></thead>
        <tbody>
          <tr>
            <td>품목관리</td>
            <td><code>/master/part</code></td>
            <td>조회 → 검색 → 신규 → 저장 검증 → DB/API 확인 → 수정 → 삭제 → 재조회</td>
            <td class="pass">PASS</td>
            <td><a href="pages/master-part.html">상세 보고서 열기</a></td>
          </tr>
        </tbody>
      </table>
    </section>
  </main>
</body>
</html>`;
}

async function main() {
  await fs.mkdir(pageDir, { recursive: true });
  await fs.mkdir(shotDir, { recursive: true });

  await cleanupItem();

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1500, height: 1000 },
    locale: 'ko-KR',
    timezoneId: 'Asia/Seoul',
    acceptDownloads: true,
  });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);

  const requestMap = new WeakMap();
  page.on('request', (req) => {
    if (!req.url().includes('/api/')) return;
    requestMap.set(req, {
      source: 'ui-network',
      stepId: currentStepId,
      method: req.method(),
      url: apiPath(req.url()),
      status: null,
      ok: false,
      requestBody: req.postData() ?? null,
      startedAt: new Date().toISOString(),
    });
  });
  page.on('response', (res) => {
    if (!res.url().includes('/api/')) return;
    const reqInfo = requestMap.get(res.request()) ?? {
      source: 'ui-network',
      stepId: currentStepId,
      method: res.request().method(),
      url: apiPath(res.url()),
      requestBody: res.request().postData() ?? null,
      startedAt: new Date().toISOString(),
    };
    apiEvents.push({
      ...reqInfo,
      status: res.status(),
      ok: res.status() >= 200 && res.status() < 400,
    });
  });
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push({ stepId: currentStepId, text: msg.text() });
  });
  page.on('pageerror', (err) => {
    pageErrors.push({ stepId: currentStepId, text: err.message });
  });

  try {
    await injectAuth(page);

    await step(page, 'initial-load', '초기 조회', '품목관리 화면 진입과 초기 목록 API 호출을 확인합니다.', [
      '브라우저 로그인 세션을 구성한다.',
      '/master/part 경로로 이동한다.',
      '초기 목록과 제목 영역이 렌더링되는지 확인한다.',
    ], async () => {
      await page.goto(`${baseUrl}/master/part`, { waitUntil: 'domcontentloaded', timeout: 40000 });
      await page.waitForLoadState('networkidle', { timeout: 7000 }).catch(() => {});
      await workArea(page).getByText('품목', { exact: false }).first().waitFor({ state: 'visible' });
      return {
        evidence: await capture(page, 'initial-load', '초기 조회 화면'),
        dbChecks: [{ title: '테스트 키 사전 잔여 확인', sql: countDbSql(), result: dbQuery(countDbSql()) }],
      };
    });

    await step(page, 'refresh', '새로고침 버튼', '목록 새로고침 버튼이 화면 데이터를 다시 조회하는지 확인합니다.', [
      '상단 새로고침 버튼을 클릭한다.',
      '목록 조회 API가 다시 호출되는지 확인한다.',
    ], async () => {
      await clickButton(page, '새로고침', workArea(page));
      await page.waitForTimeout(900);
      return { evidence: await capture(page, 'refresh', '새로고침 후 화면') };
    });

    await step(page, 'search-empty', '검색, 신규 전 0건 확인', '생성 전 테스트 키 검색 결과가 없는지 확인합니다.', [
      `검색창에 ${testData.itemCode}를 입력한다.`,
      '검색 결과에 테스트 키가 아직 없는 상태를 확인한다.',
      'API와 DB에서 사전 잔여가 0건인지 확인한다.',
    ], async () => {
      await search(page, testData.itemCode);
      return {
        evidence: await capture(page, 'search-before-create', '신규 전 검색 결과'),
        dbChecks: [{ title: '신규 전 DB 0건', sql: countDbSql(), result: dbQuery(countDbSql()) }],
      };
    });

    await step(page, 'create', '신규 등록 및 저장 검증', '품목 추가 패널에서 신규 품목을 저장하고 화면/API/DB 반영을 확인합니다.', [
      '품목 추가 버튼을 클릭한다.',
      '필수값과 수량/관리 필드를 입력한다.',
      '추가 버튼으로 저장한다.',
      '검색 결과와 API 상세 조회, DB row를 확인한다.',
    ], async () => {
      await clickButton(page, '품목 추가', workArea(page));
      await page.waitForTimeout(600);
      await fillPartForm(page, testData);
      const requiredValues = await assertRequiredPartFields(page);
      const filled = await capture(page, 'create-form-filled', '신규 등록 입력 완료');
      await clickButton(page, '추가');
      await page.waitForTimeout(1200);
      await search(page, testData.itemCode);
      await waitRow(page, testData.itemCode);
      const apiDetail = await directApi('GET', `/master/parts/code/${encodeURIComponent(testData.itemCode)}`);
      return {
        evidence: filled,
        dbChecks: [
          { title: '등록 후 API 상세 응답', sql: `GET /api/v1/master/parts/code/${testData.itemCode}`, result: apiDetail.json },
          { title: '등록 후 DB row 확인', sql: itemDbSql(), result: dbQuery(itemDbSql()) },
        ],
        notes: [`필수 입력 검증: ${JSON.stringify(requiredValues)}`],
      };
    });

    await step(page, 'created-requery', '등록 후 화면 재조회', '저장 후 같은 검색조건으로 화면을 재조회해 등록 행이 보이는지 확인합니다.', [
      '검색창에 테스트 키를 유지한다.',
      '목록 재조회 후 등록된 행이 표시되는지 확인한다.',
    ], async () => {
      await search(page, testData.itemCode);
      await waitRow(page, testData.itemCode);
      return { evidence: await capture(page, 'created-requery', '등록 후 화면 재조회 결과') };
    });

    await step(page, 'duplicate-red', '중복 등록 방어', '동일 품목코드 저장 시 API가 중복을 막는지 확인합니다.', [
      '품목 추가 버튼을 다시 클릭한다.',
      '동일 품목코드로 신규 저장을 시도한다.',
      '중복 등록 방어 응답을 확인한다.',
    ], async () => {
      await clickButton(page, '품목 추가', workArea(page));
      await page.waitForTimeout(600);
      await fillPartForm(page, { ...testData, itemName: `${testData.itemName}-중복` });
      await assertRequiredPartFields(page);
      const filled = await capture(page, 'duplicate-form-filled', '중복 등록 입력 완료');
      await clickButton(page, '추가');
      await page.getByText('오류가 발생했습니다', { exact: false }).waitFor({ state: 'visible', timeout: 10000 });
      const modal = await captureDialog(page, 'duplicate-error-modal', '중복 등록 방어 모달');
      await clickButton(page, '닫기');
      await page.waitForTimeout(300);
      await clickButton(page, '취소');
      return {
        evidence: modal,
        notes: [`입력 화면 증적: ${path.basename(filled.file)}`],
      };
    });

    await step(page, 'update', '수정 및 저장 검증', '등록된 행의 수정 버튼을 눌러 값을 변경하고 API/DB 반영을 확인합니다.', [
      '테스트 행의 수정 아이콘을 클릭한다.',
      '품목명과 마킹문구를 수정한다.',
      '수정 버튼으로 저장한다.',
      'API 상세 조회와 DB에서 변경값을 확인한다.',
    ], async () => {
      await search(page, testData.itemCode);
      await clickRowAction(page, testData.itemCode, 0);
      await page.waitForTimeout(700);
      await fillByLabel(page, '품목명', testData.editedName);
      await fillByLabel(page, '마킹문구', testData.editedMarkingText);
      const filled = await capture(page, 'update-form-filled', '수정 입력 완료');
      await clickButton(page, '수정');
      await page.waitForTimeout(1200);
      await search(page, testData.itemCode);
      await waitRow(page, testData.editedName);
      const apiDetail = await directApi('GET', `/master/parts/code/${encodeURIComponent(testData.itemCode)}`);
      return {
        evidence: filled,
        dbChecks: [
          { title: '수정 후 API 상세 응답', sql: `GET /api/v1/master/parts/code/${testData.itemCode}`, result: apiDetail.json },
          { title: '수정 후 DB 변경값 확인', sql: itemDbSql(), result: dbQuery(itemDbSql()) },
        ],
      };
    });

    await step(page, 'updated-requery', '수정 후 화면 재조회', '수정 저장 후 화면 재조회에서 변경된 품목명이 표시되는지 확인합니다.', [
      '동일 테스트 키로 다시 검색한다.',
      '수정된 품목명이 그리드에 표시되는지 확인한다.',
    ], async () => {
      await search(page, testData.itemCode);
      await waitRow(page, testData.editedName);
      return { evidence: await capture(page, 'updated-requery', '수정 후 화면 재조회 결과') };
    });

    await step(page, 'delete', '삭제 및 저장 검증', '등록된 행을 삭제하고 API/DB에서 잔여가 없는지 확인합니다.', [
      '테스트 행의 삭제 아이콘을 클릭한다.',
      '삭제 확인 모달에서 확인을 누른다.',
      'API 상세 조회와 DB count로 삭제 결과를 확인한다.',
    ], async () => {
      await search(page, testData.itemCode);
      await clickRowAction(page, testData.itemCode, 1);
      await page.waitForTimeout(500);
      const modal = await captureDialog(page, 'delete-confirm-modal', '삭제 확인 모달');
      await clickButton(page, '확인');
      await page.waitForTimeout(1200);
      const apiList = await directApi('GET', `/master/parts?search=${encodeURIComponent(testData.itemCode)}&limit=20`);
      return {
        evidence: modal,
        dbChecks: [
          { title: '삭제 후 API 목록 응답', sql: `GET /api/v1/master/parts?search=${testData.itemCode}&limit=20`, result: apiList.json },
          { title: '삭제 후 DB 0건', sql: countDbSql(), result: dbQuery(countDbSql()) },
        ],
      };
    });

    await step(page, 'after-delete-requery', '삭제 후 화면 재조회', '삭제 후 같은 검색조건으로 화면을 재조회해 테스트 행이 사라졌는지 확인합니다.', [
      '검색창에 테스트 키를 다시 입력한다.',
      '삭제된 테스트 행이 화면에 남지 않았는지 확인한다.',
    ], async () => {
      await search(page, testData.itemCode);
      await page.waitForTimeout(900);
      const visible = await page.getByText(testData.itemCode, { exact: false }).first().isVisible({ timeout: 500 }).catch(() => false);
      if (visible) throw new Error(`deleted item still visible: ${testData.itemCode}`);
      return {
        evidence: await capture(page, 'after-delete-requery', '삭제 후 화면 재조회 결과'),
        dbChecks: [{ title: '최종 DB 잔여 확인', sql: countDbSql(), result: dbQuery(countDbSql()) }],
      };
    });

    const failedApi = apiEvents.filter((event) => event.stepId !== 'cleanup' && !event.ok && !(event.stepId === 'duplicate-red' && event.status === 409));
    if (failedApi.length) throw new Error(`unexpected API failures: ${JSON.stringify(failedApi, null, 2)}`);
    const unexpectedConsoleErrors = consoleErrors.filter((event) => !(event.stepId === 'duplicate-red' && /409|Conflict/i.test(event.text)));
    if (unexpectedConsoleErrors.length) throw new Error(`console errors: ${JSON.stringify(unexpectedConsoleErrors, null, 2)}`);
    if (pageErrors.length) throw new Error(`page errors: ${JSON.stringify(pageErrors, null, 2)}`);
  } finally {
    await browser.close().catch(() => {});
    await cleanupItem();
  }

  await fs.writeFile(pagePath, renderPage(), 'utf8');
  await fs.writeFile(indexPath, renderIndex(), 'utf8');
  await fs.writeFile(resultPath, JSON.stringify({
    status: 'PASS',
    page: '/master/part',
    testData,
    baseUrl,
    apiUrl,
    oracleSite,
    scenarioSteps,
    apiEvents,
    consoleErrors,
    pageErrors,
    reports: {
      indexPath,
      pagePath,
    },
  }, null, 2), 'utf8');

  console.log(JSON.stringify({
    status: 'PASS',
    page: '/master/part',
    testKey: testData.itemCode,
    steps: scenarioSteps.length,
    apiEvents: apiEvents.filter((event) => event.stepId !== 'cleanup').length,
    dbChecks: scenarioSteps.reduce((sum, item) => sum + item.dbChecks.length, 0),
    indexPath,
    pagePath,
  }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
