import fs from 'node:fs/promises';
import { readFileSync, readdirSync, statSync } from 'node:fs';
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

const baseUrl = process.env.HANES_FRONTEND_URL ?? 'http://localhost:3002';
const apiUrl = process.env.HANES_API_URL ?? 'http://localhost:3003/api/v1';
const token = process.env.HANES_TOKEN ?? 'admin@hanes.com';
const oracleConnector = 'C:/Users/hsyou/.codex/skills/oracle-db/scripts/oracle_connector.py';
const oracleSite = process.env.HANES_ORACLE_SITE ?? 'JSHANES';
const reportRoot = path.resolve(`docs/reports/hanes-page-scenario-qa-${reportDate}`);
const pageDir = path.join(reportRoot, 'pages');
const shotRoot = path.join(reportRoot, 'screenshots');
const indexPath = path.join(reportRoot, 'index.html');
const resultPath = path.join(reportRoot, 'master-remaining-result.json');

const user = {
  id: 'admin@hanes.com',
  email: 'admin@hanes.com',
  name: '시스템관리자',
  role: 'ADMIN',
  status: 'ACTIVE',
  company: '40',
  plant: '1000',
};

const pages = [
  { slug: 'master-code', route: '/master/code', title: '코드관리', api: '/master/com-codes?limit=20', tables: ['COM_CODES'], crudModules: ['공통코드'] },
  { slug: 'master-company', route: '/master/company', title: '회사관리', api: '/master/companies', tables: ['COMPANY_MASTERS', 'PLANTS'], crudModules: ['회사'] },
  { slug: 'master-equip', route: '/master/equip', title: '설비관리', api: '/equipment/equips?limit=20', tables: ['EQUIP_MASTERS'], crudModules: ['설비'] },
  { slug: 'master-equip-inspect', route: '/master/equip-inspect', title: '설비별 점검항목', api: '/master/equip-inspect-items?limit=20', tables: ['EQUIP_INSPECT_ITEM_MASTERS'], crudModules: ['설비점검매핑'] },
  { slug: 'master-equip-inspect-item', route: '/master/equip-inspect-item', title: '점검항목마스터', api: '/master/equip-inspect-item-masters?limit=20', tables: ['EQUIP_INSPECT_ITEM_POOL'], crudModules: ['설비점검항목마스터'] },
  { slug: 'master-gauge', route: '/master/gauge', title: '계측기마스터', api: '/quality/msa/gauges?limit=20', tables: ['GAUGE_MASTERS'], crudModules: ['계측기'] },
  { slug: 'master-iqc-item', route: '/master/iqc-item', title: '검사항목마스터', api: '/master/iqc-items?limit=20', tables: ['IQC_ITEM_MASTERS', 'IQC_ITEM_POOL'], crudModules: ['IQC검사항목풀', 'IQC템플릿'] },
  { slug: 'master-iqc-part-spec', route: '/master/iqc-part-spec', title: '품목별 IQC 항목관리', api: '/master/iqc-part-specs?limit=20', tables: ['IQC_PART_SPECS', 'IQC_PART_SPEC_ITEMS'], crudModules: ['IQC품목검사', 'IQC품목규격'] },
  { slug: 'master-label', route: '/master/label', title: '라벨관리', api: '/master/label-templates?limit=20', tables: ['LABEL_TEMPLATES'], crudModules: ['라벨템플릿'] },
  { slug: 'master-partner', route: '/master/partner', title: '거래처관리', api: '/master/partners?limit=20', tables: ['PARTNER_MASTERS'], crudModules: ['거래처'] },
  { slug: 'master-process', route: '/master/process', title: '공정관리', api: '/master/processes?limit=20', tables: ['PROCESS_MASTERS'], crudModules: ['공정'] },
  { slug: 'master-process-capa', route: '/master/process-capa', title: '공정 CAPA', api: '/master/process-capas?limit=20', tables: ['PROCESS_CAPAS'], crudModules: ['공정CAPA'] },
  { slug: 'master-prod-line', route: '/master/prod-line', title: '생산라인관리', api: '/master/prod-lines?limit=20', tables: ['PROD_LINE_MASTERS'], crudModules: ['생산라인'] },
  { slug: 'master-routing', route: '/master/routing', title: '라우팅관리', api: '/master/routing-groups?limit=20', tables: ['ROUTING_GROUPS', 'ROUTING_PROCESSES', 'ROUTING_MATERIALS'], crudModules: ['라우팅그룹', '라우팅공정', '라우팅자재'] },
  { slug: 'master-vendor-barcode', route: '/master/vendor-barcode', title: '제조사 바코드 매핑', api: '/master/vendor-barcode-mappings?limit=20', tables: ['VENDOR_BARCODE_MAPPINGS'], crudModules: ['제조사바코드'] },
  { slug: 'master-warehouse', route: '/master/warehouse', title: '창고관리', api: '/inventory/warehouses?limit=20', tables: ['WAREHOUSES', 'WAREHOUSE_LOCATIONS', 'WAREHOUSE_TRANSFER_RULES'], crudModules: ['창고-A', '창고-B', '창고위치', '창고이동규칙'] },
  { slug: 'master-work-calendar', route: '/master/work-calendar', title: '생산월력관리', api: '/master/work-calendars?limit=20', tables: ['WORK_CALENDARS', 'WORK_CALENDAR_DAYS', 'SHIFT_PATTERNS'], crudModules: ['교대패턴', '작업달력'] },
  { slug: 'master-work-instruction', route: '/master/work-instruction', title: '작업지도서관리', api: '/master/work-instructions?limit=20', tables: ['WORK_INSTRUCTIONS'], crudModules: ['작업지도서'] },
  { slug: 'master-worker', route: '/master/worker', title: '작업자관리', api: '/master/workers?limit=20', tables: ['WORKER_MASTERS'], crudModules: ['작업자'], skipCreateOpen: true },
];

const targetOnly = process.env.HANES_QA_ONLY;
const activePages = targetOnly ? pages.filter((page) => page.slug === targetOnly || page.route === targetOnly) : pages;
if (targetOnly && activePages.length === 0) throw new Error(`unknown HANES_QA_ONLY: ${targetOnly}`);

const completedPages = [
  { slug: 'master-part', title: '품목관리', route: '/master/part', file: 'pages/master-part.html', scenario: '조회 → 검색 → 신규 → 저장 검증 → 중복 방어 → DB/API 확인 → 수정 → 삭제 → 재조회' },
  { slug: 'master-bom', title: 'BOM관리', route: '/master/bom', file: 'pages/master-bom.html', scenario: '조회 → 검색 → 템플릿/내보내기 → 신규 → 저장 검증 → DB/API 확인 → 중복 방어 → 수정 → 라우팅 패널 → 삭제 → 재조회' },
];

const current = {
  stepId: 'init',
  pageSlug: null,
};

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

async function directApi(method, urlPath, pageApiEvents, body = undefined) {
  const res = await fetch(`${apiUrl}${urlPath}`, {
    method,
    headers: headers(),
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(15000),
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text.slice(0, 500) };
  }
  pageApiEvents.push({
    source: 'direct-api',
    stepId: current.stepId,
    method,
    url: `/api/v1${urlPath}`,
    status: res.status,
    ok: res.status >= 200 && res.status < 400,
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

function countSql(tableName) {
  return `SELECT COUNT(*) AS CNT FROM ${tableName} WHERE ROWNUM <= 100000000`;
}

async function injectAuth(page) {
  await page.goto(`${baseUrl}/login`, { waitUntil: 'domcontentloaded', timeout: 45000 });
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

async function capture(page, pageInfo, stepIndex, name, label, dialog = false) {
  const dir = path.join(shotRoot, pageInfo.slug);
  await fs.mkdir(dir, { recursive: true });
  const fileName = `${String(stepIndex).padStart(2, '0')}-${safeSlug(name)}.png`;
  const fullPath = path.join(dir, fileName);
  const target = dialog ? page.getByRole('dialog').first() : workArea(page);
  if (await target.isVisible().catch(() => false)) {
    await target.screenshot({ path: fullPath, timeout: 20000 });
  } else {
    await page.screenshot({ path: fullPath, fullPage: false, timeout: 20000 });
  }
  return {
    label,
    file: path.relative(pageDir, fullPath).replaceAll('\\', '/'),
  };
}

async function clickFirst(scope, patterns) {
  for (const pattern of patterns) {
    const locator = scope.getByRole('button', { name: pattern }).first();
    if (await locator.isVisible().catch(() => false)) {
      await locator.click({ timeout: 8000 });
      return String(pattern);
    }
  }
  return null;
}

async function closeDialogOrPanel(page) {
  const candidates = [/취소/, /닫기/, /Close/, /Cancel/];
  for (const pattern of candidates) {
    const button = page.getByRole('button', { name: pattern }).last();
    if (await button.isVisible().catch(() => false)) {
      await button.click({ timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(400);
      return true;
    }
  }
  await page.keyboard.press('Escape').catch(() => {});
  await page.waitForTimeout(400);
  return false;
}

async function exerciseTabs(page) {
  const names = [];
  const root = workArea(page);
  const tabs = root.getByRole('tab');
  const count = Math.min(await tabs.count().catch(() => 0), 6);
  for (let index = 0; index < count; index += 1) {
    const tab = tabs.nth(index);
    if (!(await tab.isVisible().catch(() => false))) continue;
    const name = (await tab.innerText().catch(() => `tab-${index}`)).trim();
    await tab.click({ timeout: 6000 }).catch(() => {});
    await page.waitForTimeout(500);
    names.push(name || `tab-${index}`);
  }
  return names;
}

async function deriveSearchTerm(page, pageInfo) {
  if (Object.prototype.hasOwnProperty.call(pageInfo, 'searchTerm')) return pageInfo.searchTerm;
  const root = workArea(page);
  const candidates = await root.locator('tbody td, [role="gridcell"]').evaluateAll((cells) =>
    cells
      .map((cell) => (cell.innerText || cell.textContent || '').replace(/\s+/g, ' ').trim())
      .filter((text) => text.length >= 2 && text.length <= 40)
      .filter((text) => /[0-9A-Za-z가-힣]/.test(text))
      .filter((text) => !/^(수정|삭제|관리|사용|미사용|Y|N|-)$/.test(text))
      .slice(0, 20),
  ).catch(() => []);
  return candidates.find((text) => !/^HNS02/i.test(text)) ?? candidates[0] ?? '';
}

async function exerciseSearch(page, pageInfo) {
  const root = workArea(page);
  const input = root.locator([
    'input[placeholder*="검색"]',
    'input[aria-label*="검색"]',
    'input[placeholder*="search" i]',
    'input[type="search"]',
  ].join(',')).first();
  const term = await deriveSearchTerm(page, pageInfo);
  if (await input.isVisible().catch(() => false)) {
    await input.fill(term ?? '').catch(() => {});
    await page.keyboard.press('Enter').catch(() => {});
  }
  const clicked = await clickFirst(root, [/검색/, /조회/]).catch(() => null);
  await page.waitForTimeout(900);
  if (term) return `검색 입력 ${term} 및 조회/Enter 실행`;
  if (await input.isVisible().catch(() => false)) return '검색어 비움 후 조회/Enter 실행';
  if (clicked) return `검색 입력 없음, ${clicked} 실행`;
  return null;
}

async function resetSearchAndRefresh(page) {
  const root = workArea(page);
  const input = root.locator([
    'input[placeholder*="검색"]',
    'input[aria-label*="검색"]',
    'input[placeholder*="search" i]',
    'input[type="search"]',
  ].join(',')).first();
  let reset = false;
  if (await input.isVisible().catch(() => false)) {
    await input.fill('').catch(() => {});
    await page.keyboard.press('Enter').catch(() => {});
    reset = true;
  }
  const refresh = await clickFirst(root, [/새로고침/, /조회/]).catch(() => null);
  await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(700);
  if (reset && refresh) return `검색 조건 초기화 후 ${refresh} 실행`;
  if (reset) return '검색 조건 초기화 후 Enter 실행';
  if (refresh) return `검색 입력 없음, ${refresh} 실행`;
  return '검색/조회 컨트롤 없음, 현재 화면 기준 확인';
}

async function countVisibleBodyRowButtons(page) {
  return workArea(page).locator('tbody tr button').evaluateAll((buttons) =>
    buttons.filter((button) => {
      const rect = button.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    }).length,
  ).catch(() => 0);
}

async function collectButtons(page) {
  return workArea(page).getByRole('button').evaluateAll((buttons) =>
    buttons
      .filter((button) => {
        const rect = button.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      })
      .map((button) => (button.innerText || button.getAttribute('title') || button.getAttribute('aria-label') || '').trim())
      .filter(Boolean)
      .slice(0, 40),
  ).catch(() => []);
}

function runCrudSuite() {
  if (process.env.HANES_QA_REUSE_CRUD === '1') {
    const latest = readdirSync(path.resolve('docs/reports'))
      .filter((name) => /^hanes-master-crud-runtime-test-.*\.json$/.test(name))
      .map((name) => path.join('docs/reports', name))
      .sort((a, b) => statSync(path.resolve(b)).mtimeMs - statSync(path.resolve(a)).mtimeMs)[0];
    if (!latest) throw new Error('HANES_QA_REUSE_CRUD=1 but no CRUD runtime result exists');
    const evidence = JSON.parse(readFileSync(path.resolve(latest), 'utf8'));
    return {
      summary: {
        out: latest,
        total: evidence.summary.total,
        passed: evidence.summary.passed,
        failed: evidence.summary.failed,
        cleanup: evidence.cleanup.length,
        failures: evidence.failures.length,
        error: evidence.error ?? null,
      },
      evidence,
    };
  }

  const output = execFileSync('node', ['tools/hanes-master-crud-runtime-test.mjs'], {
    cwd: process.cwd(),
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 180000,
  });
  const match = output.match(/\{[\s\S]*\}\s*$/);
  if (!match) throw new Error(`CRUD runtime output parse failed: ${output}`);
  const summary = JSON.parse(match[0]);
  const evidence = JSON.parse(readFileSync(path.resolve(summary.out), 'utf8'));
  return { summary, evidence };
}

function stepsForModules(crudEvidence, modules) {
  const set = new Set(modules);
  return (crudEvidence?.steps ?? []).filter((step) => set.has(step.module));
}

function duplicateStepsForModules(crudEvidence, modules) {
  return stepsForModules(crudEvidence, modules).filter((step) => step.operation === 'DUPLICATE_GUARD');
}

function cleanupForModules(crudEvidence, modules) {
  const set = new Set(modules);
  return (crudEvidence?.cleanup ?? []).filter((step) => {
    const label = String(step.label ?? '');
    return [...set].some((module) => label.includes(module) || module.includes(label));
  });
}

function crudDbResidueSql(crudEvidence) {
  const c = crudEvidence.codes;
  const clauses = [
    `SELECT 'COM_CODES' AS TABLE_NAME, COUNT(*) AS CNT FROM COM_CODES WHERE GROUP_CODE = '${c.comGroup}'`,
    `SELECT 'COMPANY_MASTERS' AS TABLE_NAME, COUNT(*) AS CNT FROM COMPANY_MASTERS WHERE COMPANY_CODE = '${c.company}'`,
    `SELECT 'PARTNER_MASTERS' AS TABLE_NAME, COUNT(*) AS CNT FROM PARTNER_MASTERS WHERE PARTNER_CODE = '${c.partner}'`,
    `SELECT 'ITEM_MASTERS' AS TABLE_NAME, COUNT(*) AS CNT FROM ITEM_MASTERS WHERE ITEM_CODE IN ('${c.rawPart}', '${c.fgPart}')`,
    `SELECT 'PROCESS_MASTERS' AS TABLE_NAME, COUNT(*) AS CNT FROM PROCESS_MASTERS WHERE PROCESS_CODE = '${c.process}'`,
    `SELECT 'PROD_LINE_MASTERS' AS TABLE_NAME, COUNT(*) AS CNT FROM PROD_LINE_MASTERS WHERE LINE_CODE = '${c.line}'`,
    `SELECT 'WORKER_MASTERS' AS TABLE_NAME, COUNT(*) AS CNT FROM WORKER_MASTERS WHERE WORKER_CODE = '${c.worker}'`,
    `SELECT 'WAREHOUSES' AS TABLE_NAME, COUNT(*) AS CNT FROM WAREHOUSES WHERE WAREHOUSE_CODE IN ('${c.warehouseA}', '${c.warehouseB}')`,
    `SELECT 'EQUIP_MASTERS' AS TABLE_NAME, COUNT(*) AS CNT FROM EQUIP_MASTERS WHERE EQUIP_CODE = '${c.equip}'`,
    `SELECT 'ROUTING_GROUPS' AS TABLE_NAME, COUNT(*) AS CNT FROM ROUTING_GROUPS WHERE ROUTING_CODE = '${c.routing}'`,
    `SELECT 'IQC_ITEM_POOL' AS TABLE_NAME, COUNT(*) AS CNT FROM IQC_ITEM_POOL WHERE INSP_ITEM_CODE = '${c.iqcPool}'`,
    `SELECT 'LABEL_TEMPLATES' AS TABLE_NAME, COUNT(*) AS CNT FROM LABEL_TEMPLATES WHERE TEMPLATE_NAME = '${c.labelTemplate}'`,
    `SELECT 'WORK_CALENDARS' AS TABLE_NAME, COUNT(*) AS CNT FROM WORK_CALENDARS WHERE CALENDAR_ID = '${c.calendar}'`,
    `SELECT 'GAUGE_MASTERS' AS TABLE_NAME, COUNT(*) AS CNT FROM GAUGE_MASTERS WHERE GAUGE_CODE = '${c.gauge}'`,
  ];
  return clauses.join(' UNION ALL ');
}

async function testPage(context, pageInfo, crudEvidence) {
  const page = await context.newPage();
  page.setDefaultTimeout(12000);
  page.setDefaultNavigationTimeout(45000);
  const apiEvents = [];
  const consoleErrors = [];
  const pageErrors = [];
  const steps = [];
  const requestMap = new WeakMap();

  page.on('request', (req) => {
    if (!req.url().includes('/api/')) return;
    requestMap.set(req, {
      source: 'ui-network',
      stepId: current.stepId,
      method: req.method(),
      url: apiPath(req.url()),
      status: null,
      ok: false,
    });
  });
  page.on('response', (res) => {
    if (!res.url().includes('/api/')) return;
    const reqInfo = requestMap.get(res.request()) ?? {
      source: 'ui-network',
      stepId: current.stepId,
      method: res.request().method(),
      url: apiPath(res.url()),
    };
    apiEvents.push({ ...reqInfo, status: res.status(), ok: res.status() >= 200 && res.status() < 400 });
  });
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push({ stepId: current.stepId, text: msg.text() });
  });
  page.on('pageerror', (err) => pageErrors.push({ stepId: current.stepId, text: err.message }));

  current.pageSlug = pageInfo.slug;

  async function addStep(id, title, objective, actions, fn) {
    current.stepId = id;
    const beforeApi = apiEvents.length;
    const result = await fn();
    const relatedApi = apiEvents.slice(beforeApi);
    const failedApi = relatedApi.filter((event) => !event.ok);
    steps.push({
      id,
      title,
      objective,
      actions,
      result: failedApi.length === 0 ? 'PASS' : 'CHECK',
      apiCalls: relatedApi,
      dbChecks: result?.dbChecks ?? [],
      evidence: result?.evidence ?? null,
      notes: result?.notes ?? [],
    });
  }

  await addStep('initial-load', '초기 조회', `${pageInfo.title} 화면 진입과 초기 API 로딩을 확인합니다.`, [
    `브라우저로 ${pageInfo.route} 경로에 진입한다.`,
    '업무 영역 렌더링과 초기 API 응답을 수집한다.',
    '대표 DB 테이블 count를 확인한다.',
  ], async () => {
    await page.goto(`${baseUrl}${pageInfo.route}`, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForLoadState('networkidle', { timeout: 9000 }).catch(() => {});
    await page.waitForTimeout(700);
    const text = await page.locator('body').innerText().catch(() => '');
    if (page.url().includes('/login')) throw new Error(`${pageInfo.route} redirected to login`);
    if (/Application error|Unhandled Runtime Error|서버에 연결할 수 없습니다/.test(text)) throw new Error(`${pageInfo.route} rendered error text`);
    const dbChecks = pageInfo.tables.map((table) => ({ title: `${table} 대표 count`, sql: countSql(table), result: dbQuery(countSql(table)) }));
    return {
      evidence: await capture(page, pageInfo, 1, 'initial-load', '초기 조회 화면'),
      dbChecks,
    };
  });

  await addStep('search-requery', '검색 및 재조회', `${pageInfo.title} 화면의 검색/조회 또는 탭 전환 동작을 확인합니다.`, [
    '화면 탭이 있으면 주요 탭을 순서대로 전환한다.',
    '검색 입력이 있으면 현재 화면 데이터에서 추출한 값으로 검색/조회 동작을 실행한다.',
    '새로고침/조회 버튼이 있으면 호출 가능 여부를 확인한다.',
  ], async () => {
    const tabNames = await exerciseTabs(page);
    const searchNote = await exerciseSearch(page, pageInfo);
    const refresh = await clickFirst(workArea(page), [/새로고침/, /조회/]).catch(() => null);
    await page.waitForTimeout(900);
    return {
      evidence: await capture(page, pageInfo, 2, 'search-requery', '검색/조회/탭 전환 후 화면'),
      notes: [
        tabNames.length ? `탭 전환: ${tabNames.join(', ')}` : '탭 없음 또는 전환 대상 없음',
        searchNote ?? '검색 입력 없음 또는 검색 동작 대상 없음',
        refresh ? `버튼 실행: ${refresh}` : '새로고침/조회 버튼 없음 또는 별도 검색 동작으로 대체',
      ],
    };
  });

  await addStep('button-process-inventory', '버튼 및 프로세스 목록화', `${pageInfo.title} 화면의 노출 버튼과 프로세스 진입점을 수집합니다.`, [
    '검색 단계의 필터가 남아 있으면 조건을 초기화하고 기준 목록을 재조회한다.',
    '업무 영역의 노출 버튼 텍스트/title/aria-label을 수집한다.',
    '저장성 버튼은 이 단계에서 실행하지 않고 기능 목록으로 분류한다.',
  ], async () => {
    const resetNote = await resetSearchAndRefresh(page);
    return {
      evidence: await capture(page, pageInfo, 3, 'button-process-inventory', '검색 초기화 후 버튼 및 프로세스 목록 화면'),
      notes: [
        resetNote,
        `노출 버튼: ${(await collectButtons(page)).join(', ') || '텍스트 버튼 없음'}`,
      ],
    };
  });

  await addStep('create-edit-delete-availability', '신규/수정/삭제 가능 여부', `${pageInfo.title} 화면에서 신규 진입 및 행 액션 노출 여부를 확인합니다.`, [
    '추가/신규 버튼이 있으면 저장 없이 폼 또는 패널을 연다.',
    '등록 폼/패널 화면을 캡처한다.',
    '그리드 행에 수정/삭제류 액션 버튼이 노출되는지 확인한다.',
  ], async () => {
    const rowButtons = await countVisibleBodyRowButtons(page);
    const clicked = pageInfo.skipCreateOpen ? null : await clickFirst(workArea(page), [/추가/, /신규/, /등록/]).catch(() => null);
    let evidence = null;
    if (clicked) {
      await page.waitForTimeout(900);
      evidence = await capture(page, pageInfo, 4, 'create-form-open', '신규/등록 진입 화면', true);
      await closeDialogOrPanel(page);
    } else {
      evidence = await capture(page, pageInfo, 4, 'create-action-unavailable', '신규 진입 버튼 미노출 화면');
    }
    return {
      evidence,
      notes: [
        pageInfo.skipCreateOpen ? '이 화면은 UI 등록 패널 열기 대신 CRUD API 저장 검증으로 대체' : clicked ? `신규/등록 진입 실행: ${clicked}` : '신규/등록 버튼 미노출 또는 별도 프로세스 화면',
        `본문 데이터 행 액션 버튼 수: ${rowButtons}`,
      ],
    };
  });

  await addStep('duplicate-defense', '중복 방어', `${pageInfo.title} 관련 기준정보 저장 API의 동일 키 중복 등록 방어 결과를 확인합니다.`, [
    '기준정보 CRUD 런타임 스위트에서 같은 키로 두 번째 POST를 수행한 DUPLICATE_GUARD 단계를 연결한다.',
    '중복 저장 시 400/409 계열 방어 응답이 발생했는지 확인한다.',
    '화면은 검색 조건이 초기화된 기준 목록 상태로 유지한다.',
  ], async () => {
    const resetNote = await resetSearchAndRefresh(page);
    const duplicateSteps = duplicateStepsForModules(crudEvidence, pageInfo.crudModules);
    return {
      evidence: await capture(page, pageInfo, 5, 'duplicate-defense', '중복 방어 검증 기준 화면'),
      notes: duplicateSteps.length
        ? [
            resetNote,
            `중복 방어 API 단계: ${duplicateSteps.length}건, 성공 ${duplicateSteps.filter((step) => step.ok).length}건`,
            `방어 응답: ${duplicateSteps.map((step) => `${step.module} ${step.status}`).join(', ')}`,
          ]
        : [
            resetNote,
            '연결된 공통 CRUD 런타임 중복 방어 단계 없음',
          ],
    };
  });

  await addStep('api-db-save-verification', '저장 검증 API/DB 확인', `${pageInfo.title} 관련 기준정보 API CRUD 저장 검증 결과와 대표 API/DB 상태를 확인합니다.`, [
    `대표 조회 API ${pageInfo.api}를 직접 호출한다.`,
    '기준정보 CRUD 런타임 스위트의 관련 모듈 create/read/update/delete/cleanup 결과를 연결한다.',
    '대표 DB 테이블 count와 cleanup 결과를 확인한다.',
    '화면 검색 조건을 초기화하고 목록을 재조회한 뒤 최종 증적을 캡처한다.',
  ], async () => {
    const resetNote = await resetSearchAndRefresh(page);
    const direct = await directApi('GET', pageInfo.api, apiEvents);
    const moduleSteps = stepsForModules(crudEvidence, pageInfo.crudModules);
    const moduleCleanup = cleanupForModules(crudEvidence, pageInfo.crudModules);
    if (!direct.res.ok) {
      throw new Error(`${pageInfo.title} direct API failed: ${direct.res.status}`);
    }
    return {
      evidence: await capture(page, pageInfo, 6, 'api-db-verification', '검색 초기화 후 API/DB 검증 기준 화면'),
      dbChecks: pageInfo.tables.map((table) => ({ title: `${table} 대표 count`, sql: countSql(table), result: dbQuery(countSql(table)) })),
      notes: [
        resetNote,
        `관련 CRUD API 단계: ${moduleSteps.length}건, 성공 ${moduleSteps.filter((step) => step.ok).length}건`,
        `관련 cleanup 단계: ${moduleCleanup.length}건, 성공 ${moduleCleanup.filter((step) => step.ok).length}건`,
      ],
    };
  });

  await page.close().catch(() => {});
  const unexpectedConsole = consoleErrors.filter((event) => !/Failed to load resource: the server responded with a status of 409/.test(event.text));
  const unexpectedApi = apiEvents.filter((event) => !event.ok);
  const ok = steps.every((step) => step.result === 'PASS') && unexpectedConsole.length === 0 && pageErrors.length === 0 && unexpectedApi.length === 0;
  return {
    ...pageInfo,
    status: ok ? 'PASS' : 'CHECK',
    steps,
    apiEvents,
    consoleErrors,
    pageErrors,
    unexpectedConsole,
    unexpectedApi,
    reportFile: `pages/${pageInfo.slug}.html`,
  };
}

function apiRows(events) {
  return events.map((event) => `
              <tr>
                <td>${escapeHtml(event.source)}</td>
                <td><code>${escapeHtml(event.method)}</code></td>
                <td><code>${escapeHtml(event.url)}</code></td>
                <td class="${event.ok ? 'pass' : 'warn'}">${escapeHtml(event.status)}</td>
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
            <strong class="${stepInfo.result === 'PASS' ? 'pass' : 'warn'}">${escapeHtml(stepInfo.result)}</strong>
          </div>
          <div class="cols">
            <section>
              <h4>동작 처리</h4>
              <ol>${stepInfo.actions.map((action) => `<li>${escapeHtml(action)}</li>`).join('')}</ol>
              ${stepInfo.notes.length ? `<h4>결과 메모</h4><ul>${stepInfo.notes.map((note) => `<li>${escapeHtml(note)}</li>`).join('')}</ul>` : ''}
            </section>
            <section>
              <h4>API 호출</h4>
              <table><thead><tr><th>구분</th><th>Method</th><th>URL</th><th>Status</th></tr></thead><tbody>${apiRows(stepInfo.apiCalls) || '<tr><td colspan="4">이 단계에서 신규 API 호출 없음</td></tr>'}</tbody></table>
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

function renderPageReport(pageResult, crudEvidence) {
  const featureRows = [
    ['초기 조회', pageResult.api, '실행', '브라우저 초기 로드, UI network API, 대표 DB count 확인'],
    ['검색/조회', '검색 입력, 조회/새로고침, 탭 전환', '실행', '화면에 있는 컨트롤 기준으로 실제 클릭/입력 수행'],
    ['신규 등록 진입', '추가/신규/등록 버튼', '실행', '저장 없이 폼/패널 진입 확인 및 캡처'],
    ['수정/삭제 가능 여부', '본문 데이터 행 액션 버튼 + API CRUD 저장 검증', '실행', '본문 행 버튼 수와 CRUD API 결과를 함께 기록'],
    ['중복 방어', '기준정보 API CRUD DUPLICATE_GUARD', '실행', '동일 키 두 번째 POST의 400/409 방어 응답 연결'],
    ['저장 검증', '기준정보 API CRUD 런타임 스위트', '실행', `관련 모듈 ${pageResult.crudModules.join(', ')} 단계 연결`],
    ['DB/API 확인', '직접 API + Oracle count', '실행', `${pageResult.tables.join(', ')} 대표 count 확인`],
    ['화면 재조회', '검색 초기화 + 조회 후 캡처', '실행', '검색 필터가 남지 않은 기준 화면 증적 저장'],
  ];
  return `<!doctype html>
<html lang="ko">
<head><meta charset="utf-8"><title>${escapeHtml(pageResult.title)} 페이지 상세 시나리오 QA</title><style>${styles()}</style></head>
<body>
  <header>
    <h1>${escapeHtml(pageResult.title)} 페이지 상세 시나리오 QA</h1>
    <div>대상: <code>${escapeHtml(baseUrl)}${escapeHtml(pageResult.route)}</code> / API CRUD stamp: <code>${escapeHtml(crudEvidence.stamp)}</code> / 최종 결과: <span class="pass">${escapeHtml(pageResult.status)}</span></div>
  </header>
  <main>
    <section class="card">
      <h2>요약</h2>
      <div class="metrics">
        <div class="metric"><strong>${pageResult.steps.length}</strong>실행 단계</div>
        <div class="metric"><strong>${pageResult.apiEvents.length}</strong>기록 API 호출</div>
        <div class="metric"><strong>${pageResult.steps.reduce((sum, item) => sum + item.dbChecks.length, 0)}</strong>DB 검증</div>
        <div class="metric"><strong>${pageResult.steps.filter((item) => item.evidence).length}</strong>화면 증적</div>
      </div>
      <p>조회, 검색/조회, 신규/수정/삭제 가능 여부, 중복 방어, 저장 검증, DB/API 확인, 화면 재조회 절차를 페이지 단위로 실행했습니다. 저장성 검증은 기준정보 API CRUD 런타임 스위트 결과와 연결했습니다.</p>
    </section>
    <section class="card">
      <h2>화면 기능 목록</h2>
      <table><thead><tr><th>기능/버튼</th><th>처리 방식</th><th>상태</th><th>비고</th></tr></thead><tbody>${featureRows.map((row) => `<tr><td>${escapeHtml(row[0])}</td><td>${escapeHtml(row[1])}</td><td class="${row[2] === '실행' ? 'pass' : 'warn'}">${escapeHtml(row[2])}</td><td>${escapeHtml(row[3])}</td></tr>`).join('')}</tbody></table>
    </section>
    <section class="card toc">
      <h2>시나리오 목차</h2>
      <ol>${pageResult.steps.map((item, index) => `<li><a href="#${escapeHtml(item.id)}">STEP ${String(index + 1).padStart(2, '0')} ${escapeHtml(item.title)}</a></li>`).join('')}</ol>
    </section>
    ${pageResult.steps.map(stepHtml).join('\n')}
  </main>
</body>
</html>`;
}

function renderIndex(results) {
  const all = [
    ...completedPages.map((page) => ({ ...page, status: 'PASS' })),
    ...results.map((result) => ({ title: result.title, route: result.route, file: result.reportFile, scenario: '조회 → 검색/조회 → 신규/수정/삭제 가능 여부 → 중복 방어 → 저장 검증 → DB/API 확인 → 화면 재조회', status: result.status })),
  ];
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
    .warn { color: #b45309; font-weight: 700; }
    code { background: #edf2f7; border-radius: 4px; padding: 2px 5px; }
  </style>
</head>
<body>
  <header>
    <h1>HANES 페이지 단위 시나리오 QA 목차</h1>
    <div>실행일: <code>${escapeHtml(reportDate)}</code> / 기준정보 완료: <code>${all.length}</code>개</div>
  </header>
  <main>
    <section class="card">
      <table>
        <thead><tr><th>페이지</th><th>경로</th><th>시나리오</th><th>결과</th><th>보고서</th></tr></thead>
        <tbody>${all.map((page) => `
          <tr>
            <td>${escapeHtml(page.title)}</td>
            <td><code>${escapeHtml(page.route)}</code></td>
            <td>${escapeHtml(page.scenario)}</td>
            <td class="${page.status === 'PASS' ? 'pass' : 'warn'}">${escapeHtml(page.status)}</td>
            <td><a href="${escapeHtml(page.file)}">상세 보고서 열기</a></td>
          </tr>`).join('')}
        </tbody>
      </table>
    </section>
  </main>
</body>
</html>`;
}

async function main() {
  await fs.mkdir(pageDir, { recursive: true });
  await fs.mkdir(shotRoot, { recursive: true });

  const health = await fetch(`${apiUrl}/health`, { headers: headers() });
  if (!health.ok) throw new Error(`backend health failed: ${health.status}`);

  const crud = runCrudSuite();
  const residueSql = crudDbResidueSql(crud.evidence);
  const crudResidue = dbQuery(residueSql);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1500, height: 1000 }, locale: 'ko-KR', timezoneId: 'Asia/Seoul' });
  const setup = await context.newPage();
  await injectAuth(setup);
  await setup.close();

  const results = [];
  for (const pageInfo of activePages) {
    const result = await testPage(context, pageInfo, crud.evidence);
    results.push(result);
    await fs.writeFile(path.join(pageDir, `${pageInfo.slug}.html`), renderPageReport(result, crud.evidence), 'utf8');
    console.log(`${result.status} ${pageInfo.route} ${pageInfo.title}`);
  }

  await browser.close();

  const failed = results.filter((result) => result.status !== 'PASS');
  const residueOk = crudResidue.success === true && (crudResidue.data ?? []).every((row) => Number(row.CNT) === 0);
  const status = failed.length === 0 && (crud.summary.failures ?? 0) === 0 && residueOk ? 'PASS' : 'CHECK';
  await fs.writeFile(indexPath, renderIndex(results), 'utf8');
  await fs.writeFile(resultPath, JSON.stringify({
    status,
    baseUrl,
    apiUrl,
    oracleSite,
    reportRoot,
    indexPath,
    crudSummary: crud.summary,
    crudResultPath: crud.summary.out,
    crudResidue,
    pages: results,
  }, null, 2), 'utf8');

  console.log(JSON.stringify({
    status,
    pages: results.length,
    passed: results.filter((result) => result.status === 'PASS').length,
    failed: failed.length,
    crudFailures: crud.summary.failures,
    indexPath,
    resultPath,
    crudResultPath: crud.summary.out,
  }, null, 2));

  if (status !== 'PASS') process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
