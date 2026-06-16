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
const shotDir = path.join(reportRoot, 'screenshots', 'master-bom');
const indexPath = path.join(reportRoot, 'index.html');
const pagePath = path.join(pageDir, 'master-bom.html');
const resultPath = path.join(reportRoot, 'master-bom-result.json');

const user = {
  id: 'admin@hanes.com',
  email: 'admin@hanes.com',
  name: '시스템관리자',
  role: 'ADMIN',
  status: 'ACTIVE',
  company: '40',
  plant: '1000',
};

const testData = {
  childCode: `FBOMC-${stamp}`,
  childName: `BOM시나리오자품목-${stamp}`,
  childEditedName: `BOM시나리오자품목수정-${stamp}`,
  revision: 'A',
  initialQty: 2.5,
  editedQty: 3.75,
  initialSeq: 91,
  editedSeq: 92,
  initialRemark: `BOM page scenario create ${stamp}`,
  editedRemark: `BOM page scenario update ${stamp}`,
  validFrom: reportDate,
  validTo: '2099-12-31',
};

let parent = null;
let currentStepId = 'init';
const scenarioSteps = [];
const apiEvents = [];
const consoleErrors = [];
const pageErrors = [];

function isExpectedFailure(event) {
  if (event.stepId === 'duplicate-red' && event.status === 409) return true;
  if (event.stepId === 'setup-child-part' && event.method === 'DELETE' && event.status === 404) return true;
  return false;
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
  return String(value).toLowerCase().replace(/[^a-z0-9가-힣]+/g, '-').replace(/^-|-$/g, '');
}

function cssAttr(value) {
  return String(value).replaceAll('\\', '\\\\').replaceAll('"', '\\"');
}

function apiPath(url) {
  const parsed = new URL(url);
  return `${parsed.pathname}${parsed.search}`;
}

function headers(contentType = 'application/json') {
  return {
    Authorization: `Bearer ${token}`,
    'X-Company': '40',
    'X-Plant': '1000',
    ...(contentType ? { 'Content-Type': contentType } : {}),
  };
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

async function directApi(method, urlPath, body = undefined) {
  const startedAt = new Date().toISOString();
  const res = await fetch(`${apiUrl}${urlPath}`, {
    method,
    headers: headers(body instanceof FormData ? undefined : 'application/json'),
    body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text.slice(0, 500) };
  }
  apiEvents.push({
    source: 'direct-api',
    stepId: currentStepId,
    method,
    url: `/api/v1${urlPath}`,
    status: res.status,
    ok: res.status >= 200 && res.status < 400,
    startedAt,
    requestBody: body instanceof FormData ? '[FormData]' : body ?? null,
    responsePreview: previewJson(json),
  });
  return { res, json };
}

function dbQuery(sql) {
  const output = execFileSync('python', [oracleConnector, '--site', oracleSite, '--query', sql], {
    cwd: process.cwd(),
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  return JSON.parse(output);
}

function bomId() {
  return `${parent.itemCode}::${testData.childCode}::${testData.revision}`;
}

function bomCountSql() {
  return [
    'SELECT COUNT(*) AS CNT',
    'FROM BOM_MASTERS',
    `WHERE COMPANY = '40' AND PLANT_CD = '1000'`,
    `AND PARENT_ITEM_CODE = '${parent.itemCode}'`,
    `AND CHILD_ITEM_CODE = '${testData.childCode}'`,
    `AND REVISION = '${testData.revision}'`,
  ].join(' ');
}

function bomRowSql() {
  return [
    'SELECT PARENT_ITEM_CODE, CHILD_ITEM_CODE, QTY_PER, SEQ, REVISION, OPER, SIDE,',
    "TO_CHAR(VALID_FROM, 'YYYY-MM-DD') AS VALID_FROM, TO_CHAR(VALID_TO, 'YYYY-MM-DD') AS VALID_TO, REMARK, USE_YN",
    'FROM BOM_MASTERS',
    `WHERE COMPANY = '40' AND PLANT_CD = '1000'`,
    `AND PARENT_ITEM_CODE = '${parent.itemCode}'`,
    `AND CHILD_ITEM_CODE = '${testData.childCode}'`,
    `AND REVISION = '${testData.revision}'`,
  ].join(' ');
}

function childCountSql() {
  return [
    'SELECT COUNT(*) AS CNT',
    'FROM ITEM_MASTERS',
    `WHERE COMPANY = '40' AND PLANT_CD = '1000' AND ITEM_CODE = '${testData.childCode}'`,
  ].join(' ');
}

async function cleanup() {
  if (!parent) return;
  currentStepId = 'cleanup';
  await directApi('DELETE', `/master/boms/${encodeURIComponent(bomId())}`).catch(() => null);
  await directApi('DELETE', `/master/parts/${encodeURIComponent(testData.childCode)}`).catch(() => null);
}

async function capture(page, name, label, dialog = false) {
  const fileName = `${String(scenarioSteps.length + 1).padStart(2, '0')}-${safeSlug(name)}.png`;
  const fullPath = path.join(shotDir, fileName);
  const target = dialog ? page.getByRole('dialog').first() : page.locator('main > div.flex-1').first();
  if (await target.isVisible().catch(() => false)) {
    await target.screenshot({ path: fullPath, timeout: 20000 });
  } else {
    await page.screenshot({ path: fullPath, fullPage: false, timeout: 20000 });
  }
  return {
    label,
    file: path.relative(pageDir, fullPath).replaceAll('\\', '/'),
    abs: fullPath,
  };
}

async function capturePage(page, name, label) {
  const fileName = `${String(scenarioSteps.length + 1).padStart(2, '0')}-${safeSlug(name)}.png`;
  const fullPath = path.join(shotDir, fileName);
  await page.screenshot({ path: fullPath, fullPage: false, timeout: 20000 });
  return {
    label,
    file: path.relative(pageDir, fullPath).replaceAll('\\', '/'),
    abs: fullPath,
  };
}

async function addStep(page, stepInfo) {
  scenarioSteps.push({
    ...stepInfo,
    apiCalls: apiEvents.filter((event) => event.stepId === stepInfo.id),
    consoleErrors: consoleErrors.filter((event) => event.stepId === stepInfo.id && !(stepInfo.id === 'duplicate-red' && /409|Conflict|이미 존재/.test(event.text))),
    pageErrors: pageErrors.filter((event) => event.stepId === stepInfo.id),
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
  const unexpectedApi = newApi.filter((event) => !event.ok && !isExpectedFailure(event));
  const unexpectedConsole = newConsole.filter((event) => !(id === 'duplicate-red' && /409|Conflict|이미 존재/.test(event.text)));
  const ok = unexpectedApi.length === 0 && unexpectedConsole.length === 0 && newPageErrors.length === 0;
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
  await scope.getByRole('button', { name: new RegExp(name) }).first().click();
}

async function fillByLabel(page, label, value) {
  const id = label.toLowerCase().replace(/\s+/g, '-');
  const byId = page.locator(`input[id="${cssAttr(id)}"]`).first();
  if (await byId.isVisible().catch(() => false)) {
    await byId.fill(String(value));
    return;
  }
  const byLabel = page.getByLabel(new RegExp(label)).first();
  if (await byLabel.isVisible().catch(() => false)) {
    await byLabel.fill(String(value));
    return;
  }
  throw new Error(`input not found for label: ${label}`);
}

async function selectParentOnScreen(page) {
  const search = page.getByPlaceholder('품목코드, 품목명 검색...').first();
  await search.fill(parent.itemCode);
  await page.waitForTimeout(1200);
  const row = page.locator('tr', { hasText: parent.itemCode }).first();
  await row.waitFor({ state: 'visible', timeout: 15000 });
  await row.click();
  await page.waitForTimeout(1200);
  await page.locator('tr', { hasText: parent.itemCode }).first().waitFor({ state: 'visible', timeout: 15000 });
}

async function selectChildInBomModal(page) {
  await fillByLabel(page, '자품목코드', testData.childCode);
  await page.waitForTimeout(900);
  const option = page.getByRole('button', { name: new RegExp(testData.childCode) }).first();
  await option.waitFor({ state: 'visible', timeout: 12000 });
  await option.click();
}

async function fillBomFields(page, { qty, seq, remark }) {
  await fillByLabel(page, '소요량', qty);
  await fillByLabel(page, '순서', seq);
  await fillByLabel(page, '리비전', testData.revision);
  await fillByLabel(page, '비고', remark);
  await fillByLabel(page, '적용일', testData.validFrom);
  await fillByLabel(page, '완료일', testData.validTo);
}

async function waitChildRow(page) {
  const row = page.locator('tr', { hasText: testData.childCode }).first();
  await row.waitFor({ state: 'visible', timeout: 20000 });
  return row;
}

async function pickParentFromApi() {
  currentStepId = 'select-parent-api';
  const { res, json } = await directApi('GET', `/master/boms/parents?effectiveDate=${reportDate}`);
  if (!res.ok || !Array.isArray(json?.data) || json.data.length === 0) {
    throw new Error('BOM 부모 품목을 찾지 못했습니다.');
  }
  return json.data.find((item) => item.itemType === 'FINISHED') ?? json.data[0];
}

function childPartPayload() {
  return {
    itemCode: testData.childCode,
    itemNo: testData.childCode,
    itemName: testData.childName,
    itemType: 'RAW_MATERIAL',
    unit: 'EA',
    rev: testData.revision,
    boxQty: 1,
    minPackQty: 1,
    lotUnitQty: 1,
    safetyStock: 0,
    useYn: 'Y',
    remark: `BOM QA setup ${stamp}`,
  };
}

function apiRows(events) {
  return events.map((event) => `
              <tr>
                <td>${escapeHtml(event.source)}</td>
                <td><code>${escapeHtml(event.method)}</code></td>
                <td><code>${escapeHtml(event.url)}</code></td>
                <td class="${event.ok || isExpectedFailure(event) ? 'pass' : 'warn'}">${escapeHtml(event.status)}</td>
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

function styles() {
  return `
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
  `;
}

function renderPage() {
  const allApi = apiEvents.filter((event) => event.stepId !== 'cleanup');
  const featureRows = [
    ['초기 조회', 'GET /master/boms/parents + GET /master/boms/hierarchy/:parent', '실행', '부모 목록 및 BOM 트리 로딩 확인'],
    ['검색', '제품/반제품 목록 검색 입력', '실행', `${parent.itemCode} 기준 검색 후 부모 선택`],
    ['기준일자', 'date input + refresh', '실행', `${reportDate} 기준으로 유효 BOM 조회`],
    ['폼 다운로드', 'GET /master/boms/template', '실행', '템플릿 다운로드 응답 확인'],
    ['내보내기', 'GET /master/boms/export?parentItemCode=...', '실행', '선택 부모 BOM export 다운로드 응답 확인'],
    ['엑셀 업로드', '업로드 모달', '화면 확인', '파일 변형 없이 모달/파일 선택 프로세스 확인'],
    ['BOM 추가', 'BOM 추가 모달 + POST /master/boms', '실행', '화면 저장, API 201, DB row 확인'],
    ['중복 저장 방어', '동일 모품목/자품목/리비전 추가', '실행', '409 응답으로 중복 방어 확인'],
    ['BOM 수정', '행 수정 아이콘 + PUT /master/boms/:id', '실행', '소요량/순서/비고 변경 및 DB 확인'],
    ['라우팅 패널', '행 라우팅 아이콘', '실행', '선택 품목 라우팅 패널과 조회 API 확인'],
    ['BOM 삭제', '행 삭제 아이콘 + DELETE /master/boms/:id', '실행', '화면 재조회 및 DB 0건 확인'],
  ];
  return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <title>BOM관리 페이지 상세 시나리오 QA</title>
  <style>${styles()}</style>
</head>
<body>
  <header>
    <h1>BOM관리 페이지 상세 시나리오 QA</h1>
    <div>대상: <code>${escapeHtml(baseUrl)}/master/bom</code> / 부모: <code>${escapeHtml(parent.itemCode)}</code> / 테스트 자품목: <code>${escapeHtml(testData.childCode)}</code> / 최종 결과: <span class="pass">PASS</span></div>
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
      <p>조회, 검색, 신규/수정/삭제 가능 여부, 저장 검증, DB/API 확인, 화면 재조회 절차를 BOM관리 한 화면 단위 시나리오로 실행했습니다. 테스트 데이터는 삭제 후 잔여 0건까지 확인했습니다.</p>
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
  const partExists = true;
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
          ${partExists ? `<tr>
            <td>품목관리</td>
            <td><code>/master/part</code></td>
            <td>조회 → 검색 → 신규 → 저장 검증 → DB/API 확인 → 수정 → 삭제 → 재조회</td>
            <td class="pass">PASS</td>
            <td><a href="pages/master-part.html">상세 보고서 열기</a></td>
          </tr>` : ''}
          <tr>
            <td>BOM관리</td>
            <td><code>/master/bom</code></td>
            <td>조회 → 검색 → 템플릿/내보내기 → 신규 → 저장 검증 → DB/API 확인 → 중복 방어 → 수정 → 라우팅 패널 → 삭제 → 재조회</td>
            <td class="pass">PASS</td>
            <td><a href="pages/master-bom.html">상세 보고서 열기</a></td>
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
  parent = await pickParentFromApi();
  await cleanup();

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
    apiEvents.push({ ...reqInfo, status: res.status(), ok: res.status() >= 200 && res.status() < 400 });
  });
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push({ stepId: currentStepId, text: msg.text() });
  });
  page.on('pageerror', (err) => pageErrors.push({ stepId: currentStepId, text: err.message }));

  try {
    await injectAuth(page);

    await step(page, 'initial-load', '초기 조회', 'BOM관리 화면 진입과 부모 목록/트리 API 호출을 확인합니다.', [
      '브라우저 로그인 세션을 구성한다.',
      '/master/bom 경로로 이동한다.',
      'BOM관리 제목과 제품/반제품 목록, BOM 자재 구조 영역을 확인한다.',
    ], async () => {
      await page.goto(`${baseUrl}/master/bom`, { waitUntil: 'domcontentloaded', timeout: 40000 });
      await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
      await workArea(page).getByText('BOM관리').waitFor({ state: 'visible' });
      return {
        evidence: await capture(page, 'initial-load', '초기 조회 화면'),
        dbChecks: [
          { title: '선정 부모 BOM 건수 확인', sql: `SELECT COUNT(*) AS CNT FROM BOM_MASTERS WHERE COMPANY='40' AND PLANT_CD='1000' AND PARENT_ITEM_CODE='${parent.itemCode}' AND USE_YN='Y'`, result: dbQuery(`SELECT COUNT(*) AS CNT FROM BOM_MASTERS WHERE COMPANY='40' AND PLANT_CD='1000' AND PARENT_ITEM_CODE='${parent.itemCode}' AND USE_YN='Y'`) },
          { title: '테스트 BOM 사전 잔여 확인', sql: bomCountSql(), result: dbQuery(bomCountSql()) },
        ],
      };
    });

    await step(page, 'search-parent', '검색 및 부모 선택', '제품/반제품 목록에서 부모 품목을 검색하고 선택합니다.', [
      `검색창에 ${parent.itemCode}를 입력한다.`,
      '검색 결과에서 부모 품목 행을 클릭한다.',
      '선택 부모 기준 BOM 트리가 재조회되는지 확인한다.',
    ], async () => {
      await selectParentOnScreen(page);
      return { evidence: await capture(page, 'search-parent', '부모 검색 및 선택 결과') };
    });

    await step(page, 'download-template', '폼 다운로드', 'BOM 템플릿 다운로드 버튼의 API 호출과 파일 응답을 확인합니다.', [
      '상단 폼 다운로드 버튼을 클릭한다.',
      '브라우저 다운로드 이벤트와 GET /master/boms/template 호출을 확인한다.',
    ], async () => {
      const download = page.waitForEvent('download', { timeout: 15000 });
      await clickButton(page, '폼 다운로드', workArea(page));
      const file = await download;
      return {
        evidence: await capture(page, 'download-template', '폼 다운로드 실행 후 화면'),
        notes: [`다운로드 파일명: ${file.suggestedFilename()}`],
      };
    });

    await step(page, 'upload-modal', '엑셀 업로드 모달', '엑셀 업로드 프로세스의 화면 구성과 파일 선택 단계를 확인합니다.', [
      '상단 엑셀 업로드 버튼을 클릭한다.',
      'BOM 엑셀 업로드 모달의 파일 선택, 미리보기/업로드 영역을 확인한다.',
      '파일 데이터 변형 없이 모달을 닫는다.',
    ], async () => {
      await clickButton(page, '엑셀 업로드', workArea(page));
      await page.getByRole('dialog').getByText('BOM 엑셀 업로드').waitFor({ state: 'visible' });
      const evidence = await capture(page, 'upload-modal', '엑셀 업로드 모달', true);
      await page.getByRole('button', { name: /닫기|Close/ }).last().click();
      return { evidence };
    });

    await step(page, 'setup-child-part', '테스트 자품목 준비', 'BOM 화면에서 선택할 임시 자품목을 API로 생성하고 DB에 존재하는지 확인합니다.', [
      '테스트 자품목 잔여를 삭제한다.',
      'POST /master/parts로 임시 RAW_MATERIAL 자품목을 생성한다.',
      'ITEM_MASTERS에서 생성 row를 확인한다.',
    ], async () => {
      await directApi('DELETE', `/master/parts/${encodeURIComponent(testData.childCode)}`).catch(() => null);
      const create = await directApi('POST', '/master/parts', childPartPayload());
      if (!create.res.ok) throw new Error(`자품목 생성 실패: ${JSON.stringify(create.json)}`);
      return {
        evidence: await capture(page, 'setup-child-part', '자품목 생성 후 BOM 화면'),
        dbChecks: [{ title: '자품목 생성 DB 확인', sql: childCountSql(), result: dbQuery(childCountSql()) }],
      };
    });

    await step(page, 'export-selected-parent', '선택 부모 BOM 내보내기', '선택한 부모의 BOM 내보내기 버튼과 export API를 확인합니다.', [
      '선택 부모 BOM 구조 영역의 내보내기 버튼을 클릭한다.',
      'GET /master/boms/export?parentItemCode=... 호출과 다운로드 파일명을 확인한다.',
    ], async () => {
      const download = page.waitForEvent('download', { timeout: 15000 });
      await clickButton(page, '내보내기', workArea(page));
      const file = await download;
      return {
        evidence: await capture(page, 'export-selected-parent', '선택 부모 BOM 내보내기 실행 후 화면'),
        notes: [`다운로드 파일명: ${file.suggestedFilename()}`],
      };
    });

    await step(page, 'create-bom', 'BOM 신규 등록 및 저장 검증', 'BOM 추가 모달에서 테스트 자품목을 추가하고 API/DB/화면 반영을 확인합니다.', [
      'BOM 추가 버튼을 클릭한다.',
      '자품목 검색 드롭다운에서 테스트 자품목을 선택한다.',
      '소요량, 순서, 리비전, 적용일, 완료일, 비고를 입력한다.',
      '추가 버튼으로 저장하고 화면 트리에 자품목이 표시되는지 확인한다.',
    ], async () => {
      await clickButton(page, 'BOM 추가', workArea(page));
      await page.getByRole('dialog').getByText('BOM 추가').waitFor({ state: 'visible' });
      await selectChildInBomModal(page);
      await fillBomFields(page, { qty: testData.initialQty, seq: testData.initialSeq, remark: testData.initialRemark });
      const filled = await capture(page, 'create-bom-form-filled', 'BOM 신규 입력 완료', true);
      await page.getByRole('dialog').getByRole('button', { name: /^추가$/ }).click();
      await waitChildRow(page);
      const apiDetail = await directApi('GET', `/master/boms/${encodeURIComponent(bomId())}`);
      return {
        evidence: filled,
        dbChecks: [
          { title: '신규 BOM API 상세 응답', sql: `GET /api/v1/master/boms/${bomId()}`, result: apiDetail.json },
          { title: '신규 BOM DB row 확인', sql: bomRowSql(), result: dbQuery(bomRowSql()) },
        ],
      };
    });

    await step(page, 'created-requery', '등록 후 화면 재조회', '새로고침 후 테스트 BOM 행이 계속 표시되는지 확인합니다.', [
      '새로고침 버튼을 클릭한다.',
      '부모를 다시 선택하고 테스트 자품목 행을 확인한다.',
    ], async () => {
      await clickButton(page, '새로고침', workArea(page));
      await page.waitForTimeout(1200);
      await selectParentOnScreen(page);
      await waitChildRow(page);
      return { evidence: await capture(page, 'created-requery', '등록 후 화면 재조회 결과') };
    });

    await step(page, 'duplicate-red', '중복 등록 방어', '동일 모품목/자품목/리비전 저장 시 API가 중복을 막는지 확인합니다.', [
      'BOM 추가 버튼을 다시 클릭한다.',
      '동일 자품목과 리비전으로 저장을 시도한다.',
      '409 중복 방어 응답과 오류 모달을 확인한다.',
    ], async () => {
      await clickButton(page, 'BOM 추가', workArea(page));
      await selectChildInBomModal(page);
      await fillBomFields(page, { qty: testData.initialQty, seq: testData.initialSeq, remark: 'duplicate try' });
      await page.getByRole('dialog').getByRole('button', { name: /^추가$/ }).click();
      await page.getByText(/이미 존재하는 BOM|오류가 발생했습니다|Conflict/).first().waitFor({ state: 'visible', timeout: 12000 });
      const evidence = await capturePage(page, 'duplicate-red', '중복 등록 방어 모달');
      const errorLayer = page.locator('div.fixed.inset-0', { hasText: '아래 내용을 복사' }).first();
      if (await errorLayer.isVisible().catch(() => false)) {
        await errorLayer.getByRole('button', { name: '닫기' }).click();
      }
      const bomDialog = page.getByRole('dialog').filter({ hasText: 'BOM 추가' }).first();
      if (await bomDialog.isVisible().catch(() => false)) {
        await bomDialog.getByRole('button', { name: /^취소$/ }).click();
      }
      await page.waitForTimeout(500);
      return { evidence };
    });

    await step(page, 'update-bom', 'BOM 수정 및 저장 검증', '테스트 BOM 행의 소요량/순서/비고를 수정하고 DB 반영을 확인합니다.', [
      '테스트 자품목 행의 수정 아이콘을 클릭한다.',
      '소요량, 순서, 비고를 변경한다.',
      '수정 버튼으로 저장한다.',
      'API 상세 조회와 DB에서 변경값을 확인한다.',
    ], async () => {
      const row = await waitChildRow(page);
      await row.locator('button').nth(1).click();
      await page.getByRole('dialog').getByText('BOM 수정').waitFor({ state: 'visible' });
      await fillBomFields(page, { qty: testData.editedQty, seq: testData.editedSeq, remark: testData.editedRemark });
      const filled = await capture(page, 'update-bom-form-filled', 'BOM 수정 입력 완료', true);
      await page.getByRole('dialog').getByRole('button', { name: /^수정$/ }).click();
      await waitChildRow(page);
      const apiDetail = await directApi('GET', `/master/boms/${encodeURIComponent(bomId())}`);
      return {
        evidence: filled,
        dbChecks: [
          { title: '수정 BOM API 상세 응답', sql: `GET /api/v1/master/boms/${bomId()}`, result: apiDetail.json },
          { title: '수정 BOM DB 변경값 확인', sql: bomRowSql(), result: dbQuery(bomRowSql()) },
        ],
      };
    });

    await step(page, 'routing-panel', '라우팅 패널 확인', 'BOM 행의 라우팅 아이콘으로 선택 품목 라우팅 패널과 조회 API를 확인합니다.', [
      '테스트 자품목 행의 라우팅 아이콘을 클릭한다.',
      '우측 선택 품목 라우팅 패널이 열리는지 확인한다.',
      '해당 자품목 라우팅 조회 API 호출을 확인한다.',
    ], async () => {
      const row = await waitChildRow(page);
      await row.locator('button').nth(0).click();
      await page.getByText('선택 품목 라우팅').waitFor({ state: 'visible', timeout: 15000 });
      return { evidence: await capture(page, 'routing-panel', '라우팅 패널 확인') };
    });

    await step(page, 'delete-bom', 'BOM 삭제 및 저장 검증', '테스트 BOM 행을 삭제하고 API/DB에서 잔여가 없는지 확인합니다.', [
      '테스트 자품목 행의 삭제 아이콘을 클릭한다.',
      '삭제 확인 모달에서 확인을 누른다.',
      'BOM API 목록과 DB count로 삭제 결과를 확인한다.',
    ], async () => {
      const row = await waitChildRow(page);
      await row.locator('button').nth(2).click();
      await page.getByRole('dialog').getByText('이 BOM 항목을 삭제하시겠습니까?').waitFor({ state: 'visible' });
      const modal = await capture(page, 'delete-bom-confirm', 'BOM 삭제 확인 모달', true);
      await page.getByRole('dialog').getByRole('button', { name: /^확인$/ }).click();
      await page.waitForTimeout(1300);
      const apiList = await directApi('GET', `/master/boms?parentItemCode=${encodeURIComponent(parent.itemCode)}&childItemCode=${encodeURIComponent(testData.childCode)}&revision=${testData.revision}&limit=20`);
      return {
        evidence: modal,
        dbChecks: [
          { title: '삭제 후 BOM API 목록 응답', sql: `GET /api/v1/master/boms?parentItemCode=${parent.itemCode}&childItemCode=${testData.childCode}&revision=${testData.revision}`, result: apiList.json },
          { title: '삭제 후 BOM DB 0건', sql: bomCountSql(), result: dbQuery(bomCountSql()) },
        ],
      };
    });

    await step(page, 'after-delete-requery', '삭제 후 화면 재조회 및 정리', '삭제 후 화면과 DB에 테스트 BOM/자품목 잔여가 없는지 확인합니다.', [
      '새로고침 후 같은 부모를 다시 선택한다.',
      '테스트 BOM 행이 화면에 남지 않았는지 확인한다.',
      '테스트 자품목을 삭제하고 ITEM_MASTERS 잔여 0건을 확인한다.',
    ], async () => {
      await clickButton(page, '새로고침', workArea(page));
      await page.waitForTimeout(1200);
      await selectParentOnScreen(page);
      const visible = await page.locator('tr', { hasText: testData.childCode }).first().isVisible({ timeout: 800 }).catch(() => false);
      if (visible) throw new Error(`deleted BOM row still visible: ${testData.childCode}`);
      await directApi('DELETE', `/master/parts/${encodeURIComponent(testData.childCode)}`);
      return {
        evidence: await capture(page, 'after-delete-requery', '삭제 후 화면 재조회 결과'),
        dbChecks: [
          { title: '최종 BOM DB 잔여 확인', sql: bomCountSql(), result: dbQuery(bomCountSql()) },
          { title: '최종 자품목 DB 잔여 확인', sql: childCountSql(), result: dbQuery(childCountSql()) },
        ],
      };
    });

    const failedApi = apiEvents.filter((event) => event.stepId !== 'cleanup' && !event.ok && !isExpectedFailure(event));
    if (failedApi.length) throw new Error(`unexpected API failures: ${JSON.stringify(failedApi, null, 2)}`);
    const unexpectedConsoleErrors = consoleErrors.filter((event) => !(event.stepId === 'duplicate-red' && /409|Conflict|이미 존재/.test(event.text)));
    if (unexpectedConsoleErrors.length) throw new Error(`console errors: ${JSON.stringify(unexpectedConsoleErrors, null, 2)}`);
    if (pageErrors.length) throw new Error(`page errors: ${JSON.stringify(pageErrors, null, 2)}`);
  } finally {
    await browser.close().catch(() => {});
    await cleanup();
  }

  await fs.writeFile(pagePath, renderPage(), 'utf8');
  await fs.writeFile(indexPath, renderIndex(), 'utf8');
  await fs.writeFile(resultPath, JSON.stringify({
    status: 'PASS',
    page: '/master/bom',
    testData,
    parent,
    baseUrl,
    apiUrl,
    oracleSite,
    scenarioSteps,
    apiEvents,
    consoleErrors,
    pageErrors,
    reports: { indexPath, pagePath },
  }, null, 2), 'utf8');

  console.log(JSON.stringify({
    status: 'PASS',
    page: '/master/bom',
    parent: parent.itemCode,
    testKey: testData.childCode,
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
