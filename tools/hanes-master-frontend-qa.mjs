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
const outDir = path.resolve('docs/reports/hanes-master-frontend-qa-2026-06-12');
const screenshotDir = path.join(outDir, 'screenshots');
const reportPath = path.resolve('docs/reports/hanes-master-frontend-qa-2026-06-12.html');
const token = process.env.HANES_TOKEN ?? 'admin@hanes.com';

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

const routes = [
  ['/master/bom', 'BOM관리'],
  ['/master/code', '공통코드'],
  ['/master/company', '회사/사업장관리'],
  ['/master/equip', '설비마스터'],
  ['/master/equip-inspect', '설비점검매핑'],
  ['/master/equip-inspect-item', '설비점검항목마스터'],
  ['/master/gauge', '계측기관리'],
  ['/master/iqc-item', 'IQC 품목검사'],
  ['/master/iqc-part-spec', 'IQC 품목규격'],
  ['/master/label', '라벨템플릿'],
  ['/master/part', '품목관리'],
  ['/master/partner', '거래처관리'],
  ['/master/process', '공정관리'],
  ['/master/process-capa', '공정CAPA'],
  ['/master/prod-line', '생산라인'],
  ['/master/routing', '라우팅관리'],
  ['/master/vendor-barcode', '제조사바코드'],
  ['/master/warehouse', '창고관리'],
  ['/master/work-calendar', '작업달력'],
  ['/master/work-instruction', '작업지도서'],
  ['/master/worker', '작업자관리'],
];

const routeScenarios = {
  '/master/bom': '완제품 기준 BOM 트리/자품목 목록을 로드하고 BOM 추가 진입 경로가 열리는지 확인',
  '/master/code': '공통코드 그룹/상세코드 목록을 조회하고 신규 코드 등록 폼 진입을 확인',
  '/master/company': '회사와 사업장 기준정보를 조회하고 사업장/회사 편집 진입 경로를 확인',
  '/master/equip': '설비 마스터 목록을 조회하고 설비 등록 패널 진입을 확인',
  '/master/equip-inspect': '설비별 점검항목 매핑 화면을 조회하고 점검항목 추가 진입을 확인',
  '/master/equip-inspect-item': '설비점검 항목 풀/마스터 목록을 조회하고 검색 결과 렌더링을 확인',
  '/master/gauge': '계측기 마스터 목록을 조회하고 계측기 등록 폼 진입을 확인',
  '/master/iqc-item': 'IQC 품목검사 그룹/연결 화면을 조회하고 검사 기준 등록 진입을 확인',
  '/master/iqc-part-spec': '품목별 IQC 규격 화면을 조회하고 검색 결과 렌더링을 확인',
  '/master/label': '라벨 템플릿 디자이너/목록 화면을 조회하고 템플릿 검색 결과를 확인',
  '/master/part': '품목 마스터 목록을 조회하고 품목 추가 패널 진입을 확인',
  '/master/partner': '거래처 마스터 목록을 조회하고 거래처 추가 패널 진입을 확인',
  '/master/process': '공정 마스터 목록을 조회하고 공정 추가 패널 진입을 확인',
  '/master/process-capa': '공정별 CAPA 기준 목록을 조회하고 CAPA 등록 진입을 확인',
  '/master/prod-line': '생산라인 마스터 목록을 조회하고 생산라인 등록 폼 진입을 확인',
  '/master/routing': '라우팅 그룹/공정 구성 화면을 조회하고 라우팅 추가 진입을 확인',
  '/master/vendor-barcode': '제조사 바코드 매핑 목록을 조회하고 매핑 추가 진입을 확인',
  '/master/warehouse': '창고/위치/이동규칙 기준정보를 조회하고 신규 창고 등록 진입을 확인',
  '/master/work-calendar': '작업달력 목록과 일자 생성 관리 화면을 조회하고 달력 추가 진입을 확인',
  '/master/work-instruction': '작업지도서 목록을 조회하고 작업지도서 등록 진입을 확인',
  '/master/worker': '작업자 마스터 목록을 조회하고 작업자 추가 패널 진입을 확인',
};

const selectedRoute = process.env.HANES_QA_ROUTE;
const activeRoutes = selectedRoute
  ? routes.filter(([route]) => route === selectedRoute)
  : routes;
if (selectedRoute && activeRoutes.length === 0) {
  throw new Error(`unknown HANES_QA_ROUTE: ${selectedRoute}`);
}

const startedAt = new Date();

function safeName(route) {
  return route.replace(/^\//, '').replace(/[\\/]/g, '__');
}

function htmlEscape(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

async function ensureBackendAuth() {
  const res = await fetch(`${apiUrl}/auth/me`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'X-Company': '40',
      'X-Plant': '1000',
    },
  });
  if (!res.ok) {
    throw new Error(`auth/me failed: HTTP ${res.status}`);
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

async function screenshot(page, file, mode = 'content') {
  const fullPath = path.join(screenshotDir, file);
  if (mode === 'form') {
    const dialog = page.getByRole('dialog').first();
    if (await dialog.isVisible().catch(() => false)) {
      await dialog.screenshot({ path: fullPath });
      return path.relative(path.dirname(reportPath), fullPath).replaceAll('\\', '/');
    }
  }

  const target = workArea(page);
  if (await target.isVisible().catch(() => false)) {
    await target.screenshot({ path: fullPath });
  } else {
    await page.screenshot({ path: fullPath, fullPage: false });
  }
  return path.relative(path.dirname(reportPath), fullPath).replaceAll('\\', '/');
}

async function visibleText(page, limit = 1200) {
  const text = await page.locator('body').innerText({ timeout: 10000 }).catch(() => '');
  return text.replace(/\s+/g, ' ').trim().slice(0, limit);
}

async function clickFirst(root, candidates) {
  for (const candidate of candidates) {
    const locator = root.getByRole('button', { name: candidate }).first();
    if (await locator.isVisible().catch(() => false)) {
      await locator.click({ timeout: 5000 });
      return candidate.toString();
    }
  }
  return null;
}

async function exerciseTabs(page) {
  const names = [];
  const root = workArea(page);
  const tabs = root.getByRole('tab');
  const count = Math.min(await tabs.count().catch(() => 0), 8);
  for (let i = 0; i < count; i += 1) {
    const tab = tabs.nth(i);
    if (!(await tab.isVisible().catch(() => false))) continue;
    const name = (await tab.innerText().catch(() => `tab-${i}`)).trim();
    await tab.click({ timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(600);
    names.push(name || `tab-${i}`);
  }
  return names;
}

async function exerciseSearch(page) {
  const root = workArea(page);
  const input = root.locator([
    'input[placeholder*="검색"]',
    'input[aria-label*="검색"]',
    'input[placeholder*="search" i]',
    'input[type="search"]',
  ].join(',')).first();
  if (!(await input.isVisible().catch(() => false))) return null;

  await input.fill('HNS02').catch(async () => {
    await input.fill('A');
  });
  await page.keyboard.press('Enter').catch(() => {});
  await clickFirst(root, [/검색/, /조회/]);
  await page.waitForTimeout(900);
  return '검색어 HNS02 입력 후 Enter/검색 버튼 실행';
}

async function exerciseOpenForm(page) {
  const root = workArea(page);
  const clicked = await clickFirst(root, [/추가/, /신규/]);
  if (!clicked) return null;
  await page.waitForTimeout(900);
  return `저장 없이 등록 진입 버튼 확인: ${clicked}`;
}

async function closeOpenForm(page) {
  const closeClicked = await clickFirst(page, [/취소/, /닫기/, /Cancel/, /Close/]);
  if (!closeClicked) {
    await page.keyboard.press('Escape').catch(() => {});
  }
  await page.waitForTimeout(500);
}

async function testRoute(context, route, label) {
  const page = await context.newPage();
  page.setDefaultTimeout(8000);
  page.setDefaultNavigationTimeout(25000);
  const consoleErrors = [];
  const pageErrors = [];
  const badResponses = [];

  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', (err) => pageErrors.push(err.message));
  page.on('response', (res) => {
    const url = res.url();
    const status = res.status();
    if (status >= 400 && (url.includes('/api/') || url.includes('/_next/'))) {
      badResponses.push(`${status} ${url}`);
    }
  });

  const evidence = [];
  const interactions = [];
  const failures = [];
  const url = `${baseUrl}${route}`;
  const slug = safeName(route);

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 25000 });
    await page.waitForLoadState('networkidle', { timeout: 6000 }).catch(() => {});
    await page.waitForTimeout(700);
    const textAfterLoad = await visibleText(page);
    evidence.push({ type: '초기 업무영역', src: await screenshot(page, `${slug}__01_load.png`) });

    if (page.url().includes('/login')) failures.push('인증 세션이 유지되지 않아 로그인 화면으로 이동함');
    if (!textAfterLoad || textAfterLoad.length < 20) failures.push('본문 텍스트가 비어 있거나 렌더링이 충분하지 않음');
    if (/Application error|Unhandled Runtime Error|서버에 연결할 수 없습니다/.test(textAfterLoad)) {
      failures.push('화면 오류 문구 감지');
    }

    const tabs = await exerciseTabs(page);
    if (tabs.length > 0) {
      interactions.push(`탭 전환: ${tabs.join(', ')}`);
      evidence.push({ type: '탭 전환 후 업무영역', src: await screenshot(page, `${slug}__02_tabs.png`) });
    }

    const search = await exerciseSearch(page);
    if (search) {
      interactions.push(search);
      evidence.push({ type: '검색/조회 후 업무영역', src: await screenshot(page, `${slug}__03_search.png`) });
    }

    const form = await exerciseOpenForm(page);
    if (form) {
      interactions.push(form);
      evidence.push({ type: '추가/등록 폼 또는 패널', src: await screenshot(page, `${slug}__04_form.png`, 'form') });
      await closeOpenForm(page);
    }

    await page.waitForTimeout(800);
  } catch (err) {
    failures.push(err.message);
    await screenshot(page, `${slug}__error.png`).then((src) => {
      evidence.push({ type: '오류 화면', src });
    }).catch(() => {});
  } finally {
    if (consoleErrors.length > 0) failures.push(`console error ${consoleErrors.length}건`);
    if (pageErrors.length > 0) failures.push(`page error ${pageErrors.length}건`);
    if (badResponses.length > 0) failures.push(`HTTP 실패 ${badResponses.length}건`);
    await page.close().catch(() => {});
  }

  return {
    route,
    label,
    scenario: routeScenarios[route] ?? `${label} 화면 로드와 주요 조회/등록 진입 경로 확인`,
    status: failures.length === 0 ? 'PASS' : 'FAIL',
    interactions,
    evidence,
    consoleErrors,
    pageErrors,
    badResponses,
    failures,
  };
}

function renderReport(results) {
  const passed = results.filter((r) => r.status === 'PASS').length;
  const failed = results.length - passed;
  const rows = results.map((r) => `
    <tr class="${r.status === 'PASS' ? 'pass' : 'fail'}">
      <td>${htmlEscape(r.label)}</td>
      <td><code>${htmlEscape(r.route)}</code></td>
      <td>${r.status}</td>
      <td>${htmlEscape(r.scenario)}</td>
      <td>${htmlEscape(r.interactions.join(' / ') || '화면 로드 및 캡처')}</td>
      <td>${htmlEscape(r.failures.join(' | ') || '-')}</td>
    </tr>`).join('');

  const details = results.map((r) => `
    <section class="card ${r.status === 'PASS' ? 'pass' : 'fail'}">
      <h2>${htmlEscape(r.label)} <code>${htmlEscape(r.route)}</code> <span>${r.status}</span></h2>
      <p><strong>메뉴별 시나리오:</strong> ${htmlEscape(r.scenario)}</p>
      <p><strong>실행 액션:</strong> ${htmlEscape(r.interactions.join(' / ') || '페이지 진입, 초기 화면 렌더링, 콘솔/API 오류 확인')}</p>
      ${r.failures.length ? `<p class="fail-text"><strong>실패:</strong> ${htmlEscape(r.failures.join(' | '))}</p>` : '<p class="pass-text"><strong>결과:</strong> 화면 로드와 비파괴 상호작용 성공, 콘솔/API 오류 없음.</p>'}
      ${r.consoleErrors.length ? `<details><summary>Console errors</summary><pre>${htmlEscape(r.consoleErrors.join('\n'))}</pre></details>` : ''}
      ${r.pageErrors.length ? `<details><summary>Page errors</summary><pre>${htmlEscape(r.pageErrors.join('\n'))}</pre></details>` : ''}
      ${r.badResponses.length ? `<details><summary>HTTP failures</summary><pre>${htmlEscape(r.badResponses.join('\n'))}</pre></details>` : ''}
      <div class="shots">
        ${r.evidence.map((e) => `
          <figure>
            <figcaption>${htmlEscape(e.type)}</figcaption>
            <a href="${htmlEscape(e.src)}"><img src="${htmlEscape(e.src)}" alt="${htmlEscape(r.label)} ${htmlEscape(e.type)}"></a>
          </figure>`).join('')}
      </div>
    </section>`).join('');

  return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <title>HANES 기준정보 프론트엔드 실테스트 보고서</title>
  <style>
    body { font-family: Arial, "Malgun Gothic", sans-serif; margin: 0; background: #f6f7f9; color: #1f2937; }
    header { background: #111827; color: white; padding: 28px 36px; }
    main { padding: 24px 36px 48px; }
    h1 { margin: 0 0 10px; font-size: 26px; }
    h2 { display: flex; gap: 10px; align-items: baseline; font-size: 19px; }
    h2 span { margin-left: auto; font-size: 13px; }
    .summary { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; margin: 18px 0; }
    .metric, .card { background: white; border: 1px solid #d8dee8; border-radius: 8px; padding: 16px; }
    .metric strong { display: block; font-size: 26px; margin-top: 6px; }
    table { width: 100%; border-collapse: collapse; background: white; margin: 18px 0 28px; }
    th, td { border: 1px solid #d8dee8; padding: 9px; vertical-align: top; font-size: 13px; }
    th { background: #eef2f7; text-align: left; }
    .pass td:first-child, .pass-text { color: #047857; }
    .fail td:first-child, .fail-text { color: #b91c1c; }
    .card { margin-bottom: 18px; }
    .shots { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 12px; }
    figure { margin: 0; border: 1px solid #d8dee8; background: #f9fafb; }
    figcaption { padding: 8px 10px; font-size: 13px; font-weight: 700; }
    img { width: 100%; display: block; border-top: 1px solid #d8dee8; }
    code { background: #eef2f7; padding: 2px 5px; border-radius: 4px; }
    pre { white-space: pre-wrap; font-size: 12px; background: #111827; color: #e5e7eb; padding: 12px; overflow: auto; }
  </style>
</head>
<body>
  <header>
    <h1>HANES 기준정보 프론트엔드 실테스트 보고서</h1>
    <div>실행: ${htmlEscape(startedAt.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }))} KST / 대상: <code>${htmlEscape(baseUrl)}</code> / API: <code>${htmlEscape(apiUrl)}</code></div>
  </header>
  <main>
    <section class="summary">
      <div class="metric">대상 메뉴<strong>${results.length}</strong></div>
      <div class="metric">성공<strong>${passed}</strong></div>
      <div class="metric">실패<strong>${failed}</strong></div>
      <div class="metric">캡처<strong>${results.reduce((sum, r) => sum + r.evidence.length, 0)}</strong></div>
    </section>
    <h2>결과 요약</h2>
    <table>
      <thead><tr><th>메뉴</th><th>경로</th><th>결과</th><th>메뉴별 시나리오</th><th>실행 액션</th><th>오류</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <h2>화면 증거</h2>
    ${details}
  </main>
</body>
</html>`;
}

async function main() {
  await fs.mkdir(screenshotDir, { recursive: true });
  await ensureBackendAuth();

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    locale: 'ko-KR',
    timezoneId: 'Asia/Seoul',
  });

  const setup = await context.newPage();
  await injectAuth(setup);
  await setup.close();

  const results = [];
  for (const [route, label] of activeRoutes) {
    const result = await testRoute(context, route, label);
    results.push(result);
    console.log(`${result.status} ${route} ${label} screenshots=${result.evidence.length}`);
  }

  await browser.close();

  await fs.writeFile(reportPath, renderReport(results), 'utf8');
  const jsonPath = path.join(outDir, 'result.json');
  await fs.writeFile(jsonPath, JSON.stringify({
    startedAt: startedAt.toISOString(),
    baseUrl,
    apiUrl,
    total: results.length,
    passed: results.filter((r) => r.status === 'PASS').length,
    failed: results.filter((r) => r.status === 'FAIL').length,
    results,
  }, null, 2), 'utf8');

  const failed = results.filter((r) => r.status === 'FAIL');
  console.log(JSON.stringify({
    reportPath,
    jsonPath,
    total: results.length,
    passed: results.length - failed.length,
    failed: failed.length,
    failures: failed.map((r) => ({ route: r.route, label: r.label, failures: r.failures })),
  }, null, 2));

  if (failed.length > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
