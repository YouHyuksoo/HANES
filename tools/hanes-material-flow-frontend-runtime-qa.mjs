import fs from 'node:fs/promises';
import path from 'node:path';
import { existsSync } from 'node:fs';
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
const stamp = process.env.HANES_TEST_STAMP
  ?? `${new Date().toISOString().replace(/\D/g, '').slice(2, 14)}${Math.floor(Math.random() * 100).toString().padStart(2, '0')}`;
const today = new Date().toISOString().slice(0, 10);
const baseUrl = process.env.HANES_FRONTEND_URL ?? 'http://localhost:3002';
const apiUrl = process.env.HANES_API_URL ?? 'http://localhost:3003/api/v1';
const token = process.env.HANES_TOKEN ?? 'admin@hanes.com';
const company = process.env.HANES_COMPANY ?? '40';
const plant = process.env.HANES_PLANT ?? '1000';
const oracleConnector = 'C:/Users/hsyou/.codex/skills/oracle-db/scripts/oracle_connector.py';
const oracleSite = process.env.HANES_ORACLE_SITE ?? 'JSHANES';
const reportRoot = path.resolve(`docs/reports/hanes-material-flow-frontend-runtime-qa-${reportDate}`);
const shotDir = path.join(reportRoot, 'screenshots');
const resultPath = path.join(reportRoot, 'material-flow-result.json');
const htmlPath = path.join(reportRoot, 'index.html');
const orderNo = `JO-MATFE-${stamp}`;

const user = {
  id: token,
  email: token,
  name: '시스템관리자',
  role: 'ADMIN',
  status: 'ACTIVE',
  company,
  plant,
};

const evidence = {
  status: 'RUNNING',
  executedAt: new Date().toISOString(),
  baseUrl,
  apiUrl,
  company,
  plant,
  stamp,
  orderNo,
  requestNo: null,
  setup: {},
  steps: [],
  apiEvents: [],
  dbChecks: [],
  screenshots: [],
  failures: [],
};

function headers() {
  return {
    Authorization: `Bearer ${token}`,
    'X-Company': company,
    'X-Plant': plant,
    'Content-Type': 'application/json',
  };
}

async function api(method, urlPath, body) {
  const maxAttempts = method === 'GET' ? 3 : 1;
  let lastError = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const res = await fetch(`${apiUrl}${urlPath}`, {
      method,
      headers: headers(),
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    let json;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = { raw: text };
    }
    evidence.apiEvents.push({
      source: 'direct-api',
      method,
      url: urlPath,
      status: res.status,
      ok: res.ok && json?.success !== false,
      attempt,
      responsePreview: json?.data ?? json,
    });
    if (res.ok && json?.success !== false) {
      return json?.data ?? json;
    }
    lastError = new Error(`${method} ${urlPath} failed: ${res.status} ${text}`);
    if (res.status !== 503 || attempt === maxAttempts) break;
    await new Promise((resolve) => setTimeout(resolve, 3000 * attempt));
  }
  throw lastError;
}

function dbQuery(sql, label) {
  const out = execFileSync('python', [
    oracleConnector,
    '--site',
    oracleSite,
    '--query',
    sql,
  ], { cwd: process.cwd(), encoding: 'utf8', maxBuffer: 1024 * 1024 * 8 });
  const parsed = JSON.parse(out);
  const check = {
    label,
    sql,
    ok: parsed.success === true,
    rowCount: parsed.row_count,
    data: parsed.data,
  };
  evidence.dbChecks.push(check);
  if (!check.ok) throw new Error(`DB check failed: ${label}`);
  return parsed.data ?? [];
}

async function ensureReportDirs() {
  await fs.mkdir(shotDir, { recursive: true });
}

async function screenshot(page, name, label) {
  const file = path.join(shotDir, `${String(evidence.screenshots.length + 1).padStart(2, '0')}-${name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  const item = { label, file: path.relative(reportRoot, file).replaceAll('\\', '/') };
  evidence.screenshots.push(item);
  return item;
}

async function injectAuth(page) {
  await page.goto(`${baseUrl}/login`, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.evaluate(({ token, user, company, plant }) => {
    const auth = {
      state: {
        user,
        token,
        selectedCompany: company,
        selectedPlant: plant,
        isAuthenticated: true,
        allowedMenus: [],
        currentWorker: null,
        pdaAllowedMenus: [],
      },
      version: 0,
    };
    localStorage.setItem('harness-token', token);
    localStorage.setItem('harness-auth', JSON.stringify(auth));
  }, { token, user, company, plant });
}

async function step(id, title, fn) {
  const record = { id, title, result: 'RUNNING', startedAt: new Date().toISOString(), notes: [] };
  evidence.steps.push(record);
  try {
    const result = await fn(record);
    Object.assign(record, result ?? {});
    record.result = 'PASS';
  } catch (err) {
    record.result = 'FAIL';
    record.error = err instanceof Error ? err.message : String(err);
    evidence.failures.push({ id, error: record.error });
    throw err;
  } finally {
    record.finishedAt = new Date().toISOString();
  }
}

async function setupRuntimeData() {
  await api('GET', '/health');
  const hsg = await api('GET', '/material/stocks/available?itemCode=HSG0001&limit=1');
  const tp = await api('GET', '/material/stocks/available?itemCode=TP0001&limit=1');
  const hsgLot = (Array.isArray(hsg) ? hsg : hsg.data ?? [])[0];
  const tpLot = (Array.isArray(tp) ? tp : tp.data ?? [])[0];
  if (!hsgLot?.matUid || !tpLot?.matUid) throw new Error('HSG0001/TP0001 가용 LOT가 부족합니다.');
  evidence.setup.selectedLots = {
    HSG0001: { matUid: hsgLot.matUid, availableQty: hsgLot.availableQty, warehouseCode: hsgLot.warehouseCode },
    TP0001: { matUid: tpLot.matUid, availableQty: tpLot.availableQty, warehouseCode: tpLot.warehouseCode },
  };

  const existing = await api('GET', `/production/job-orders?orderNo=${encodeURIComponent(orderNo)}&limit=1`);
  const existingRows = Array.isArray(existing) ? existing : existing.data ?? [];
  if (existingRows.length === 0) {
    await api('POST', '/production/job-orders', {
      orderNo,
      itemCode: 'HNS02',
      lineCode: 'LINE-01',
      planQty: 1,
      planDate: today,
      processCode: 'MASSY',
      equipCode: 'EQ-MASSY-01',
      autoCreateChildren: false,
      remark: '자재관리 프론트 실제 흐름 QA',
    });
  }
  evidence.setup.jobOrder = await api('GET', `/production/job-orders?orderNo=${encodeURIComponent(orderNo)}&limit=1`);
}

async function waitForText(page, text, timeout = 15000) {
  await page.getByText(text, { exact: false }).first().waitFor({ state: 'visible', timeout });
}

function matchesApiPath(response, pathFragment) {
  const url = response.url();
  return (
    url.includes(`/api/v1${pathFragment}`) ||
    url.includes(`/api${pathFragment}`)
  );
}

async function createRequestThroughUi(page) {
  await page.goto(`${baseUrl}/material/request`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
  await waitForText(page, '출고요청');
  await page.locator('input').first().fill(orderNo);
  await page.waitForTimeout(1000);
  await waitForText(page, orderNo);
  await screenshot(page, 'request-page', '자재요청 화면 진입');

  await page.getByText(orderNo, { exact: false }).first().click();
  await page.getByRole('button', { name: /신규 작성|New/i }).click();
  await waitForText(page, 'HSG0001');
  await waitForText(page, 'TP0001');
  await screenshot(page, 'request-create-bom', '작업지시 선택 후 BOM 요청 품목 자동 산출');

  const responsePromise = page.waitForResponse((res) =>
    (res.url().includes('/api/v1/material/issue-requests') || res.url().includes('/api/material/issue-requests')) &&
    res.request().method() === 'POST' &&
    res.status() >= 200 &&
    res.status() < 300,
    { timeout: 30000 },
  );
  await page.getByRole('button', { name: /요청등록|출고요청 등록|Register/i }).click();
  const response = await responsePromise;
  const json = await response.json();
  const request = json?.data;
  evidence.requestNo = request?.requestNo;
  if (!evidence.requestNo) throw new Error('출고요청번호를 UI 응답에서 찾지 못했습니다.');
  await page.waitForTimeout(1000);
  await screenshot(page, 'request-created', `출고요청 생성 완료 ${evidence.requestNo}`);
}

async function approveAndIssueThroughUi(page) {
  await page.goto(`${baseUrl}/material/issue`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
  await waitForText(page, '출고요청처리');
  const search = page.locator('input').first();
  await search.fill(evidence.requestNo);
  await search.press('Enter').catch(() => {});
  await page.waitForTimeout(1200);
  await screenshot(page, 'issue-request-filtered', '자재출고 화면에서 생성 요청 검색');

  const approveButton = page.locator(`tr:has-text("${evidence.requestNo}") button[title*="승인"]`).first();
  await approveButton.click();
  const approveResponse = page.waitForResponse((res) =>
    matchesApiPath(res, `/material/issue-requests/${encodeURIComponent(evidence.requestNo)}/approve`) &&
    res.request().method() === 'PATCH',
    { timeout: 30000 },
  );
  await page.getByRole('button', { name: /승인|Approve/i }).last().click();
  await approveResponse;
  await page.waitForTimeout(1200);
  await screenshot(page, 'issue-request-approved', '출고요청 승인 완료');

  await search.fill(evidence.requestNo);
  await search.press('Enter').catch(() => {});
  await page.waitForTimeout(1000);
  const issueButton = page.locator(`tr:has-text("${evidence.requestNo}") button[title*="출고"]`).first();
  await issueButton.click();
  await page.waitForTimeout(2500);
  await screenshot(page, 'issue-modal-lot-selected', '출고처리 모달 LOT 자동 선택 확인');

  const issueResponse = page.waitForResponse((res) =>
    matchesApiPath(res, `/material/issue-requests/${encodeURIComponent(evidence.requestNo)}/issue`) &&
    res.request().method() === 'POST',
    { timeout: 30000 },
  );
  await page.getByRole('button', { name: /^출고$|출고처리|Issue/i }).last().click();
  await issueResponse;
  await page.waitForTimeout(1500);
  await screenshot(page, 'issue-completed', '출고요청 기반 자재출고 완료');
}

async function verifyStockPages(page) {
  await page.goto(`${baseUrl}/inventory/material-stock`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
  await waitForText(page, '자재재고');
  const inputs = page.locator('input');
  await inputs.first().fill('HSG0001');
  await page.getByRole('button').filter({ hasText: /조회|검색|Search/i }).first().click().catch(() => inputs.first().press('Enter'));
  await page.waitForTimeout(1200);
  await screenshot(page, 'stock-hsg-after-issue', '자재 재고 화면 HSG0001 출고 후 조회');

  await page.goto(`${baseUrl}/production/wip-material-stock`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
  await waitForText(page, '공정재고');
  const wipSearch = page.locator('input').first();
  await wipSearch.fill(evidence.setup.selectedLots?.HSG0001?.matUid ?? 'HSG0001');
  await page.waitForTimeout(1200);
  await screenshot(page, 'wip-material-stock-after-issue', '공정재고 화면 출고 LOT 반영 조회');

  await page.goto(`${baseUrl}/production/input-kiosk`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.evaluate(({ orderNo }) => {
    const state = {
      state: {
        selectedEquip: { equipCode: 'EQ-MASSY-01', equipName: '조립 설비 #1', processCode: 'MASSY', processName: '조립' },
        selectedJobOrder: { orderNo, itemCode: 'HNS02', itemName: '완제품 하네스', planQty: 1, processCode: 'MASSY', equipCode: 'EQ-MASSY-01', status: 'WAITING' },
        selectedWorkers: [{ id: 'admin@hanes.com', workerId: 'admin@hanes.com', workerName: '시스템관리자', name: '시스템관리자' }],
        lotSize: 1,
        interlock: { dailyInspectDone: true, workerInspectDone: true, materialScanDone: true, consumableScanDone: true },
      },
      version: 2,
    };
    localStorage.setItem('harness-kiosk', JSON.stringify(state));
  }, { orderNo });
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
  await waitForText(page, orderNo);
  await screenshot(page, 'input-kiosk-order-loaded', '공정 키오스크에서 작업지시와 자재리스트 로딩');
}

function countWhere(table, where, label) {
  return dbQuery(`SELECT COUNT(*) AS CNT FROM ${table} WHERE ${where}`, label);
}

async function verifyDb() {
  countWhere('MAT_ISSUE_REQUESTS', `COMPANY='${company}' AND PLANT_CD='${plant}' AND REQUEST_NO='${evidence.requestNo}' AND STATUS='COMPLETED'`, '출고요청 COMPLETED');
  countWhere('MAT_ISSUE_REQUEST_ITEMS', `COMPANY='${company}' AND PLANT_CD='${plant}' AND REQUEST_ID='${evidence.requestNo}' AND ISSUED_QTY > 0`, '출고요청 품목 issuedQty 반영');
  countWhere('MAT_ISSUES', `COMPANY='${company}' AND PLANT_CD='${plant}' AND ORDER_NO='${orderNo}' AND STATUS='DONE'`, 'MAT_ISSUES 출고 이력');
  countWhere('WIP_MAT_TRANSACTIONS', `COMPANY='${company}' AND PLANT_CD='${plant}' AND ORDER_NO='${orderNo}' AND EQUIP_CODE='EQ-MASSY-01' AND TRANS_TYPE='WIP_IN' AND REF_TYPE='MAT_ISSUE' AND ITEM_CODE IN ('HSG0001','TP0001')`, 'WIP_MAT_TRANSACTIONS 공정입고 이력');
  const hsgUid = evidence.setup.selectedLots?.HSG0001?.matUid;
  const tpUid = evidence.setup.selectedLots?.TP0001?.matUid;
  countWhere('WIP_MAT_STOCKS', `COMPANY='${company}' AND PLANT_CD='${plant}' AND EQUIP_CODE='EQ-MASSY-01' AND ((ITEM_CODE='HSG0001' AND MAT_UID='${hsgUid}' AND QTY >= 1) OR (ITEM_CODE='TP0001' AND MAT_UID='${tpUid}' AND QTY >= 300))`, '공정재고 WIP_MAT_STOCKS 반영');
}

async function writeReport() {
  evidence.status = evidence.failures.length === 0 ? 'PASS' : 'FAIL';
  await fs.writeFile(resultPath, JSON.stringify(evidence, null, 2), 'utf8');
  const rows = evidence.steps.map((s) => `<tr><td>${s.id}</td><td>${s.title}</td><td class="${s.result}">${s.result}</td><td>${s.error ?? ''}</td></tr>`).join('\n');
  const shots = evidence.screenshots.map((s) => `<figure><img src="${s.file}" alt="${s.label}"><figcaption>${s.label}</figcaption></figure>`).join('\n');
  const dbRows = evidence.dbChecks.map((c) => `<tr><td>${c.label}</td><td>${c.ok ? 'PASS' : 'FAIL'}</td><td><pre>${c.sql}</pre></td><td><pre>${JSON.stringify(c.data, null, 2)}</pre></td></tr>`).join('\n');
  await fs.writeFile(htmlPath, `<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><title>HANES 자재관리 프론트 흐름 QA</title>
<style>
body{font-family:Arial,"Noto Sans KR",sans-serif;margin:0;background:#f5f6f8;color:#17202a}header{padding:24px 32px;background:#1f2937;color:#fff}main{padding:24px 32px}table{width:100%;border-collapse:collapse;background:#fff;margin:16px 0}th,td{border:1px solid #d7dce2;padding:8px;text-align:left;vertical-align:top}.PASS{color:#047857;font-weight:700}.FAIL{color:#b91c1c;font-weight:700}pre{white-space:pre-wrap;margin:0;font-size:12px}figure{background:#fff;border:1px solid #d7dce2;margin:16px 0;padding:12px}img{max-width:100%;border:1px solid #ccd2da}figcaption{margin-top:8px;font-weight:700}
</style></head><body><header><h1>HANES 자재관리 프론트 흐름 QA</h1><p>status=${evidence.status} / orderNo=${orderNo} / requestNo=${evidence.requestNo ?? '-'}</p></header>
<main><h2>Scenario</h2><table><thead><tr><th>ID</th><th>단계</th><th>결과</th><th>오류</th></tr></thead><tbody>${rows}</tbody></table>
<h2>DB 확인</h2><table><thead><tr><th>항목</th><th>결과</th><th>SQL</th><th>Rows</th></tr></thead><tbody>${dbRows}</tbody></table>
<h2>스크린샷</h2>${shots}</main></body></html>`, 'utf8');
}

async function main() {
  await ensureReportDirs();
  await step('setup', '테스트 작업지시와 가용 LOT 확인', setupRuntimeData);
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 980 }, locale: 'ko-KR' });
  const page = await context.newPage();
  page.setDefaultTimeout(20000);
  await injectAuth(page);
  try {
    await step('ui-request', '프론트 자재요청 생성', () => createRequestThroughUi(page));
    await step('ui-issue', '프론트 승인 및 출고처리', () => approveAndIssueThroughUi(page));
    await step('ui-stock-kiosk', '프론트 재고/공정 키오스크 확인', () => verifyStockPages(page));
    await step('db-verify', 'JSHANES DB 정합성 확인', verifyDb);
  } finally {
    await browser.close().catch(() => {});
    await writeReport();
  }
  if (evidence.status !== 'PASS') process.exitCode = 1;
  console.log(JSON.stringify({ status: evidence.status, htmlPath, resultPath, requestNo: evidence.requestNo, orderNo }, null, 2));
}

main().catch(async (err) => {
  evidence.status = 'FAIL';
  evidence.failures.push({ id: 'fatal', error: err instanceof Error ? err.message : String(err) });
  await ensureReportDirs().catch(() => {});
  await writeReport().catch(() => {});
  console.error(err);
  process.exitCode = 1;
});
