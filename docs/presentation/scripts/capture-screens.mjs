// 소개자료(presentation) 화면 캡처 러너
// help-manual-export 러너의 캡처 방식을 차용한다:
//  - addInitScript로 페이지 스크립트 실행 전 인증(harness-token/harness-auth, 시스템관리자/40·1000) 주입
//  - 실제 메뉴트리(hanes-menu-tree)에서 code→path 해석(없으면 target.path 폴백)
//  - domcontentloaded → networkidle → 추가 대기 후 캡처
//  - 1600x900(16:9) 뷰포트로 슬라이드 임베드에 맞춤
// 기존 빈/깨진 캡처(빈 DB·렌더 실패)를 실 데이터가 있는 dev 서버에서 전량 재생성한다.
//
// 사용법(프로젝트 루트, dev 서버 3002 가동 중):
//   node docs/presentation/scripts/capture-screens.mjs            # 전체
//   node docs/presentation/scripts/capture-screens.mjs new        # 신규 슬라이드 화면만
//   node docs/presentation/scripts/capture-screens.mjs MAT_RECEIVE,QC_AQL   # 특정 코드만

import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';

function loadPlaywright() {
  const localRequire = createRequire(import.meta.url);
  try { return localRequire('playwright'); }
  catch {
    const appData = process.env.APPDATA;
    if (!appData) throw new Error('playwright module not found and APPDATA is not set');
    const globalRequire = createRequire(path.join(appData, 'npm/node_modules/playwright/package.json'));
    return globalRequire('playwright');
  }
}
const { chromium } = loadPlaywright();

const baseUrl = process.env.HANES_FRONTEND_URL ?? 'http://localhost:3002';
const token = process.env.HANES_TOKEN ?? 'admin@hanes.com';
const VIEWPORT = { width: 1600, height: 900 };
const BLANK_BYTES = 18000; // 이보다 작으면 빈 화면 의심으로 표시

const repoRoot = process.cwd();
const assetsDir = path.join(repoRoot, 'docs/presentation/assets');
const manifestOut = path.join(assetsDir, 'menu-captures/capture-manifest.json');

const user = {
  id: 'admin@hanes.com', email: 'admin@hanes.com', name: '시스템관리자',
  empNo: null, dept: null, role: 'ADMIN', status: 'ACTIVE', company: '40', plant: '1000',
};

// 캡처 대상. file은 assets 디렉터리 기준 상대경로(HTML 참조와 동일하게 유지).
const TARGETS = [
  // ── 기존 menu-captures 재생성 ──
  { code: 'DASHBOARD', path: '/dashboard', file: 'menu-captures/01-dashboard-dashboard.png', group: 'menu' },
  { code: 'WORKFLOW', path: '/workflow', file: 'menu-captures/02-workflow-workflow.png', group: 'menu' },
  { code: 'MST_PART', path: '/master/part', file: 'menu-captures/03-master-mst_part.png', group: 'menu' },
  { code: 'MST_BOM', path: '/master/bom', file: 'menu-captures/04-master-mst_bom.png', group: 'menu' },
  { code: 'MST_PARTNER', path: '/master/partner', file: 'menu-captures/05-master-mst_partner.png', group: 'menu' },
  { code: 'EQUIP_MASTER', path: '/master/equip', file: 'menu-captures/06-master-equip_master.png', group: 'menu' },
  { code: 'MST_PROCESS', path: '/master/process', file: 'menu-captures/07-master-mst_process.png', group: 'menu' },
  { code: 'MST_PROD_LINE', path: '/master/prod-line', file: 'menu-captures/08-master-mst_prod_line.png', group: 'menu' },
  { code: 'MST_ROUTING', path: '/master/routing', file: 'menu-captures/09-master-mst_routing.png', group: 'menu' },
  { code: 'MST_WORK_CALENDAR', path: '/master/work-calendar', file: 'menu-captures/10-master-mst_work_calendar.png', group: 'menu' },
  { code: 'MST_WORKER', path: '/master/worker', file: 'menu-captures/11-master-mst_worker.png', group: 'menu' },
  { code: 'MST_WORK_INST', path: '/master/work-instruction', file: 'menu-captures/12-master-mst_work_inst.png', group: 'menu' },
  { code: 'MST_WAREHOUSE', path: '/master/warehouse', file: 'menu-captures/13-master-mst_warehouse.png', group: 'menu' },
  { code: 'MST_LABEL', path: '/master/label', file: 'menu-captures/14-master-mst_label.png', group: 'menu' },
  { code: 'INV_MAT_STOCK', path: '/inventory/material-stock', file: 'menu-captures/15-inventory-inv_mat_stock.png', group: 'menu' },
  { code: 'INV_TRANSACTION', path: '/inventory/transaction', file: 'menu-captures/16-inventory-inv_transaction.png', group: 'menu' },
  { code: 'INV_MAT_PHYSICAL_INV', path: '/inventory/material-physical-inv', file: 'menu-captures/17-inventory-inv_mat_physical_inv.png', group: 'menu' },
  { code: 'INV_MAT_PHYSICAL_INV_APPLY', path: '/inventory/material-physical-inv-apply', file: 'menu-captures/18-inventory-inv_mat_physical_inv_apply.png', group: 'menu' },
  { code: 'INV_MAT_PHYSICAL_INV_HISTORY', path: '/inventory/material-physical-inv-history', file: 'menu-captures/19-inventory-inv_mat_physical_inv_history.png', group: 'menu' },
  { code: 'MAT_ARRIVAL', path: '/material/arrival', file: 'menu-captures/20-material-mat_arrival.png', group: 'menu' },

  // ── 기존 업무흐름 캡처 재생성 ──
  { code: 'MAT_RECEIVE', path: '/material/receive', file: '01-material-receive.png', group: 'flow' },
  { code: 'PROD_INPUT_KIOSK', path: '/production/input-kiosk', file: '02-input-kiosk.png', group: 'flow' },
  { code: 'INSP_TERMINAL_RESULT', path: '/inspection/terminal-result', file: '03-inspection-result.png', group: 'flow' },
  { code: 'QC_DEFECT', path: '/quality/defect', file: '04-quality-defect.png', group: 'flow' },
  { code: 'SHIP_BOX_STOCK', path: '/shipping/box-stock', file: '05-shipping-box-stock.png', group: 'flow' },
  { code: 'MAT_SCRAP', path: '/material/scrap', file: '10-material-scrap.png', group: 'flow' },

  // ── 신규 슬라이드 화면 ──
  { code: 'QC_AQL', path: '/quality/aql', file: 'menu-captures/21-quality-qc_aql.png', group: 'new' },
  { code: 'QC_OQC', path: '/quality/oqc', file: 'menu-captures/22-quality-qc_oqc.png', group: 'new' },
  { code: 'QC_TRACE', path: '/quality/trace', file: 'menu-captures/23-quality-qc_trace.png', group: 'new' },
  { code: 'INSP_RESULT', path: '/inspection/result', file: 'menu-captures/24-inspection-insp_result.png', group: 'new' },
  { code: 'INSP_HISTORY', path: '/inspection/history', file: 'menu-captures/25-inspection-insp_history.png', group: 'new' },
  { code: 'PROD_KITTING', path: '/production/subprocess-kitting', file: 'menu-captures/26-production-prod_kitting.png', group: 'new' },
  { code: 'PROD_INPUT_ASSEMBLY', path: '/production/input-assembly', file: 'menu-captures/27-production-prod_input_assembly.png', group: 'new' },
  { code: 'PROD_RESULT', path: '/production/result', file: 'menu-captures/28-production-prod_result.png', group: 'new' },
  { code: 'SHIP_HISTORY', path: '/shipping/history', file: 'menu-captures/29-shipping-ship_history.png', group: 'new' },
  { code: 'SHIP_PALLET', path: '/shipping/pallet', file: 'menu-captures/30-shipping-ship_pallet.png', group: 'new' },
  { code: 'SHIP_PALLET_SHIP', path: '/shipping/pallet-ship', file: 'menu-captures/31-shipping-ship_pallet_ship.png', group: 'new' },
];

function selectTargets() {
  const arg = (process.argv[2] ?? '').trim();
  if (!arg || arg === 'all') return TARGETS;
  if (arg === 'new') return TARGETS.filter((t) => t.group === 'new');
  const codes = new Set(arg.split(',').map((c) => c.trim()).filter(Boolean));
  return TARGETS.filter((t) => codes.has(t.code));
}

async function installAuth(context) {
  await context.addInitScript(({ token, user }) => {
    const auth = { state: { user, token, selectedCompany: '40', selectedPlant: '1000',
      isAuthenticated: true, allowedMenus: [], currentWorker: null, pdaAllowedMenus: [] }, version: 0 };
    localStorage.setItem('harness-token', token);
    localStorage.setItem('harness-auth', JSON.stringify(auth));
  }, { token, user });
}

async function loadMenuTree(browser) {
  const ctx = await browser.newContext({ viewport: VIEWPORT, locale: 'ko-KR', timezoneId: 'Asia/Seoul' });
  await installAuth(ctx);
  const page = await ctx.newPage();
  await page.route('**/*', (route) => {
    const h = route.request().headers();
    if (h['next-router-prefetch'] === '1' || h['purpose'] === 'prefetch') return route.abort();
    return route.continue();
  });
  const tmo = Number(process.env.HANES_MENU_TIMEOUT_MS ?? '90000');
  const map = {};
  try {
    await page.goto(`${baseUrl}/login`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.evaluate(() => sessionStorage.removeItem('hanes-menu-tree'));
    await page.goto(`${baseUrl}/dashboard`, { waitUntil: 'domcontentloaded', timeout: tmo });
    await page.waitForLoadState('networkidle', { timeout: 4000 }).catch(() => {});
    await page.waitForTimeout(800);
    await page.waitForFunction(() => {
      const raw = sessionStorage.getItem('hanes-menu-tree');
      if (!raw) return false;
      const parsed = JSON.parse(raw);
      return (parsed?.state?.groups ?? []).some((g) => (g.children ?? []).length > 0);
    }, null, { timeout: tmo }).catch(() => {});
    Object.assign(map, await page.evaluate(() => {
      const raw = sessionStorage.getItem('hanes-menu-tree');
      const parsed = raw ? JSON.parse(raw) : null;
      const groups = parsed?.state?.groups ?? [];
      const m = {};
      for (const g of groups) for (const c of g.children ?? []) {
        if (c?.code && c?.path) m[c.code] = c.path;
      }
      return m;
    }));
  } catch { /* 폴백: target.path 사용 */ }
  finally { await ctx.close().catch(() => {}); }
  return map;
}

async function captureOne(browser, entryPath, outFile) {
  const context = await browser.newContext({ viewport: VIEWPORT, locale: 'ko-KR', timezoneId: 'Asia/Seoul' });
  await installAuth(context);
  const page = await context.newPage();
  page.setDefaultTimeout(12000);
  // Next dev prefetch 폭주 차단: 좌측 메뉴 링크 prefetch가 전체 라우트를 동시 컴파일시켜 서버를 잼시킨다.
  await page.route('**/*', (route) => {
    const h = route.request().headers();
    if (h['next-router-prefetch'] === '1' || h['purpose'] === 'prefetch') return route.abort();
    return route.continue();
  });
  try {
    await page.goto(`${baseUrl}${entryPath}`, { waitUntil: 'domcontentloaded', timeout: 90000 });
    await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
    // 데이터/그리드 렌더 안정화 대기
    await page.waitForTimeout(1500);
    await fs.mkdir(path.dirname(outFile), { recursive: true });
    await page.screenshot({ path: outFile, type: 'png', fullPage: false, timeout: 25000 });
    const stat = await fs.stat(outFile);
    return { ok: true, bytes: stat.size, suspectBlank: stat.size < BLANK_BYTES };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  } finally {
    await page.close().catch(() => {});
    await context.close().catch(() => {});
  }
}

async function main() {
  const targets = selectTargets();
  await fs.mkdir(path.join(assetsDir, 'menu-captures'), { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const results = [];
  try {
    const menuMap = await loadMenuTree(browser);
    for (const t of targets) {
      const entryPath = menuMap[t.code] ?? t.path;
      const outFile = path.join(assetsDir, t.file);
      process.stdout.write(`CAPTURE ${t.code} ${entryPath} ... `);
      const r = await captureOne(browser, entryPath, outFile);
      const status = r.ok ? (r.suspectBlank ? `OK(빈화면의심 ${r.bytes}B)` : `OK ${r.bytes}B`) : `FAIL ${r.error}`;
      console.log(status);
      results.push({ ...t, urlPath: entryPath, ...r });
    }
  } finally {
    await browser.close().catch(() => {});
  }

  const suspect = results.filter((r) => !r.ok || r.suspectBlank);
  await fs.writeFile(manifestOut, JSON.stringify({
    capturedAt: new Date().toISOString(),
    baseUrl, viewport: VIEWPORT, total: results.length,
    blankBytesThreshold: BLANK_BYTES,
    suspect: suspect.map((r) => ({ code: r.code, file: r.file, ok: r.ok, bytes: r.bytes, error: r.error })),
    results,
  }, null, 2), 'utf8');

  console.log('\n──────── 요약 ────────');
  console.log(`총 ${results.length}건 / 성공 ${results.filter((r) => r.ok).length} / 빈화면의심·실패 ${suspect.length}`);
  if (suspect.length) {
    console.log('점검 필요:');
    for (const r of suspect) console.log(`  - ${r.code} (${r.file}) ${r.ok ? r.bytes + 'B' : r.error}`);
  }
  console.log(`manifest: ${path.relative(repoRoot, manifestOut)}`);
}

main().catch((err) => { console.error(err); process.exitCode = 1; });
