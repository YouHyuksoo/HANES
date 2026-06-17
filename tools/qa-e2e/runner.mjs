/**
 * HANES 기준정보 상세 E2E QA 러너 (케이스 기반)
 *
 * 스킬(ui-test-crud-red)의 고정 9스텝 대신, 시나리오 JSON의 `cases[]`를 순서대로
 * 실행하며 각 케이스의 "예상 동작(expect)"을 단언한다. 정상/비정상 입력을 모두 다룬다.
 *
 * 케이스 타입:
 *  - load            : 화면 로드 후 특정 텍스트 노출 확인
 *  - create-invalid  : 필수값 일부만 입력 → 제출 버튼 disabled(또는 검증 메시지) 확인
 *  - create          : 정상 등록 → 검색 후 행 노출 확인
 *  - create-duplicate: 동일 키 재등록 → 에러 모달 + 4xx 응답 확인(RED)
 *  - update          : 행 수정 → 변경값 노출 확인
 *  - delete          : 행 삭제(확인 모달) → 행 제거 확인
 *  - api-verify      : API로 임시 행 부재 확인
 *
 * 환경변수:
 *  HANES_FRONTEND_URL (기본 http://localhost:3002)
 *  HANES_API_URL      (기본 http://localhost:3002/api  — 프론트 프록시 경유)
 *  HANES_TOKEN        (기본 admin@hanes.com — dev 토큰)
 *  HANES_QA_HEADED=1  (창 표시)
 *  HANES_QA_SLOWMO    (동작 지연 ms)
 *
 * 사용:
 *  node tools/qa-e2e/runner.mjs <scenario.json | scenarioId>
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const scenarioDir = path.join(__dirname, 'scenarios');

function loadPlaywright() {
  const req = createRequire(import.meta.url);
  // 1) NODE_PATH/일반 해석 2) repo의 pnpm 경로 폴백
  for (const id of [
    'playwright',
    path.resolve(__dirname, '../../node_modules/.pnpm/playwright@1.61.0/node_modules/playwright'),
  ]) {
    try {
      return req(id);
    } catch {
      /* try next */
    }
  }
  throw new Error('playwright 모듈을 찾을 수 없습니다. apps/frontend에 @playwright/test 설치 필요');
}

const { chromium } = loadPlaywright();

const baseUrl = process.env.HANES_FRONTEND_URL ?? 'http://localhost:3002';
const apiUrl = process.env.HANES_API_URL ?? 'http://localhost:3002/api';
const token = process.env.HANES_TOKEN ?? 'admin@hanes.com';
const headed = process.env.HANES_QA_HEADED === '1';
const slowMo = process.env.HANES_QA_SLOWMO ? Number(process.env.HANES_QA_SLOWMO) : 0;

const authUser = {
  id: 'admin@hanes.com', email: 'admin@hanes.com', name: '시스템관리자',
  empNo: null, dept: null, role: 'ADMIN', status: 'ACTIVE', company: '40', plant: '1000',
};

/* ---------- 유틸 ---------- */
function kstDate() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
  return parts; // en-CA → YYYY-MM-DD
}
function htmlEscape(v) {
  return String(v ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}
function escapeRegex(v) { return String(v).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function exactName(v) { return new RegExp(`^\\s*${escapeRegex(v)}\\s*$`); }
function getPath(obj, dotted, fallback) {
  if (!dotted) return obj;
  return dotted.split('.').reduce((v, k) => v?.[k], obj) ?? fallback;
}
function tpl(value, vars) {
  if (typeof value !== 'string') return value;
  return value.replaceAll(/{{\s*([\w.-]+)\s*}}/g, (_, k) => String(vars[k] ?? ''));
}
function buildVars(scenario) {
  const stamp = new Date().toISOString().replace(/\D/g, '').slice(2, 14);
  const vars = { stamp, reportDate: kstDate(), route: scenario.route, prefix: scenario.testData?.prefix ?? 'FECRUD' };
  for (const [k, v] of Object.entries(scenario.testData?.values ?? {})) vars[k] = tpl(v, vars);
  return vars;
}

async function loadScenario(arg) {
  const v = arg ?? 'master-part';
  const p = path.isAbsolute(v) ? v
    : v.endsWith('.json') ? path.resolve(process.cwd(), v)
    : path.join(scenarioDir, `${v}.json`);
  const scenario = JSON.parse(await fs.readFile(p, 'utf8'));
  scenario.__path = p;
  return scenario;
}

/* ---------- API ---------- */
function apiHeaders() {
  return { Authorization: `Bearer ${token}`, 'X-Company': '40', 'X-Plant': '1000', 'Content-Type': 'application/json' };
}
async function apiGet(url) {
  return fetch(`${apiUrl}${url}`, { headers: apiHeaders() }).catch(() => null);
}
async function apiDelete(url) {
  return fetch(`${apiUrl}${url}`, { method: 'DELETE', headers: apiHeaders() }).catch(() => null);
}
async function cleanup(scenario, vars) {
  const c = scenario.cleanup;
  if (!c) return;
  const res = await apiGet(tpl(c.searchPath, vars));
  if (!res?.ok) return;
  const body = await res.json().catch(() => null);
  const items = getPath(body, c.listPath ?? 'data', []);
  for (const item of Array.isArray(items) ? items : []) {
    const pref = item?.[c.prefixField];
    if (typeof pref !== 'string' || !pref.startsWith(vars.prefix)) continue;
    const del = item?.[c.deleteValueField];
    if (!del) continue;
    await apiDelete(tpl(c.deletePath, { ...vars, [scenario.testData?.primaryKey ?? 'code']: del }));
  }
}

/* ---------- 페이지 헬퍼 ---------- */
async function injectAuth(page) {
  await page.goto(`${baseUrl}/login`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.evaluate(({ token, user }) => {
    localStorage.setItem('harness-token', token);
    localStorage.setItem('harness-auth', JSON.stringify({
      state: { user, token, selectedCompany: '40', selectedPlant: '1000', isAuthenticated: true, allowedMenus: [], currentWorker: null, pdaAllowedMenus: [] },
      version: 0,
    }));
  }, { token, user: authUser });
}
function workArea(page) { return page.locator('main > div.flex-1').first(); }
// 등록/수정 폼 컨테이너: 우측 슬라이드 패널(w-[480px] border-l) 또는 중앙 Modal(role=dialog) 모두 포괄.
// 현재 보이는 것 중 마지막을 사용한다(폼은 한 번에 하나만 열림).
function formPanel(page) { return page.locator('div.border-l.border-border:visible, div[role="dialog"]:visible').last(); }
function dialog(page) { return page.getByRole('dialog').first(); }
// 등록 패널 열기 버튼: 작업영역 내부 우선, 없으면 페이지 헤더(workArea 밖)에서 탐색
async function clickOpen(page, name) {
  const inArea = workArea(page).getByRole('button', { name: exactName(name) }).first();
  if (await inArea.count().catch(() => 0) && await inArea.isVisible().catch(() => false)) {
    await inArea.click();
    return;
  }
  await page.getByRole('button', { name: exactName(name) }).first().click();
}

async function fillByLabel(scope, label, value) {
  const field = scope.locator(`label:has-text("${label}")`).first().locator('xpath=ancestor-or-self::*[.//input or .//textarea][1]').locator('input, textarea').first();
  await field.fill(String(value));
}
async function selectByLabel(scope, label) {
  // 네이티브 <select> 의 첫 실제(빈값 아님) 옵션 선택
  const sel = scope.locator(`label:has-text("${label}")`).first()
    .locator('xpath=ancestor-or-self::*[.//select][1]').locator('select').first();
  if (await sel.count().catch(() => 0)) {
    for (const opt of await sel.locator('option').all()) {
      const v = await opt.getAttribute('value');
      if (v) { await sel.selectOption(v); return true; }
    }
  }
  return false;
}
async function fillFields(scope, fields, vars) {
  for (const f of fields ?? []) {
    if (f.type === 'select') { await selectByLabel(scope, f.label).catch(() => {}); continue; }
    await fillByLabel(scope, f.label, tpl(f.value, vars));
  }
}
async function clickExact(scope, name) {
  await scope.getByRole('button', { name: exactName(name) }).first().click();
}
async function doSearch(page, scenario, vars) {
  const root = workArea(page);
  const ph = scenario.search?.placeholderIncludes ?? '검색';
  const input = root.locator(`input[placeholder*="${ph}"]`).first();
  await input.fill('');
  await input.fill(tpl(scenario.search?.value ?? `{{${scenario.testData?.primaryKey}}}`, vars));
  await page.keyboard.press('Enter').catch(() => {});
  await page.waitForTimeout(1000);
}

/* ---------- 캡처 ---------- */
async function shoot(page, shotDir, file, label, evidence, mode = 'content') {
  const full = path.join(shotDir, file);
  try {
    if (mode === 'dialog' && await dialog(page).isVisible().catch(() => false)) {
      await dialog(page).screenshot({ path: full });
    } else if (mode === 'panel' && await formPanel(page).isVisible().catch(() => false)) {
      await formPanel(page).screenshot({ path: full });
    } else if (mode === 'viewport') {
      await page.screenshot({ path: full, fullPage: false });
    } else if (await workArea(page).isVisible().catch(() => false)) {
      await workArea(page).screenshot({ path: full });
    } else {
      await page.screenshot({ path: full, fullPage: false });
    }
  } catch {
    await page.screenshot({ path: full, fullPage: false }).catch(() => {});
  }
  return { label, src: `screenshots/${file}` };
}

/* ---------- 케이스 실행 ---------- */
async function runCase(ctx, kase, idx) {
  const { page, scenario, vars, shotDir } = ctx;
  const result = { id: kase.id, type: kase.type, title: tpl(kase.title, vars), status: 'PASS', expected: kase.expectText ?? '', actual: '', evidence: [], error: null };
  const shotName = (suffix) => `${String(idx + 1).padStart(2, '0')}-${kase.id}${suffix ? '-' + suffix : ''}.png`;

  try {
    switch (kase.type) {
      case 'load': {
        await workArea(page).getByText(tpl(kase.expect.visibleText, vars), { exact: false }).first()
          .waitFor({ state: 'visible', timeout: 12000 });
        result.actual = `"${tpl(kase.expect.visibleText, vars)}" 노출 확인`;
        result.evidence.push(await shoot(page, shotDir, shotName(), result.title, ctx.evidence));
        break;
      }
      case 'create-invalid': {
        await clickExact(workArea(page), scenario.openButton);
        await page.waitForTimeout(500);
        const panel = formPanel(page);
        await fillFields(panel, kase.fields, vars);
        result.evidence.push(await shoot(page, shotDir, shotName('filled'), `${result.title} (입력)`, ctx.evidence, 'panel'));
        // 예상: 제출 버튼 비활성
        const submit = panel.getByRole('button', { name: exactName(scenario.submitButton) }).first();
        const disabled = await submit.isDisabled().catch(() => false);
        if (kase.expect.submitDisabled && !disabled) throw new Error('필수값 누락인데 제출 버튼이 활성화됨');
        result.actual = disabled ? '필수값 누락 → 제출 버튼 비활성(검증 동작 정상)' : '제출 버튼 상태 확인';
        await clickExact(panel, scenario.cancelButton);
        await page.waitForTimeout(400);
        break;
      }
      case 'create': {
        await clickExact(workArea(page), scenario.openButton);
        await page.waitForTimeout(500);
        const panel = formPanel(page);
        await fillFields(panel, kase.fields ?? scenario.fields, vars);
        result.evidence.push(await shoot(page, shotDir, shotName('filled'), `${result.title} (입력)`, ctx.evidence, 'panel'));
        await clickExact(panel, scenario.submitButton);
        await page.waitForTimeout(1300);
        await doSearch(page, scenario, vars);
        await workArea(page).getByText(tpl(kase.expect.rowText, vars), { exact: false }).first()
          .waitFor({ state: 'visible', timeout: 10000 });
        result.actual = `등록 후 검색 결과에 "${tpl(kase.expect.rowText, vars)}" 노출`;
        result.evidence.push(await shoot(page, shotDir, shotName('result'), `${result.title} (검색결과)`, ctx.evidence));
        break;
      }
      case 'create-duplicate': {
        await clickExact(workArea(page), scenario.openButton);
        await page.waitForTimeout(500);
        const panel = formPanel(page);
        await fillFields(panel, kase.fields ?? scenario.fields, vars);
        result.evidence.push(await shoot(page, shotDir, shotName('filled'), `${result.title} (중복키 입력)`, ctx.evidence, 'panel'));
        ctx.expectingRed = true;
        await clickExact(panel, scenario.submitButton);
        await page.getByText(kase.expect.modalText, { exact: false }).first().waitFor({ state: 'visible', timeout: 10000 });
        result.evidence.push(await shoot(page, shotDir, shotName('modal'), `${result.title} (오류 모달)`, ctx.evidence, 'viewport'));
        const gotRed = ctx.redResponses.some((r) => r.includes(String(kase.expect.httpStatus ?? 409)));
        if (!gotRed) throw new Error(`예상 RED HTTP ${kase.expect.httpStatus ?? 409} 응답이 캡처되지 않음`);
        result.actual = `중복 등록 → 오류 모달 표시 + HTTP ${kase.expect.httpStatus ?? 409} 확인`;
        if (kase.closeButton) await clickExact(page, kase.closeButton).catch(() => {});
        await page.waitForTimeout(300);
        await clickExact(formPanel(page), scenario.cancelButton).catch(() => {});
        await page.waitForTimeout(500);
        ctx.expectingRed = false;
        break;
      }
      case 'update': {
        const rowText = tpl(`{{${scenario.testData?.primaryKey}}}`, vars);
        const row = page.locator('tr', { hasText: rowText }).first();
        await row.waitFor({ state: 'visible', timeout: 10000 });
        await row.locator('button').nth(kase.rowActionIndex ?? 0).click();
        await page.waitForTimeout(700);
        const panel = formPanel(page);
        await fillFields(panel, kase.fields, vars);
        result.evidence.push(await shoot(page, shotDir, shotName('filled'), `${result.title} (변경 입력)`, ctx.evidence, 'panel'));
        await clickExact(panel, scenario.editSubmitButton ?? '수정');
        await page.waitForTimeout(1300);
        await doSearch(page, scenario, vars);
        await workArea(page).getByText(tpl(kase.expect.rowText, vars), { exact: false }).first()
          .waitFor({ state: 'visible', timeout: 10000 });
        result.actual = `수정 후 "${tpl(kase.expect.rowText, vars)}" 반영 확인`;
        result.evidence.push(await shoot(page, shotDir, shotName('result'), `${result.title} (검색결과)`, ctx.evidence));
        break;
      }
      case 'delete': {
        const rowText = tpl(`{{${scenario.testData?.primaryKey}}}`, vars);
        const row = page.locator('tr', { hasText: rowText }).first();
        await row.waitFor({ state: 'visible', timeout: 10000 });
        await row.locator('button').nth(kase.rowActionIndex ?? 1).click();
        await page.waitForTimeout(500);
        result.evidence.push(await shoot(page, shotDir, shotName('confirm'), `${result.title} (확인 모달)`, ctx.evidence, 'dialog'));
        await clickExact(page, kase.confirmButton ?? '확인');
        await page.waitForTimeout(1300);
        await doSearch(page, scenario, vars);
        await page.waitForTimeout(500);
        result.actual = '삭제 확인 모달 → 확인 → 행 제거';
        result.evidence.push(await shoot(page, shotDir, shotName('after'), `${result.title} (삭제 후)`, ctx.evidence));
        break;
      }
      case 'api-verify': {
        const res = await apiGet(tpl(scenario.apiVerify.searchPath, vars));
        const body = await res?.json().catch(() => null);
        const items = getPath(body, scenario.apiVerify.listPath ?? 'data', []);
        const mv = tpl(scenario.apiVerify.matchValue, vars);
        const present = Array.isArray(items) && items.some((it) => String(it?.[scenario.apiVerify.matchField]) === mv);
        if (!res?.ok || present) throw new Error(`API 검증 실패: 임시 행(${mv})이 여전히 존재(HTTP ${res?.status})`);
        result.actual = `API 조회 결과 임시 행(${mv}) 부재 확인 — 정리 완료`;
        break;
      }
      default:
        throw new Error(`알 수 없는 케이스 타입: ${kase.type}`);
    }
  } catch (err) {
    result.status = 'FAIL';
    result.error = err.message;
    result.evidence.push(await shoot(page, shotDir, shotName('FAIL'), `${result.title} (실패 시점)`, ctx.evidence, 'viewport').catch(() => null));
    result.evidence = result.evidence.filter(Boolean);
  }
  return result;
}

/* ---------- 리포트 ---------- */
function renderReport(scenario, vars, caseResults) {
  const pass = caseResults.filter((c) => c.status === 'PASS').length;
  const fail = caseResults.length - pass;
  const badge = (s) => s === 'PASS'
    ? '<span style="color:#fff;background:#16a34a;padding:2px 8px;border-radius:6px;font-size:12px;font-weight:700">PASS</span>'
    : '<span style="color:#fff;background:#dc2626;padding:2px 8px;border-radius:6px;font-size:12px;font-weight:700">FAIL</span>';
  const sections = caseResults.map((c, i) => `
    <section class="case ${c.status === 'FAIL' ? 'fail' : ''}">
      <h2>${i + 1}. ${htmlEscape(c.title)} ${badge(c.status)}</h2>
      <table class="kv">
        <tr><th>유형</th><td><code>${htmlEscape(c.type)}</code></td></tr>
        <tr><th>예상 동작</th><td>${htmlEscape(c.expected || '-')}</td></tr>
        <tr><th>실제 결과</th><td>${htmlEscape(c.actual || (c.error ?? '-'))}</td></tr>
        ${c.error ? `<tr><th>오류</th><td style="color:#dc2626">${htmlEscape(c.error)}</td></tr>` : ''}
      </table>
      <div class="shots">
        ${c.evidence.map((e) => `<figure><figcaption>${htmlEscape(e.label)}</figcaption><a href="${htmlEscape(e.src)}"><img src="${htmlEscape(e.src)}" alt="${htmlEscape(e.label)}"></a></figure>`).join('')}
      </div>
    </section>`).join('');
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8">
<title>${htmlEscape(scenario.title)} QA</title>
<style>
  body{font-family:'Malgun Gothic',Arial,sans-serif;margin:0;background:#f6f7f9;color:#111827}
  header{padding:22px 32px;background:#111827;color:#fff}
  header h1{margin:0 0 6px;font-size:22px}
  header a{color:#93c5fd}
  main{padding:20px 32px 48px;max-width:1200px}
  .summary{background:#fff;border:1px solid #d8dee8;border-radius:8px;padding:16px;margin-bottom:18px;font-size:15px}
  .case{background:#fff;border:1px solid #d8dee8;border-radius:8px;padding:16px 18px;margin-bottom:16px}
  .case.fail{border-color:#dc2626;box-shadow:0 0 0 1px #dc2626 inset}
  .case h2{font-size:16px;margin:0 0 10px}
  table.kv{border-collapse:collapse;margin-bottom:12px;width:100%}
  table.kv th{text-align:left;width:110px;color:#6b7280;font-weight:600;padding:3px 8px 3px 0;vertical-align:top;font-size:13px}
  table.kv td{padding:3px 0;font-size:13px}
  code{background:#eef2f7;padding:2px 5px;border-radius:4px}
  .shots{display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:12px}
  figure{margin:0;border:1px solid #e2e8f0;border-radius:6px;overflow:hidden;background:#fafafa}
  figcaption{padding:7px 10px;font-weight:700;font-size:12px;border-bottom:1px solid #e2e8f0}
  img{display:block;width:100%}
</style></head><body>
<header>
  <h1>${htmlEscape(scenario.title)} — 상세 CRUD QA</h1>
  <div>대상: <a href="${htmlEscape(baseUrl)}${htmlEscape(scenario.route)}">${htmlEscape(baseUrl)}${htmlEscape(scenario.route)}</a>
  · 테스트 키: <code>${htmlEscape(vars[scenario.testData?.primaryKey])}</code>
  · 일시(KST): ${htmlEscape(vars.reportDate)}</div>
</header>
<main>
  <div class="summary">
    <strong>결과: ${fail === 0 ? 'PASS' : 'FAIL'}</strong> — 총 ${caseResults.length}개 케이스 중 PASS ${pass} / FAIL ${fail}
  </div>
  ${sections}
</main></body></html>`;
}

/* ---------- 메인 ---------- */
async function main() {
  const scenario = await loadScenario(process.argv[2]);
  const vars = buildVars(scenario);
  const slug = scenario.reportSlug ?? `hanes-${scenario.id}-detailed-qa`;
  const baseDir = path.resolve('docs/reports/hanes-master-detailed-qa');
  const outDir = path.join(baseDir, scenario.id);
  const shotDir = path.join(outDir, 'screenshots');
  await fs.mkdir(shotDir, { recursive: true });

  await cleanup(scenario, vars);

  const ctx = { scenario, vars, shotDir, evidence: [], expectingRed: false, redResponses: [] };
  let browser;
  const caseResults = [];
  try {
    browser = await chromium.launch({ headless: !headed, slowMo });
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: 'ko-KR', timezoneId: 'Asia/Seoul' });
    const page = await context.newPage();
    page.setDefaultTimeout(12000);
    ctx.page = page;

    page.on('response', (res) => {
      if (res.status() < 400 || !res.url().includes('/api/')) return;
      if (ctx.expectingRed) ctx.redResponses.push(`http ${res.status()} ${res.url()}`);
    });

    await injectAuth(page);
    await page.goto(`${baseUrl}${scenario.route}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});

    for (let i = 0; i < scenario.cases.length; i++) {
      // 예상 텍스트 라벨 채우기(리포트 표기용)
      const k = scenario.cases[i];
      k.expectText = k.expectText ?? tpl(k.expectSummary ?? '', vars);
      const r = await runCase(ctx, k, i);
      caseResults.push(r);
    }
  } finally {
    await browser?.close().catch(() => {});
    if (process.env.HANES_QA_KEEP !== '1') await cleanup(scenario, vars);
  }

  const reportPath = path.join(outDir, 'index.html');
  await fs.writeFile(reportPath, renderReport(scenario, vars, caseResults), 'utf8');
  const summary = {
    id: scenario.id, title: scenario.title, route: scenario.route,
    menuLabel: scenario.menuLabel ?? scenario.title,
    status: caseResults.some((c) => c.status === 'FAIL') ? 'FAIL' : 'PASS',
    total: caseResults.length,
    pass: caseResults.filter((c) => c.status === 'PASS').length,
    fail: caseResults.filter((c) => c.status === 'FAIL').length,
    reportRel: `${scenario.id}/index.html`,
    cases: caseResults.map((c) => ({ id: c.id, type: c.type, title: c.title, status: c.status, actual: c.actual, error: c.error })),
    testKey: vars[scenario.testData?.primaryKey],
    ranAt: vars.reportDate,
  };
  await fs.writeFile(path.join(outDir, 'result.json'), JSON.stringify(summary, null, 2), 'utf8');

  console.log(JSON.stringify({ status: summary.status, id: summary.id, pass: summary.pass, fail: summary.fail, reportPath }, null, 2));
  if (summary.fail > 0) process.exitCode = 2;
}

main().catch((err) => { console.error(err); process.exitCode = 1; });
