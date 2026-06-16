import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
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
const reportRoot = path.resolve(`docs/reports/hanes-material-menu-scenario-qa-${reportDate}`);
const pageDir = path.join(reportRoot, 'pages');
const shotRoot = path.join(reportRoot, 'screenshots');
const indexPath = path.join(reportRoot, 'index.html');
const resultPath = path.join(reportRoot, 'material-menu-result.json');

const user = {
  id: 'admin@hanes.com',
  email: 'admin@hanes.com',
  name: '시스템관리자',
  role: 'ADMIN',
  status: 'ACTIVE',
  company: '40',
  plant: '1000',
};

const staticMenuMap = {
  PUR_PO: {
    slug: 'material-po',
    route: '/material/po',
    title: 'PO관리',
    api: '/material/purchase-orders?limit=20',
    tables: ['PURCHASE_ORDERS', 'PURCHASE_ORDER_ITEMS'],
    processPattern: [/PO 등록/, /추가/, /신규/],
  },
  PUR_PO_STATUS: {
    slug: 'material-po-status',
    route: '/material/po-status',
    title: 'PO현황조회',
    api: '/material/po-status?limit=20',
    tables: ['PURCHASE_ORDERS', 'PURCHASE_ORDER_ITEMS'],
    processPattern: [/조회/, /검색/],
  },
  MAT_ARRIVAL: {
    slug: 'material-arrival',
    route: '/material/arrival',
    title: '입하관리',
    api: '/material/arrivals?limit=20',
    tables: ['MAT_ARRIVALS', 'PURCHASE_ORDERS', 'PURCHASE_ORDER_ITEMS'],
    processPattern: [/PO 입하/, /수동 입하/, /입하 등록/, /등록/],
  },
  MAT_ARRIVAL_RESULT: {
    slug: 'material-arrival-result',
    route: '/material/arrival-result',
    title: '입하실적조회',
    api: '/material/arrivals/results?limit=20',
    tables: ['MAT_ARRIVALS'],
    processPattern: [/조회/, /검색/],
  },
  MAT_ARRIVAL_TRANSACTION: {
    slug: 'material-arrival-transaction',
    route: '/material/arrival-transaction',
    title: '입하수불조회',
    api: '/material/arrivals?limit=20',
    tables: ['MAT_ARRIVAL_TRANSACTIONS', 'MAT_ARRIVAL_STOCKS'],
    processPattern: [/조회/, /검색/],
  },
  QC_CONCESSION: {
    slug: 'material-concession',
    route: '/material/concession',
    title: '특채처리',
    api: '/material/concession/targets',
    tables: ['IQC_LOGS', 'MAT_ARRIVALS'],
    processPattern: [/특채/, /처리/],
  },
  MAT_RECEIVE: {
    slug: 'material-receive',
    route: '/material/receive',
    title: '자재입고관리',
    api: '/material/receiving/receivable',
    tables: ['MAT_RECEIVINGS', 'MAT_STOCKS', 'MAT_LOTS', 'STOCK_TRANSACTIONS'],
    processPattern: [/입고/, /스캔/, /등록/],
  },
  MAT_RECEIVE_HISTORY: {
    slug: 'material-receive-history',
    route: '/material/receive-history',
    title: '입고이력조회',
    api: '/material/receiving?limit=20',
    tables: ['MAT_RECEIVINGS', 'STOCK_TRANSACTIONS'],
    processPattern: [/조회/, /검색/],
  },
  MAT_REQUEST: {
    slug: 'material-request',
    route: '/material/request',
    title: '출고요청관리',
    api: '/material/issue-requests?limit=20',
    tables: ['MAT_ISSUE_REQUESTS', 'MAT_ISSUE_REQUEST_ITEMS'],
    processPattern: [/출고요청/, /요청 등록/, /신규/, /등록/],
  },
  MAT_ISSUE: {
    slug: 'material-issue',
    route: '/material/issue',
    title: '자재출고관리',
    api: '/material/issues?limit=20',
    tables: ['MAT_ISSUES', 'MAT_ISSUE_REQUESTS', 'MAT_STOCKS', 'STOCK_TRANSACTIONS'],
    processPattern: [/출고/, /스캔/, /처리/],
  },
  MAT_ISSUE_OTHER: {
    slug: 'material-issue-other',
    route: '/material/issue-other',
    title: '기타출고관리',
    api: '/material/issues?issueType=OTHER&limit=20',
    tables: ['MAT_ISSUES', 'MAT_STOCKS', 'STOCK_TRANSACTIONS'],
    processPattern: [/기타출고/, /출고/, /스캔/, /처리/],
  },
  MAT_LOT_SPLIT: {
    slug: 'material-lot-split',
    route: '/material/lot-split',
    title: '자재분할관리',
    api: '/material/lot-split?limit=20',
    tables: ['MAT_LOTS', 'MAT_STOCKS', 'STOCK_TRANSACTIONS'],
    processPattern: [/분할/, /스캔/, /처리/],
  },
  MAT_LOT_MERGE: {
    slug: 'material-lot-merge',
    route: '/material/lot-merge',
    title: '자재병합관리',
    api: '/material/lot-merge?limit=20',
    tables: ['MAT_LOTS', 'MAT_STOCKS', 'STOCK_TRANSACTIONS'],
    processPattern: [/병합/, /스캔/, /처리/],
  },
  MAT_SCRAP: {
    slug: 'material-scrap',
    route: '/material/scrap',
    title: '자재폐기처리',
    api: '/material/scrap?limit=20',
    tables: ['STOCK_TRANSACTIONS', 'MAT_STOCKS', 'MAT_LOTS'],
    processPattern: [/폐기/, /등록/],
  },
  MAT_ADJUSTMENT: {
    slug: 'material-adjustment',
    route: '/material/adjustment',
    title: '재고보정처리',
    api: '/material/adjustment?limit=20',
    tables: ['INV_ADJ_LOGS', 'MAT_STOCKS', 'STOCK_TRANSACTIONS'],
    processPattern: [/보정/, /등록/],
  },
  MAT_MISC_RECEIPT: {
    slug: 'material-misc-receipt',
    route: '/material/misc-receipt',
    title: '기타입고관리',
    api: '/material/misc-receipt?limit=20',
    tables: ['STOCK_TRANSACTIONS', 'MAT_STOCKS', 'MAT_LOTS'],
    processPattern: [/기타입고/, /입고/, /등록/],
  },
  MAT_RECEIPT_CANCEL: {
    slug: 'material-receipt-cancel',
    route: '/material/receipt-cancel',
    title: '자재입고취소',
    api: '/material/receipt-cancel?limit=20',
    tables: ['STOCK_TRANSACTIONS', 'MAT_STOCKS'],
    processPattern: [/입고취소/, /취소/],
  },
  INV_MAT_STOCK: {
    slug: 'inventory-material-stock',
    route: '/inventory/material-stock',
    title: '자재재고현황',
    api: '/material/stocks?limit=20',
    tables: ['MAT_STOCKS', 'MAT_LOTS'],
    processPattern: [/조회/, /검색/],
  },
  INV_TRANSACTION: {
    slug: 'inventory-transaction',
    route: '/inventory/transaction',
    title: '재고수불현황',
    api: '/inventory/transactions?limit=20',
    tables: ['STOCK_TRANSACTIONS'],
    processPattern: [/조회/, /검색/],
  },
  INV_MAT_PHYSICAL_INV: {
    slug: 'inventory-material-physical-inv',
    route: '/inventory/material-physical-inv',
    title: '자재재고실사',
    api: '/material/physical-inv?limit=20',
    tables: ['PHYSICAL_INV_SESSIONS', 'PHYSICAL_INV_COUNT_DETAILS'],
    processPattern: [/조회/, /검색/, /실사/],
  },
  INV_MAT_PHYSICAL_INV_APPLY: {
    slug: 'inventory-material-physical-inv-apply',
    route: '/inventory/material-physical-inv-apply',
    title: '자재재고실사반영',
    api: '/material/physical-inv?limit=20',
    tables: ['PHYSICAL_INV_SESSIONS', 'PHYSICAL_INV_COUNT_DETAILS', 'STOCK_TRANSACTIONS'],
    processPattern: [/조회/, /검색/, /반영/],
  },
  INV_MAT_PHYSICAL_INV_HISTORY: {
    slug: 'inventory-material-physical-inv-history',
    route: '/inventory/material-physical-inv-history',
    title: '자재재고실사이력',
    api: '/material/physical-inv/history?limit=20',
    tables: ['PHYSICAL_INV_SESSIONS', 'PHYSICAL_INV_COUNT_DETAILS'],
    processPattern: [/조회/, /검색/],
  },
  INV_ARRIVAL_STOCK: {
    slug: 'material-arrival-stock',
    route: '/material/arrival-stock',
    title: '입하재고현황',
    api: '/material/arrivals/stock-status?limit=20',
    tables: ['MAT_ARRIVAL_STOCKS', 'MAT_ARRIVAL_TRANSACTIONS'],
    processPattern: [/조회/, /검색/],
  },
  MAT_HOLD: {
    slug: 'material-hold',
    route: '/material/hold',
    title: '재고홀드',
    api: '/material/hold?limit=20',
    tables: ['MAT_LOTS', 'MAT_STOCKS'],
    processPattern: [/조회/, /검색/, /홀드/, /해제/],
  },
};

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

function authHeaders() {
  return {
    Authorization: `Bearer ${token}`,
    'X-Company': '40',
    'X-Plant': '1000',
    'Content-Type': 'application/json',
  };
}

async function directApi(method, urlPath, apiEvents) {
  const fullUrl = urlPath.startsWith('http') ? urlPath : `${apiUrl}${urlPath}`;
  const res = await fetch(fullUrl, {
    method,
    headers: authHeaders(),
    signal: AbortSignal.timeout(20000),
  });
  const text = await res.text();
  let preview = text.slice(0, 800);
  try {
    const json = text ? JSON.parse(text) : null;
    preview = JSON.stringify(json?.data ?? json).slice(0, 800);
  } catch {
    // Keep the raw preview.
  }
  const event = {
    source: 'direct-api',
    stepId: current.stepId,
    method,
    url: fullUrl.replace(apiUrl, '/api/v1'),
    status: res.status,
    ok: res.status >= 200 && res.status < 400,
    responsePreview: preview,
  };
  apiEvents.push(event);
  return event;
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

function countSql(tableName) {
  return `SELECT COUNT(*) AS CNT FROM ${tableName} WHERE ROWNUM <= 100000000`;
}

function dbCountCheck(tableName) {
  const sql = countSql(tableName);
  try {
    const result = dbQuery(sql);
    return { title: `${tableName} 대표 count`, sql, result, ok: result.success === true };
  } catch (err) {
    return { title: `${tableName} 대표 count`, sql, result: { error: err.message }, ok: false };
  }
}

async function apiGet(urlPath) {
  const res = await fetch(`${apiUrl}${urlPath}`, {
    headers: authHeaders(),
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`GET ${urlPath} failed: ${res.status}`);
  return res.json();
}

async function discoverMaterialMenus() {
  const tree = await apiGet('/menu-categories/tree');
  const categories = Array.isArray(tree) ? tree : tree.data ?? [];
  const category = categories.find((item) => item.categoryCode === 'MATERIAL' && item.isActive !== 'N');
  if (!category) throw new Error('MATERIAL menu category not found in /menu-categories/tree');
  const menus = [...(category.menus ?? [])]
    .filter((menu) => menu.isActive !== 'N')
    .sort((a, b) => Number(a.sortOrder ?? 0) - Number(b.sortOrder ?? 0))
    .map((menu) => {
      const page = staticMenuMap[menu.menuCode];
      if (!page) return { menuCode: menu.menuCode, missing: true, sortOrder: menu.sortOrder };
      return {
        ...page,
        menuCode: menu.menuCode,
        sortOrder: menu.sortOrder,
        labelKey: menu.labelKey ?? page.labelKey,
        registeredAt: {
          categoryCode: category.categoryCode,
          categoryLabelKey: category.labelKey,
          sortOrder: menu.sortOrder,
        },
      };
    });
  const missing = menus.filter((menu) => menu.missing);
  if (missing.length > 0) throw new Error(`No route mapping for registered menu code(s): ${missing.map((m) => m.menuCode).join(', ')}`);
  return { category, pages: menus };
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
    await target.screenshot({ path: fullPath, timeout: 25000 });
  } else {
    await page.screenshot({ path: fullPath, fullPage: false, timeout: 25000 });
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
      await locator.click({ timeout: 10000 });
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
      await button.click({ timeout: 6000 }).catch(() => {});
      await page.waitForTimeout(500);
      return true;
    }
  }
  await page.keyboard.press('Escape').catch(() => {});
  await page.waitForTimeout(500);
  return false;
}

async function collectButtons(page) {
  return workArea(page).getByRole('button').evaluateAll((buttons) =>
    buttons
      .filter((button) => {
        const rect = button.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0 && !button.disabled;
      })
      .map((button) => (button.innerText || button.getAttribute('title') || button.getAttribute('aria-label') || '').trim())
      .filter(Boolean)
      .slice(0, 60),
  ).catch(() => []);
}

async function collectInputs(page) {
  return workArea(page).locator('input, select, textarea').evaluateAll((inputs) =>
    inputs
      .filter((input) => {
        const rect = input.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      })
      .map((input) => ({
        tag: input.tagName.toLowerCase(),
        type: input.getAttribute('type') || '',
        placeholder: input.getAttribute('placeholder') || '',
        aria: input.getAttribute('aria-label') || '',
        value: input.value || '',
      }))
      .slice(0, 40),
  ).catch(() => []);
}

async function exerciseTabs(page) {
  const names = [];
  const root = workArea(page);
  const tabs = root.getByRole('tab');
  const count = Math.min(await tabs.count().catch(() => 0), 8);
  for (let index = 0; index < count; index += 1) {
    const tab = tabs.nth(index);
    if (!(await tab.isVisible().catch(() => false))) continue;
    const name = (await tab.innerText().catch(() => `tab-${index}`)).trim();
    await tab.click({ timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(700);
    names.push(name || `tab-${index}`);
  }
  return names;
}

async function deriveSearchTerm(page) {
  const root = workArea(page);
  const candidates = await root.locator('tbody td, [role="gridcell"], table td').evaluateAll((cells) =>
    cells
      .map((cell) => (cell.innerText || cell.textContent || '').replace(/\s+/g, ' ').trim())
      .filter((text) => text.length >= 2 && text.length <= 40)
      .filter((text) => /[0-9A-Za-z가-힣]/.test(text))
      .filter((text) => !/^(수정|삭제|관리|사용|미사용|Y|N|-|PASS|FAIL)$/.test(text))
      .filter((text) => !/데이터가 없습니다|조회된 데이터|No data/i.test(text))
      .slice(0, 30),
  ).catch(() => []);
  return candidates.find((text) => !/^HNS02/i.test(text)) ?? candidates[0] ?? '';
}

async function exerciseSearch(page) {
  const root = workArea(page);
  const input = root.locator([
    'input[placeholder*="검색"]',
    'input[aria-label*="검색"]',
    'input[placeholder*="search" i]',
    'input[type="search"]',
  ].join(',')).first();
  const term = await deriveSearchTerm(page);
  let filled = false;
  if (await input.isVisible().catch(() => false)) {
    await input.fill(term ?? '').catch(() => {});
    await page.keyboard.press('Enter').catch(() => {});
    filled = true;
  }
  const clicked = await clickFirst(root, [/검색/, /조회/]).catch(() => null);
  await page.waitForLoadState('networkidle', { timeout: 6000 }).catch(() => {});
  await page.waitForTimeout(900);
  if (filled && term) return `검색어 '${term}' 입력 후 조회/Enter 실행`;
  if (filled) return '검색어 공백 상태로 조회/Enter 실행';
  if (clicked) return `검색 입력 없이 ${clicked} 실행`;
  return '검색 입력 또는 조회 버튼 미노출';
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
  await page.waitForLoadState('networkidle', { timeout: 6000 }).catch(() => {});
  await page.waitForTimeout(900);
  if (reset && refresh) return `검색 조건 초기화 후 ${refresh} 실행`;
  if (reset) return '검색 조건 초기화 후 Enter 실행';
  if (refresh) return `검색 입력 없이 ${refresh} 실행`;
  return '검색/조회 컨트롤 없음, 현재 화면 기준 재확인';
}

async function countVisibleBodyRowButtons(page) {
  return workArea(page).locator('tbody tr button, [role="row"] button').evaluateAll((buttons) =>
    buttons.filter((button) => {
      const rect = button.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    }).length,
  ).catch(() => 0);
}

async function visibleRowCount(page) {
  return workArea(page).locator('tbody tr, [role="row"]').evaluateAll((rows) =>
    rows.filter((row) => {
      const rect = row.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    }).length,
  ).catch(() => 0);
}

function isExpectedHttpFailure(event) {
  return event.status === 401 && event.url.includes('/auth/me');
}

async function testPage(context, pageInfo) {
  const page = await context.newPage();
  page.setDefaultTimeout(14000);
  page.setDefaultNavigationTimeout(120000);
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
    const failedApi = relatedApi.filter((event) => !event.ok && !isExpectedHttpFailure(event));
    const failedDb = (result?.dbChecks ?? []).filter((check) => check.ok === false);
    steps.push({
      id,
      title,
      objective,
      actions,
      result: failedApi.length === 0 && failedDb.length === 0 ? 'PASS' : 'CHECK',
      apiCalls: relatedApi,
      dbChecks: result?.dbChecks ?? [],
      evidence: result?.evidence ?? null,
      notes: result?.notes ?? [],
    });
  }

  await addStep('initial-load', '초기 조회', `${pageInfo.title} 화면 진입과 초기 조회 API 로딩을 확인합니다.`, [
    `브라우저로 ${pageInfo.route} 경로에 진입한다.`,
    '업무 영역 렌더링과 초기 API 응답을 수집한다.',
    '대표 Oracle 테이블 count를 확인한다.',
  ], async () => {
    await page.goto(`${baseUrl}${pageInfo.route}`, { waitUntil: 'commit', timeout: 120000 });
    await page.waitForLoadState('domcontentloaded', { timeout: 60000 }).catch(() => {});
    await page.waitForLoadState('networkidle', { timeout: 12000 }).catch(() => {});
    await page.waitForTimeout(1000);
    const text = await page.locator('body').innerText().catch(() => '');
    if (page.url().includes('/login')) throw new Error(`${pageInfo.route} redirected to login`);
    if (/Application error|Unhandled Runtime Error|서버에 연결할 수 없습니다/.test(text)) {
      throw new Error(`${pageInfo.route} rendered error text`);
    }
    return {
      evidence: await capture(page, pageInfo, 1, 'initial-load', '초기 조회 화면'),
      dbChecks: pageInfo.tables.map(dbCountCheck),
      notes: [
        `좌측 메뉴 등록 코드: ${pageInfo.menuCode}`,
        `등록 순서: ${pageInfo.sortOrder}`,
        `화면 행 수: ${await visibleRowCount(page)}`,
      ],
    };
  });

  await addStep('search-requery', '검색 및 재조회', `${pageInfo.title} 화면의 검색, 조회, 탭 전환 동작을 확인합니다.`, [
    '탭이 있으면 노출 탭을 순서대로 전환한다.',
    '검색 입력이 있으면 현재 화면에서 추출한 값으로 검색/Enter 또는 조회를 실행한다.',
    '실행 후 화면과 API 호출을 수집한다.',
  ], async () => {
    const tabNames = await exerciseTabs(page);
    const searchNote = await exerciseSearch(page);
    return {
      evidence: await capture(page, pageInfo, 2, 'search-requery', '검색/조회/탭 전환 후 화면'),
      notes: [
        tabNames.length ? `탭 전환: ${tabNames.join(', ')}` : '탭 없음 또는 전환 대상 없음',
        searchNote,
        `검색 후 화면 행 수: ${await visibleRowCount(page)}`,
      ],
    };
  });

  await addStep('button-process-inventory', '버튼 및 프로세스 목록화', `${pageInfo.title} 화면의 버튼과 입력/프로세스 진입점을 수집합니다.`, [
    '검색 조건을 초기화하고 기준 목록 상태로 되돌린다.',
    '업무 영역의 노출 버튼 텍스트/title/aria-label을 수집한다.',
    '입력 컨트롤의 placeholder/aria/type을 수집한다.',
  ], async () => {
    const resetNote = await resetSearchAndRefresh(page);
    const buttons = await collectButtons(page);
    const inputs = await collectInputs(page);
    return {
      evidence: await capture(page, pageInfo, 3, 'button-process-inventory', '검색 초기화 후 버튼 및 프로세스 목록 화면'),
      notes: [
        resetNote,
        `노출 버튼: ${buttons.join(', ') || '텍스트 버튼 없음'}`,
        `입력 컨트롤: ${inputs.map((input) => input.placeholder || input.aria || input.type || input.tag).filter(Boolean).join(', ') || '수집 대상 없음'}`,
      ],
    };
  });

  await addStep('action-availability', '신규/수정/삭제 가능 여부', `${pageInfo.title} 화면의 저장성 프로세스 진입과 행 액션 노출 여부를 확인합니다.`, [
    '화면별 대표 신규/처리/등록 버튼이 있으면 저장 없이 진입까지만 실행한다.',
    '진입 화면을 캡처하고 닫기/취소/Escape로 원복한다.',
    '그리드 행의 수정/삭제/처리류 액션 버튼 수를 확인한다.',
  ], async () => {
    const rowButtons = await countVisibleBodyRowButtons(page);
    const buttons = await collectButtons(page);
    const clicked = await clickFirst(workArea(page), pageInfo.processPattern).catch(() => null);
    let evidence;
    if (clicked) {
      await page.waitForLoadState('networkidle', { timeout: 6000 }).catch(() => {});
      await page.waitForTimeout(900);
      evidence = await capture(page, pageInfo, 4, 'action-entry', '저장성 프로세스 진입 화면', true);
      await closeDialogOrPanel(page);
    } else {
      evidence = await capture(page, pageInfo, 4, 'action-availability', '저장성 프로세스 버튼 미노출 화면');
    }
    return {
      evidence,
      notes: [
        clicked ? `프로세스 진입 실행: ${clicked}` : '신규/처리/등록 진입 버튼 미노출 또는 조회 전용 화면',
        `본문 행 액션 버튼 수: ${rowButtons}`,
        `저장성 후보 버튼: ${buttons.filter((name) => /등록|저장|추가|삭제|수정|취소|입고|출고|분할|병합|폐기|보정|특채|승인|반려/.test(name)).join(', ') || '없음'}`,
      ],
    };
  });

  await addStep('save-validation-policy', '저장 검증 및 중복 방어 정책', `${pageInfo.title} 화면의 저장성 처리 경계와 중복 방어 검증 방식을 기록합니다.`, [
    '운영 재고를 변경하는 저장/삭제 버튼은 이 공통 메뉴 스윕에서 임의 실행하지 않는다.',
    '저장성 후보 버튼과 API 경계를 목록화한다.',
    '중복 방어는 실제 저장형 페이지별 데이터 생성 시나리오에서 동일 키/동일 LOT 재처리로 검증하도록 분리한다.',
  ], async () => {
    const resetNote = await resetSearchAndRefresh(page);
    const buttons = await collectButtons(page);
    const direct = await directApi('GET', pageInfo.api, apiEvents);
    return {
      evidence: await capture(page, pageInfo, 5, 'save-validation-policy', '저장 검증 정책 확인 기준 화면'),
      notes: [
        resetNote,
        direct.ok ? `대표 조회 API 직접 호출 성공: ${direct.url} ${direct.status}` : `대표 조회 API 확인 필요: ${direct.url} ${direct.status}`,
        `중복 방어 공통 시나리오: 동일 LOT/동일 PO/동일 요청번호 재처리 방어는 페이지별 저장형 상세 시나리오에서 수행`,
        `저장성 후보 버튼: ${buttons.filter((name) => /등록|저장|추가|삭제|수정|취소|입고|출고|분할|병합|폐기|보정|특채|승인|반려/.test(name)).join(', ') || '없음'}`,
      ],
    };
  });

  await addStep('api-db-screen-requery', 'DB/API 확인 및 화면 재조회', `${pageInfo.title} 대표 API와 Oracle 테이블 상태를 확인한 뒤 화면을 재조회합니다.`, [
    `대표 API ${pageInfo.api}를 직접 호출한다.`,
    '관련 Oracle 대표 테이블 count를 재확인한다.',
    '검색 조건을 초기화하고 화면을 재조회한 뒤 최종 증적을 캡처한다.',
  ], async () => {
    const direct = await directApi('GET', pageInfo.api, apiEvents);
    const resetNote = await resetSearchAndRefresh(page);
    if (!direct.ok) throw new Error(`${pageInfo.title} direct API failed: ${direct.status} ${direct.url}`);
    return {
      evidence: await capture(page, pageInfo, 6, 'api-db-screen-requery', 'DB/API 확인 후 최종 재조회 화면'),
      dbChecks: pageInfo.tables.map(dbCountCheck),
      notes: [
        resetNote,
        `대표 조회 API 응답: ${direct.status}`,
        `최종 화면 행 수: ${await visibleRowCount(page)}`,
      ],
    };
  });

  await page.close().catch(() => {});
  const unexpectedConsole = consoleErrors.filter((event) => !/Failed to load resource: the server responded with a status of 401/.test(event.text));
  const unexpectedApi = apiEvents.filter((event) => !event.ok && !isExpectedHttpFailure(event));
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
                <td class="${event.ok || isExpectedHttpFailure(event) ? 'pass' : 'warn'}">${escapeHtml(event.status)}</td>
              </tr>`).join('');
}

function dbRows(checks) {
  return checks.map((check) => `
              <tr>
                <td>${escapeHtml(check.title)}</td>
                <td><code>${escapeHtml(check.sql)}</code></td>
                <td class="${check.ok === false ? 'warn' : ''}"><pre>${escapeHtml(JSON.stringify(check.result?.data ?? check.result, null, 2))}</pre></td>
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

function renderPageReport(pageResult) {
  const featureRows = [
    ['좌측 메뉴 등록', `/menu-categories/tree MATERIAL/${pageResult.menuCode}`, '실행', `등록 순서 ${pageResult.sortOrder}; 실제 등록 메뉴 기준`],
    ['초기 조회', pageResult.api, '실행', '브라우저 초기 로드, UI network API, 대표 DB count 확인'],
    ['검색/재조회', '검색 입력, 조회/새로고침, 탭 전환', '실행', '화면에 있는 컨트롤 기준으로 실제 클릭/입력 수행'],
    ['신규/수정/삭제 가능 여부', '대표 프로세스 진입 + 행 액션 수집', '실행', '저장 없이 진입 가능 여부와 후보 버튼 목록화'],
    ['저장 검증', '직접 저장 미실행', '별도 시나리오 대상', '운영 재고 변경이 필요한 저장형 업무는 페이지별 안전 데이터 시나리오에서 수행'],
    ['중복 방어', '동일 LOT/PO/요청번호 재처리 방어', '별도 시나리오 대상', '공통 스윕에서는 방어 정책과 버튼/API 경계를 기록'],
    ['DB/API 확인', '직접 API + Oracle count', '실행', `${pageResult.tables.join(', ')} 대표 count 확인`],
    ['화면 재조회', '검색 초기화 + 조회 후 캡처', '실행', '검색 필터가 남지 않은 최종 화면 증적 저장'],
  ];
  return `<!doctype html>
<html lang="ko">
<head><meta charset="utf-8"><title>${escapeHtml(pageResult.title)} 페이지 상세 시나리오 QA</title><style>${styles()}</style></head>
<body>
  <header>
    <h1>${escapeHtml(pageResult.title)} 페이지 상세 시나리오 QA</h1>
    <div>대상: <code>${escapeHtml(baseUrl)}${escapeHtml(pageResult.route)}</code> / 메뉴코드: <code>${escapeHtml(pageResult.menuCode)}</code> / 최종 결과: <span class="${pageResult.status === 'PASS' ? 'pass' : 'warn'}">${escapeHtml(pageResult.status)}</span></div>
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
      <p>실제 좌측 메뉴 등록 기준으로 조회, 검색/재조회, 신규/수정/삭제 가능 여부, 저장 검증 정책, 중복 방어 정책, DB/API 확인, 화면 재조회 절차를 실행했습니다.</p>
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

function renderIndex(results, category) {
  return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <title>자재수불관리 등록 메뉴 상세 시나리오 QA 목차</title>
  <style>
    body { margin: 0; font-family: Arial, "Malgun Gothic", sans-serif; background: #f5f7fb; color: #111827; }
    header { background: #172033; color: #fff; padding: 28px 34px; }
    main { padding: 24px 34px 48px; }
    .card { background: #fff; border: 1px solid #d6deeb; border-radius: 8px; padding: 16px; margin-bottom: 16px; }
    a { color: #1d4ed8; text-decoration: none; font-weight: 700; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border-bottom: 1px solid #e1e6ef; padding: 9px 10px; text-align: left; vertical-align: top; }
    th { background: #f8fafc; }
    .pass { color: #047857; font-weight: 700; }
    .warn { color: #b45309; font-weight: 700; }
    code { background: #edf2f7; border-radius: 4px; padding: 2px 5px; }
  </style>
</head>
<body>
  <header>
    <h1>자재수불관리 등록 메뉴 상세 시나리오 QA 목차</h1>
    <div>실행일: <code>${escapeHtml(reportDate)}</code> / 카테고리: <code>${escapeHtml(category.categoryCode)}</code> / 실제 등록 하위 메뉴: <code>${results.length}</code>개</div>
  </header>
  <main>
    <section class="card">
      <p>이 보고서는 <code>/api/v1/menu-categories/tree</code>에서 <code>MATERIAL</code> 카테고리에 등록된 하위 메뉴만 대상으로 생성했습니다. 정적 메뉴에는 있으나 실제 좌측 메뉴에 등록되지 않은 화면은 제외했습니다.</p>
    </section>
    <section class="card">
      <table>
        <thead><tr><th>순서</th><th>메뉴코드</th><th>페이지</th><th>경로</th><th>시나리오</th><th>결과</th><th>보고서</th></tr></thead>
        <tbody>${results.map((page) => `
          <tr>
            <td>${escapeHtml(page.sortOrder)}</td>
            <td><code>${escapeHtml(page.menuCode)}</code></td>
            <td>${escapeHtml(page.title)}</td>
            <td><code>${escapeHtml(page.route)}</code></td>
            <td>조회 → 검색/재조회 → 버튼/프로세스 목록화 → 신규/수정/삭제 가능 여부 → 저장/중복 방어 정책 → DB/API 확인 → 화면 재조회</td>
            <td class="${page.status === 'PASS' ? 'pass' : 'warn'}">${escapeHtml(page.status)}</td>
            <td><a href="${escapeHtml(page.reportFile)}">상세 보고서 열기</a></td>
          </tr>`).join('')}
        </tbody>
      </table>
    </section>
  </main>
</body>
</html>`;
}

function validateReports(results) {
  const missing = [];
  for (const result of results) {
    const pagePath = path.join(reportRoot, result.reportFile);
    if (!existsSync(pagePath)) missing.push(pagePath);
    for (const step of result.steps) {
      if (!step.evidence) continue;
      const shot = path.resolve(pageDir, step.evidence.file);
      if (!existsSync(shot)) missing.push(shot);
    }
  }
  if (!existsSync(indexPath)) missing.push(indexPath);
  if (missing.length) throw new Error(`missing report artifact(s): ${missing.join(', ')}`);
}

async function writeAggregate(category, pages, results) {
  await fs.writeFile(indexPath, renderIndex(results, category), 'utf8');
  validateReports(results);
  const failed = results.filter((result) => result.status !== 'PASS');
  const status = failed.length === 0 ? 'PASS' : 'CHECK';
  await fs.writeFile(resultPath, JSON.stringify({
    status,
    baseUrl,
    apiUrl,
    oracleSite,
    reportRoot,
    indexPath,
    resultPath,
    menuSource: {
      api: '/menu-categories/tree',
      categoryCode: category.categoryCode,
      categoryLabelKey: category.labelKey,
      registeredMenuCodes: pages.map((page) => page.menuCode),
      excludedStaticMaterialCodes: Object.keys(staticMenuMap).filter((code) => !pages.some((page) => page.menuCode === code)),
    },
    pages: results,
  }, null, 2), 'utf8');
  return { status, failed };
}

async function aggregateExisting(category, pages) {
  const results = [];
  const missing = [];
  for (const pageInfo of pages) {
    const pageResultPath = path.join(pageDir, `${pageInfo.slug}.json`);
    if (!existsSync(pageResultPath)) {
      missing.push(pageResultPath);
      continue;
    }
    results.push(JSON.parse(await fs.readFile(pageResultPath, 'utf8')));
  }
  if (missing.length) throw new Error(`missing page result JSON(s): ${missing.join(', ')}`);
  const aggregate = await writeAggregate(category, pages, results);
  console.log(JSON.stringify({
    status: aggregate.status,
    source: '/menu-categories/tree MATERIAL',
    pages: results.length,
    passed: results.filter((result) => result.status === 'PASS').length,
    failed: aggregate.failed.length,
    indexPath,
    resultPath,
  }, null, 2));
  if (aggregate.status !== 'PASS') process.exitCode = 1;
}

async function main() {
  const targetOnly = process.env.HANES_QA_ONLY;
  const aggregateMode = process.env.HANES_QA_AGGREGATE === '1';
  if (!targetOnly && !aggregateMode) {
    await fs.rm(reportRoot, { recursive: true, force: true });
  }
  await fs.mkdir(pageDir, { recursive: true });
  await fs.mkdir(shotRoot, { recursive: true });

  const health = await fetch(`${apiUrl}/health`, { headers: authHeaders(), signal: AbortSignal.timeout(10000) });
  if (!health.ok) throw new Error(`backend health failed: ${health.status}`);

  const { category, pages } = await discoverMaterialMenus();
  if (aggregateMode) {
    await aggregateExisting(category, pages);
    return;
  }
  const activePages = targetOnly ? pages.filter((page) => page.slug === targetOnly || page.route === targetOnly || page.menuCode === targetOnly) : pages;
  if (targetOnly && activePages.length === 0) throw new Error(`unknown HANES_QA_ONLY: ${targetOnly}`);

  const browser = await chromium.launch({ headless: true });

  const results = [];
  try {
    for (const pageInfo of activePages) {
      const context = await browser.newContext({ viewport: { width: 1500, height: 1000 }, locale: 'ko-KR', timezoneId: 'Asia/Seoul' });
      try {
        const setup = await context.newPage();
        await injectAuth(setup);
        await setup.close();
        const result = await testPage(context, pageInfo);
        results.push(result);
        await fs.writeFile(path.join(pageDir, `${pageInfo.slug}.html`), renderPageReport(result), 'utf8');
        await fs.writeFile(path.join(pageDir, `${pageInfo.slug}.json`), JSON.stringify(result, null, 2), 'utf8');
        console.log(`${result.status} ${pageInfo.menuCode} ${pageInfo.route} ${pageInfo.title}`);
      } finally {
        await context.close().catch(() => {});
      }
    }
  } finally {
    await browser.close().catch(() => {});
  }

  const aggregate = await writeAggregate(category, pages, results);

  console.log(JSON.stringify({
    status: aggregate.status,
    source: '/menu-categories/tree MATERIAL',
    pages: results.length,
    passed: results.filter((result) => result.status === 'PASS').length,
    failed: aggregate.failed.length,
    indexPath,
    resultPath,
  }, null, 2));

  if (aggregate.status !== 'PASS') process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
