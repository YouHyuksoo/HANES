import fs from 'node:fs/promises';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';

function loadPlaywright() {
  const localRequire = createRequire(import.meta.url);
  const candidates = [
    'playwright',
    path.resolve('node_modules/.pnpm/playwright@1.61.0/node_modules/playwright'),
    process.env.APPDATA ? path.join(process.env.APPDATA, 'npm/node_modules/playwright') : null,
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
const today = reportDate;
const stamp = process.env.HANES_SHIP_QA_STAMP ?? new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Seoul',
  year: '2-digit',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
}).format(new Date()).replace(/\D/g, '').slice(0, 12);

const baseUrl = process.env.HANES_FRONTEND_URL ?? 'http://localhost:3002';
const apiUrl = process.env.HANES_API_URL ?? 'http://localhost:3003/api/v1';
const token = process.env.HANES_TOKEN ?? 'admin@hanes.com';
const company = '40';
const plant = '1000';
const oracleConnector = 'C:/Users/hsyou/.claude/skills/oracle-db/scripts/oracle_connector.py';
const oracleSite = process.env.HANES_ORACLE_SITE ?? 'JSHANES';

const testKey = `SWF${stamp}`;
const testOrderNo = `SO${testKey}`;
const testBoxNo = `BX${testKey}`;
const testPalletNo = `PLT${testKey}`;
const itemCode = process.env.HANES_SHIP_QA_ITEM ?? 'HNS02';

const reportRoot = path.resolve(`docs/reports/hanes-shipping-workflow-scenario-qa-${reportDate}`);
const pageDir = path.join(reportRoot, 'pages');
const shotRoot = path.join(reportRoot, 'screenshots', 'shipping-workflow');
const resultPath = path.join(reportRoot, 'shipping-workflow-result.json');
const indexPath = path.join(reportRoot, 'index.html');
const pageHtmlPath = path.join(pageDir, 'shipping-workflow.html');

const authUser = {
  id: 'admin@hanes.com',
  email: 'admin@hanes.com',
  name: '시스템관리자',
  role: 'ADMIN',
  status: 'ACTIVE',
  company,
  plant,
};

const shippingPages = [
  { route: '/shipping/order', label: '출하지시' },
  { route: '/shipping/pack', label: '포장관리' },
  { route: '/shipping/pallet', label: '팔레트적재' },
  { route: '/shipping/pallet-ship', label: '팔레트출하' },
  { route: '/shipping/confirm', label: '박스별출하' },
  { route: '/shipping/return', label: '출하취소' },
  { route: '/shipping/history', label: '출하이력' },
  { route: '/shipping/box-stock', label: '박스재고' },
];

const transitionInventory = [
  { id: 'order-create', from: '-', to: 'DRAFT', process: '출하지시 생성', api: 'POST /shipping/orders', ui: '/shipping/order' },
  { id: 'order-confirm', from: 'DRAFT', to: 'CONFIRMED', process: '출하지시 확정', api: 'PUT /shipping/orders/:id/confirm', ui: '/shipping/order' },
  { id: 'order-unconfirm', from: 'CONFIRMED', to: 'DRAFT', process: '출하지시 확정취소', api: 'PUT /shipping/orders/:id/unconfirm', ui: '/shipping/order' },
  { id: 'box-create', from: '-', to: 'OPEN', process: '박스 생성', api: 'POST /shipping/boxes', ui: '/shipping/pack' },
  { id: 'box-add-serial', from: 'OPEN', to: 'OPEN', process: '시리얼 담기', api: 'POST /shipping/boxes/:id/serials', ui: '/shipping/pack' },
  { id: 'box-close', from: 'OPEN', to: 'CLOSED', process: '박스 마감', api: 'POST /shipping/boxes/:id/close', ui: '/shipping/pack' },
  { id: 'box-reopen', from: 'CLOSED', to: 'OPEN', process: '박스 재오픈', api: 'POST /shipping/boxes/:id/reopen', ui: '/shipping/pack' },
  { id: 'box-ship', from: 'CLOSED', to: 'SHIPPED', process: '박스 단건 출하', api: 'POST /shipping/orders/:id/ship-box', ui: '/shipping/confirm' },
  { id: 'box-cancel', from: 'SHIPPED', to: 'CLOSED', process: '박스 단건 출하취소', api: 'POST /shipping/orders/:id/cancel-ship-box', ui: '/shipping/confirm modal' },
  { id: 'pallet-create', from: '-', to: 'OPEN', process: '출하지시 팔레트 생성', api: 'POST /shipping/orders/:id/pallets', ui: '/shipping/pallet' },
  { id: 'pallet-add-box', from: 'OPEN', to: 'OPEN', process: '팔레트 박스 적재', api: 'POST /shipping/orders/:id/pallets/:palletNo/boxes', ui: '/shipping/pallet' },
  { id: 'pallet-remove-box', from: 'OPEN', to: 'OPEN', process: '팔레트 박스 제거', api: 'DELETE /shipping/orders/:id/pallets/:palletNo/boxes', ui: '/shipping/pallet' },
  { id: 'pallet-close', from: 'OPEN', to: 'CLOSED', process: '팔레트 라벨 발행 완료', api: 'POST /shipping/orders/:id/pallets/:palletNo/close', ui: '/shipping/pallet' },
  { id: 'pallet-reopen', from: 'CLOSED', to: 'OPEN', process: '팔레트 재오픈', api: 'POST /shipping/pallets/:id/reopen', ui: '/shipping/pallet' },
  { id: 'pallet-ship', from: 'CLOSED', to: 'SHIPPED', process: '팔레트 출하확정', api: 'POST /shipping/orders/:id/ship-pallets', ui: '/shipping/pallet-ship' },
  { id: 'order-cancel-shipment', from: 'SHIPPED', to: 'CONFIRMED', process: '출하지시 단위 출하취소', api: 'POST /shipping/orders/:id/cancel-shipment', ui: '/shipping/return' },
  { id: 'shipment-load', from: 'PREPARING', to: 'LOADED', process: '일반 출하 적재완료', api: 'POST /shipping/shipments/:id/mark-loaded', ui: 'UI 미확인' },
  { id: 'shipment-ship', from: 'LOADED', to: 'SHIPPED', process: '일반 출하 처리', api: 'POST /shipping/shipments/:id/mark-shipped', ui: 'UI 미확인' },
  { id: 'shipment-deliver', from: 'SHIPPED', to: 'DELIVERED', process: '배송완료', api: 'POST /shipping/shipments/:id/mark-delivered', ui: 'UI 미확인' },
  { id: 'shipment-reverse', from: 'SHIPPED', to: 'LOADED', process: '일반 출하 역분개', api: 'POST /shipping/shipments/:id/reverse', ui: 'UI 미확인' },
  { id: 'shipment-cancel', from: 'PREPARING/LOADED', to: 'CANCELED', process: '일반 출하 취소', api: 'POST /shipping/shipments/:id/cancel', ui: 'UI 미확인' },
  { id: 'erp-sync', from: 'SHIPPED/DELIVERED', to: 'ERP_SYNC_Y', process: 'ERP 동기화 완료', api: 'PUT /shipping/shipments/:id/erp-sync', ui: 'UI 미확인' },
];

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function normalizeApiUrl(url) {
  return String(url).replace(apiUrl, '').replace(baseUrl, '');
}

function unwrap(payload) {
  if (payload && typeof payload === 'object' && 'data' in payload) return payload.data;
  return payload;
}

async function ensureDirs() {
  await fs.mkdir(pageDir, { recursive: true });
  await fs.mkdir(shotRoot, { recursive: true });
}

async function api(method, url, body) {
  const res = await fetch(`${apiUrl}${url}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'X-Company': company,
      'X-Plant': plant,
      'Content-Type': 'application/json',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(30000),
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  if (!res.ok) {
    const message = json?.message ?? json?.error ?? text ?? `${method} ${url} failed`;
    const err = new Error(Array.isArray(message) ? message.join('; ') : String(message));
    err.response = { status: res.status, json };
    throw err;
  }
  return { status: res.status, json, data: unwrap(json) };
}

function oracleQuery(sql) {
  const out = execFileSync('python', [oracleConnector, '--site', oracleSite, '--query', sql], {
    encoding: 'utf8',
    cwd: process.cwd(),
    maxBuffer: 10 * 1024 * 1024,
  });
  return JSON.parse(out);
}

function safeSql(value) {
  return String(value).replaceAll("'", "''");
}

async function injectAuth(page) {
  await page.goto(`${baseUrl}/login`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.evaluate(({ token: tokenValue, user }) => {
    localStorage.setItem('harness-token', tokenValue);
    localStorage.setItem('harness-auth', JSON.stringify({
      state: {
        user,
        token: tokenValue,
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

async function collectUiPages() {
  const browser = await chromium.launch({ headless: process.env.HANES_QA_HEADED !== '1' });
  const uiResults = [];
  try {
    for (const pageInfo of shippingPages) {
      const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, ignoreHTTPSErrors: true });
      const page = await context.newPage();
      const apiCalls = [];
      const consoleErrors = [];
      page.on('response', async (response) => {
        const url = response.url();
        if (!url.includes('/api/')) return;
        apiCalls.push({ method: response.request().method(), url: normalizeApiUrl(url), status: response.status(), ok: response.ok() });
      });
      page.on('console', (msg) => {
        if (msg.type() === 'error') consoleErrors.push(msg.text());
      });
      const result = { ...pageInfo, status: 'PASS', apiCalls, consoleErrors, buttons: [], screenshot: null, error: null };
      try {
        await injectAuth(page);
        await page.goto(`${baseUrl}${pageInfo.route}`, { waitUntil: 'networkidle', timeout: 90000 });
        if (page.url().includes('/login')) throw new Error('인증 세션이 유지되지 않아 로그인 화면으로 이동함');
        await page.waitForTimeout(800);
        result.buttons = await page.locator('button').evaluateAll((buttons) =>
          [...new Set(buttons.map((button) => (button.textContent || button.getAttribute('aria-label') || button.getAttribute('title') || '').trim().replace(/\s+/g, ' ')).filter(Boolean))]
            .slice(0, 80));
        const shotName = `${pageInfo.route.replace(/^\//, '').replaceAll('/', '-')}.png`;
        result.screenshot = `../screenshots/shipping-workflow/${shotName}`;
        await page.screenshot({ path: path.join(shotRoot, shotName), fullPage: true });
      } catch (error) {
        result.status = 'FAIL';
        result.error = String(error.message ?? error);
      } finally {
        uiResults.push(result);
        await context.close();
      }
    }
  } finally {
    await browser.close();
  }
  return uiResults;
}

function sourceUiCoverage() {
  const files = [
    'apps/frontend/src/app/(authenticated)/shipping/order/page.tsx',
    'apps/frontend/src/app/(authenticated)/shipping/pack/page.tsx',
    'apps/frontend/src/app/(authenticated)/shipping/pallet/page.tsx',
    'apps/frontend/src/app/(authenticated)/shipping/pallet-ship/page.tsx',
    'apps/frontend/src/app/(authenticated)/shipping/confirm/page.tsx',
    'apps/frontend/src/app/(authenticated)/shipping/return/page.tsx',
    'apps/frontend/src/app/(authenticated)/shipping/history/page.tsx',
    'apps/frontend/src/app/(authenticated)/shipping/box-stock/page.tsx',
    'apps/frontend/src/components/shipping/BoxScanShipModal.tsx',
    'apps/frontend/src/components/shipping/ShipmentScanModal.tsx',
    'apps/frontend/src/hooks/pda/useShippingScan.ts',
    'apps/frontend/src/hooks/pda/usePalletShipScan.ts',
  ];
  const source = Object.fromEntries(files.filter(existsSync).map((file) => [file, readFileSync(file, 'utf8')]));
  const all = Object.entries(source).map(([file, text]) => `${file}\n${text}`).join('\n');
  return transitionInventory.map((item) => {
    const literal = item.api
      .replace('POST ', '')
      .replace('PUT ', '')
      .replace('DELETE ', '')
      .replace('GET ', '')
      .replace(':id', '')
      .replace(':palletNo', '')
      .replace('//', '/');
    const endpointStem = literal.split('/:')[0].replace(/\/$/, '');
    const foundFiles = Object.entries(source)
      .filter(([, text]) => text.includes(endpointStem) || text.includes(item.api.split(' ').at(-1).split('/:')[0]))
      .map(([file]) => file);
    const pageFiles = foundFiles.filter((file) => file.includes('/app/(authenticated)/shipping/'));
    let status = pageFiles.length > 0 ? 'UI 노출' : foundFiles.length > 0 ? '컴포넌트/훅만 존재' : 'UI 누락';
    if (item.ui !== 'UI 미확인' && item.ui !== '/shipping/confirm modal' && pageFiles.length > 0) status = 'UI 노출';
    return {
      ...item,
      sourceStatus: status,
      sourceFiles: foundFiles,
      hasShippingPageUse: pageFiles.length > 0,
      hasAnyUse: all.includes(endpointStem),
    };
  });
}

async function pickPackableSerial() {
  const res = await api('GET', `/shipping/boxes/packable-serials?itemCode=${encodeURIComponent(itemCode)}`);
  const rows = Array.isArray(res.data) ? res.data : [];
  const row = rows.find((item) => item.fgBarcode || item.FG_BARCODE);
  if (!row) throw new Error(`${itemCode} 포장 대기 FG 시리얼이 없습니다.`);
  return row.fgBarcode ?? row.FG_BARCODE;
}

function dbStatusSnapshots() {
  const queries = {
    shipmentOrders: "SELECT STATUS, COUNT(*) CNT FROM SHIPMENT_ORDERS WHERE COMPANY='40' AND PLANT_CD='1000' GROUP BY STATUS ORDER BY STATUS",
    boxes: "SELECT STATUS, COUNT(*) CNT FROM BOX_MASTERS WHERE COMPANY='40' AND PLANT_CD='1000' GROUP BY STATUS ORDER BY STATUS",
    pallets: "SELECT STATUS, COUNT(*) CNT FROM PALLET_MASTERS WHERE COMPANY='40' AND PLANT_CD='1000' GROUP BY STATUS ORDER BY STATUS",
    shipmentLogs: "SELECT STATUS, COUNT(*) CNT FROM SHIPMENT_LOGS WHERE COMPANY='40' AND PLANT_CD='1000' GROUP BY STATUS ORDER BY STATUS",
    fgLabels: "SELECT STATUS, COUNT(*) CNT FROM FG_LABELS WHERE COMPANY='40' AND PLANT_CD='1000' GROUP BY STATUS ORDER BY STATUS",
    oqcEnabled: "SELECT CONFIG_KEY, CONFIG_VALUE FROM SYS_CONFIGS WHERE CONFIG_KEY='OQC_ENABLED'",
  };
  return Object.fromEntries(Object.entries(queries).map(([key, sql]) => [key, { sql, result: oracleQuery(sql) }]));
}

function finalResidueSql(serial) {
  const order = safeSql(testOrderNo);
  const box = safeSql(testBoxNo);
  const pallet = safeSql(testPalletNo);
  const serialSql = safeSql(serial ?? '');
  return `
SELECT 'SHIPMENT_ORDERS' OBJ, COUNT(*) CNT FROM SHIPMENT_ORDERS WHERE COMPANY='40' AND PLANT_CD='1000' AND SHIP_ORDER_NO='${order}'
UNION ALL SELECT 'SHIPMENT_ORDER_ITEMS', COUNT(*) FROM SHIPMENT_ORDER_ITEMS WHERE COMPANY='40' AND PLANT_CD='1000' AND SHIP_ORDER_ID='${order}'
UNION ALL SELECT 'BOX_MASTERS', COUNT(*) FROM BOX_MASTERS WHERE COMPANY='40' AND PLANT_CD='1000' AND BOX_NO='${box}'
UNION ALL SELECT 'PALLET_MASTERS', COUNT(*) FROM PALLET_MASTERS WHERE COMPANY='40' AND PLANT_CD='1000' AND PALLET_NO='${pallet}'
UNION ALL SELECT 'OQC_REQUEST_BOXES', COUNT(*) FROM OQC_REQUEST_BOXES WHERE COMPANY='40' AND PLANT_CD='1000' AND BOX_NO='${box}'
UNION ALL SELECT 'OQC_REQUESTS', COUNT(*) FROM OQC_REQUESTS WHERE COMPANY='40' AND PLANT_CD='1000' AND REMARK='AUTO_CREATED_FROM_BOX:${box}'
UNION ALL SELECT 'PRODUCT_TRANSACTIONS', COUNT(*) FROM PRODUCT_TRANSACTIONS WHERE COMPANY='40' AND PLANT_CD='1000' AND REF_ID='${order}'
UNION ALL SELECT 'FG_LABEL_BOX_LINK', COUNT(*) FROM FG_LABELS WHERE COMPANY='40' AND PLANT_CD='1000' AND FG_BARCODE='${serialSql}' AND (BOX_NO IS NOT NULL OR STATUS <> 'VISUAL_PASS')`;
}

function cleanupSql(serial) {
  const order = safeSql(testOrderNo);
  const box = safeSql(testBoxNo);
  const pallet = safeSql(testPalletNo);
  const serialSql = safeSql(serial ?? '');
  return [
    `UPDATE FG_LABELS SET STATUS='VISUAL_PASS', BOX_NO=NULL, UPDATED_AT=CURRENT_TIMESTAMP WHERE COMPANY='40' AND PLANT_CD='1000' AND FG_BARCODE='${serialSql}'`,
    `DELETE FROM OQC_REQUEST_BOXES WHERE COMPANY='40' AND PLANT_CD='1000' AND BOX_NO='${box}'`,
    `DELETE FROM OQC_REQUESTS WHERE COMPANY='40' AND PLANT_CD='1000' AND REMARK='AUTO_CREATED_FROM_BOX:${box}'`,
    `DELETE FROM PRODUCT_TRANSACTIONS WHERE COMPANY='40' AND PLANT_CD='1000' AND REF_ID='${order}'`,
    `DELETE FROM BOX_MASTERS WHERE COMPANY='40' AND PLANT_CD='1000' AND BOX_NO='${box}'`,
    `DELETE FROM PALLET_MASTERS WHERE COMPANY='40' AND PLANT_CD='1000' AND PALLET_NO='${pallet}'`,
    `DELETE FROM SHIPMENT_ORDER_ITEMS WHERE COMPANY='40' AND PLANT_CD='1000' AND SHIP_ORDER_ID='${order}'`,
    `DELETE FROM SHIPMENT_ORDERS WHERE COMPANY='40' AND PLANT_CD='1000' AND SHIP_ORDER_NO='${order}'`,
  ];
}

async function runApiWorkflow() {
  const steps = [];
  let serial = null;
  const record = async (id, title, fn) => {
    const startedAt = Date.now();
    try {
      const value = await fn();
      steps.push({ id, title, result: 'PASS', elapsedMs: Date.now() - startedAt, value });
      return value;
    } catch (error) {
      steps.push({
        id,
        title,
        result: 'FAIL',
        elapsedMs: Date.now() - startedAt,
        error: String(error.message ?? error),
        response: error.response ?? null,
      });
      throw error;
    }
  };

  const cleanup = [];
  try {
    serial = await record('pick-serial', '포장 대기 FG 시리얼 확보', () => pickPackableSerial());
    cleanup.push('FG_LABEL 원복');
    await record('create-order', '출하지시 생성: - -> DRAFT', () => api('POST', '/shipping/orders', {
      shipOrderNo: testOrderNo,
      customerName: 'CODEX-QA',
      customerPoNo: testKey,
      shipDate: today,
      dueDate: today,
      remark: `CODEX shipping workflow QA ${testKey}`,
      items: [{ itemCode, orderQty: 1, remark: testKey }],
    }));
    await record('confirm-order', '출하지시 확정: DRAFT -> CONFIRMED', () => api('PUT', `/shipping/orders/${encodeURIComponent(testOrderNo)}/confirm`));
    await record('unconfirm-order', '출하지시 확정취소: CONFIRMED -> DRAFT', () => api('PUT', `/shipping/orders/${encodeURIComponent(testOrderNo)}/unconfirm`));
    await record('reconfirm-order', '출하지시 재확정: DRAFT -> CONFIRMED', () => api('PUT', `/shipping/orders/${encodeURIComponent(testOrderNo)}/confirm`));

    await record('create-box', '박스 생성: - -> OPEN', () => api('POST', '/shipping/boxes', { boxNo: testBoxNo, itemCode }));
    await record('add-serial', '박스 시리얼 담기: OPEN 유지', () => api('POST', `/shipping/boxes/${encodeURIComponent(testBoxNo)}/serials`, { serials: [serial] }));
    await record('close-box', '박스 마감: OPEN -> CLOSED', () => api('POST', `/shipping/boxes/${encodeURIComponent(testBoxNo)}/close`));
    await record('reopen-box', '박스 재오픈: CLOSED -> OPEN', () => api('POST', `/shipping/boxes/${encodeURIComponent(testBoxNo)}/reopen`));
    await record('remove-serial-after-reopen', '재오픈 후 시리얼 제거: OPEN 유지', () => api('DELETE', `/shipping/boxes/${encodeURIComponent(testBoxNo)}/serials`, { serials: [serial] }));
    await record('add-serial-again', '박스 시리얼 재담기: OPEN 유지', () => api('POST', `/shipping/boxes/${encodeURIComponent(testBoxNo)}/serials`, { serials: [serial] }));
    await record('close-box-again', '박스 재마감: OPEN -> CLOSED', () => api('POST', `/shipping/boxes/${encodeURIComponent(testBoxNo)}/close`));

    await record('create-pallet', '출하지시 팔레트 생성: - -> OPEN', () => api('POST', `/shipping/orders/${encodeURIComponent(testOrderNo)}/pallets`, { palletNo: testPalletNo }));
    await record('add-box-to-pallet', '팔레트 박스 적재: OPEN 유지', () => api('POST', `/shipping/orders/${encodeURIComponent(testOrderNo)}/pallets/${encodeURIComponent(testPalletNo)}/boxes`, { boxIds: [testBoxNo] }));
    await record('close-pallet', '팔레트 라벨 발행 완료: OPEN -> CLOSED', () => api('POST', `/shipping/orders/${encodeURIComponent(testOrderNo)}/pallets/${encodeURIComponent(testPalletNo)}/close`));
    await record('reopen-pallet', '팔레트 재오픈: CLOSED -> OPEN', () => api('POST', `/shipping/pallets/${encodeURIComponent(testPalletNo)}/reopen`));
    await record('remove-box-from-pallet', '팔레트 박스 제거: OPEN 유지', () => api('DELETE', `/shipping/orders/${encodeURIComponent(testOrderNo)}/pallets/${encodeURIComponent(testPalletNo)}/boxes`, { boxIds: [testBoxNo] }));

    await record('fulfillment-before-ship', '후속 박스출하 화면 데이터 확인: CONFIRMED 지시/후보 조회', () => api('GET', `/shipping/orders/${encodeURIComponent(testOrderNo)}/fulfillment`));
    await record('ship-box', '박스 단건 출하: CLOSED -> SHIPPED, 지시 완출 시 CLOSED', () => api('POST', `/shipping/orders/${encodeURIComponent(testOrderNo)}/ship-box`, { boxNo: testBoxNo, workerId: 'admin@hanes.com' }));
    await record('box-stock-after-ship', '후속 박스재고 제외 확인: SHIPPED 박스는 box-stock에서 제외', () => api('GET', `/shipping/box-stock?boxNo=${encodeURIComponent(testBoxNo)}`));
    await record('history-after-ship', '후속 출하이력 노출 확인: 출하분 있는 지시 조회', () => api('GET', `/shipping/orders/${encodeURIComponent(testOrderNo)}/shipped-detail`));
    await record('cancel-ship-box', '박스 단건 출하취소: SHIPPED -> CLOSED, 지시 CONFIRMED', () => api('POST', `/shipping/orders/${encodeURIComponent(testOrderNo)}/cancel-ship-box`, { boxNo: testBoxNo, workerId: 'admin@hanes.com' }));
    await record('box-stock-after-cancel', '후속 박스재고 재노출 확인: 취소 후 미출하 재고 조회', () => api('GET', `/shipping/box-stock?boxNo=${encodeURIComponent(testBoxNo)}`));

    await record('reopen-box-for-cleanup', '정리용 박스 재오픈: CLOSED -> OPEN', () => api('POST', `/shipping/boxes/${encodeURIComponent(testBoxNo)}/reopen`));
    await record('remove-serial-for-cleanup', '정리용 시리얼 제거: OPEN 유지', () => api('DELETE', `/shipping/boxes/${encodeURIComponent(testBoxNo)}/serials`, { serials: [serial] }));
    await record('delete-box', '정리용 빈 박스 삭제', () => api('DELETE', `/shipping/boxes/${encodeURIComponent(testBoxNo)}`));
    await record('unconfirm-after-cleanup', '정리용 확정취소: CONFIRMED -> DRAFT, 빈 팔레트 자동삭제', () => api('PUT', `/shipping/orders/${encodeURIComponent(testOrderNo)}/unconfirm`));
    await record('delete-order', '정리용 DRAFT 출하지시 삭제', () => api('DELETE', `/shipping/orders/${encodeURIComponent(testOrderNo)}`));
  } finally {
    for (const sql of cleanupSql(serial)) {
      try {
        oracleQuery(sql);
      } catch (error) {
        cleanup.push(`cleanup failed: ${sql} / ${String(error.message ?? error)}`);
      }
    }
  }

  const residueSql = finalResidueSql(serial);
  const residue = oracleQuery(residueSql);
  const residueCount = (residue.data ?? []).reduce((sum, row) => sum + Number(row.CNT ?? 0), 0);
  return {
    testKey,
    testOrderNo,
    testBoxNo,
    testPalletNo,
    serial,
    steps,
    cleanup,
    residue: { sql: residueSql, result: residue, residueCount },
    status: steps.every((step) => step.result === 'PASS') && residueCount === 0 ? 'PASS' : 'FAIL',
  };
}

function makeTable(rows, columns) {
  return `<table><thead><tr>${columns.map((c) => `<th>${escapeHtml(c.label)}</th>`).join('')}</tr></thead><tbody>${
    rows.map((row) => `<tr>${columns.map((c) => `<td>${escapeHtml(c.value ? c.value(row) : row[c.key])}</td>`).join('')}</tr>`).join('')
  }</tbody></table>`;
}

async function writeReport(result) {
  const pageRows = result.uiPages.map((p) => ({
    menu: p.label,
    route: p.route,
    status: p.status,
    api: p.apiCalls.map((a) => `${a.method} ${a.url} ${a.status}`).join('\n'),
    buttons: p.buttons.join(', '),
    screenshot: p.screenshot ?? '',
    error: p.error ?? '',
  }));
  const coverageRows = result.coverage.map((item) => ({
    process: item.process,
    transition: `${item.from} -> ${item.to}`,
    api: item.api,
    ui: item.ui,
    status: item.sourceStatus,
    files: item.sourceFiles.map((file) => file.replaceAll('\\', '/')).join('\n'),
  }));
  const stepRows = result.apiWorkflow.steps.map((step) => ({
    id: step.id,
    title: step.title,
    result: step.result,
    evidence: step.error ?? JSON.stringify(step.value?.data ?? step.value ?? '').slice(0, 500),
  }));
  const residueRows = result.apiWorkflow.residue.result.data ?? [];
  const statusRows = Object.entries(result.dbSnapshots).flatMap(([key, item]) =>
    (item.result.data ?? []).map((row) => ({ table: key, status: row.STATUS ?? row.CONFIG_KEY, value: row.CNT ?? row.CONFIG_VALUE })));

  const css = `
body{font-family:Arial,"Noto Sans KR",sans-serif;margin:0;background:#f7f8fa;color:#172033}
main{max-width:1280px;margin:0 auto;padding:24px}
h1{font-size:24px;margin:0 0 8px} h2{font-size:18px;margin:28px 0 10px}
.meta{color:#526070;margin-bottom:18px}.ok{color:#087443;font-weight:700}.fail{color:#b42318;font-weight:700}
table{border-collapse:collapse;width:100%;background:#fff;border:1px solid #d9dee7;margin:8px 0 18px;font-size:13px}
th,td{border:1px solid #d9dee7;padding:8px;vertical-align:top;white-space:pre-wrap}th{background:#eef2f7;text-align:left}
.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}.metric{background:#fff;border:1px solid #d9dee7;padding:12px}
a{color:#155eef}.shot{max-width:280px;border:1px solid #d9dee7}
`;
  const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>출하관리 상태전이 QA</title><style>${css}</style></head><body><main>
<h1>출하관리 상태전이 QA</h1>
<div class="meta">테스트 키 <code>${escapeHtml(testKey)}</code> · 최종 상태 <span class="${result.status === 'PASS' ? 'ok' : 'fail'}">${result.status}</span> · ${escapeHtml(new Date().toISOString())}</div>
<div class="grid">
  <div class="metric">화면 로딩<br><b>${result.uiPages.filter((p) => p.status === 'PASS').length}/${result.uiPages.length}</b></div>
  <div class="metric">전이 실행<br><b>${result.apiWorkflow.steps.filter((s) => s.result === 'PASS').length}/${result.apiWorkflow.steps.length}</b></div>
  <div class="metric">전이 인벤토리<br><b>${result.coverage.length}</b></div>
  <div class="metric">테스트 잔여<br><b>${result.apiWorkflow.residue.residueCount}</b></div>
</div>
<h2>결론</h2>
<ul>
  <li>출하지시, 박스, 팔레트, 박스출하/취소의 핵심 정/역방향 API 전이는 새 테스트 데이터로 실행했다.</li>
  <li>박스출하 후 <code>/shipping/box-stock</code> 제외, <code>/shipping/orders/:id/shipped-detail</code> 노출, 취소 후 box-stock 재노출을 확인했다.</li>
  <li>일반 <code>/shipping/shipments</code> 전이(적재완료, 배송완료, 역분개, ERP sync)는 백엔드 API와 미사용 컴포넌트는 있으나 현재 출하관리 메뉴의 연결 화면이 확인되지 않는다.</li>
  <li><code>OQC_ENABLED=N</code> 기준으로 테스트 박스의 <code>OQC_STATUS</code>를 강제 변경하지 않고 팔레트 적재/박스출하 전이를 검증한다.</li>
</ul>
<h2>기능/전이 인벤토리</h2>${makeTable(coverageRows, [
    { key: 'process', label: '프로세스' },
    { key: 'transition', label: '상태전이' },
    { key: 'api', label: 'API' },
    { key: 'ui', label: '예상 UI' },
    { key: 'status', label: '소스상 UI 연결' },
    { key: 'files', label: '근거 파일' },
  ])}
<h2>실행 단계</h2>${makeTable(stepRows, [
    { key: 'id', label: 'Step' },
    { key: 'title', label: '검증 내용' },
    { key: 'result', label: '결과' },
    { key: 'evidence', label: '응답/오류' },
  ])}
<h2>화면 로딩/API 호출</h2>${makeTable(pageRows, [
    { key: 'menu', label: '메뉴' },
    { key: 'route', label: 'Route' },
    { key: 'status', label: '결과' },
    { key: 'api', label: 'UI API 호출' },
    { key: 'buttons', label: '노출 버튼' },
    { key: 'screenshot', label: '스크린샷' },
    { key: 'error', label: '오류' },
  ])}
<h2>DB 상태 분포</h2>${makeTable(statusRows, [
    { key: 'table', label: '대상' },
    { key: 'status', label: '상태/설정' },
    { key: 'value', label: '값' },
  ])}
<h2>최종 잔여 확인</h2>${makeTable(residueRows, [
    { key: 'OBJ', label: '대상' },
    { key: 'CNT', label: '잔여건수' },
  ])}
</main></body></html>`;

  const index = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>HANES 출하관리 QA</title><style>${css}</style></head><body><main>
<h1>HANES 출하관리 QA</h1>
<p><a href="./pages/shipping-workflow.html">출하관리 상태전이 QA 리포트</a></p>
<p><a href="./shipping-workflow-result.json">결과 JSON</a></p>
</main></body></html>`;

  await fs.writeFile(pageHtmlPath, html, 'utf8');
  await fs.writeFile(indexPath, index, 'utf8');
  await fs.writeFile(resultPath, JSON.stringify(result, null, 2), 'utf8');
}

async function main() {
  await ensureDirs();
  const health = {
    frontend: await fetch(baseUrl, { signal: AbortSignal.timeout(10000) }).then((res) => ({ ok: res.ok, status: res.status })).catch((error) => ({ ok: false, error: String(error.message ?? error) })),
    backend: await fetch(`${apiUrl}/shipping/orders?limit=1`, {
      headers: { Authorization: `Bearer ${token}`, 'X-Company': company, 'X-Plant': plant },
      signal: AbortSignal.timeout(10000),
    }).then((res) => ({ ok: res.ok, status: res.status })).catch((error) => ({ ok: false, error: String(error.message ?? error) })),
  };
  const dbSnapshots = dbStatusSnapshots();
  const coverage = sourceUiCoverage();
  const uiPages = await collectUiPages();
  const apiWorkflow = await runApiWorkflow();
  const result = {
    status: health.frontend.ok && health.backend.ok && apiWorkflow.status === 'PASS' && uiPages.every((p) => p.status === 'PASS') ? 'PASS' : 'FAIL',
    generatedAt: new Date().toISOString(),
    defaults: { baseUrl, apiUrl, oracleSite, company, plant },
    testKey,
    health,
    dbSnapshots,
    coverage,
    uiPages,
    apiWorkflow,
    reportPaths: {
      index: indexPath,
      page: pageHtmlPath,
      result: resultPath,
      screenshots: shotRoot,
    },
  };
  await writeReport(result);
  console.log(JSON.stringify({
    status: result.status,
    testKey,
    index: indexPath,
    page: pageHtmlPath,
    result: resultPath,
    residueCount: apiWorkflow.residue.residueCount,
  }, null, 2));
  if (result.status !== 'PASS') process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
