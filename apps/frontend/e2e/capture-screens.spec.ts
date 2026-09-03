import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';

/**
 * 공정별 이력관리 구현 근거 보고서용 화면 캡처.
 *
 * 실행:
 *   $env:E2E_EMAIL="admin@hanes.com"; $env:E2E_PASSWORD="****"
 *   pnpm --dir apps/frontend exec playwright test capture-screens --project=chromium
 *
 * 결과: docs/reports/shots/<key>.png  (전체 페이지 캡처)
 * 로그인은 auth.setup.ts 가 처리하고 세션(storageState)을 재사용한다.
 */
const OUT = path.resolve(__dirname, '../../../docs/reports/shots');

const SCREENS: { key: string; route: string; title: string }[] = [
  { key: 'arrival',    route: '/material/arrival',              title: '자재입하관리' },
  { key: 'iqc',        route: '/material/iqc',                  title: '수입검사(IQC)' },
  { key: 'receive',    route: '/material/receive',              title: '자재입고관리' },
  { key: 'issue',      route: '/material/issue',                title: '자재출고관리(양산)' },
  { key: 'kiosk',      route: '/production/input-kiosk',        title: '생산실적 키오스크' },
  { key: 'protocol',   route: '/inspection/protocol',           title: '검사기 프로토콜 설정' },
  { key: 'kitting',    route: '/production/subprocess-kitting', title: '실적입력(서브공정)' },
  { key: 'wipstock',   route: '/production/wip-stock',          title: '반제품 재공재고' },
  { key: 'assembly',   route: '/production/input-assembly',     title: '실적입력(조립)' },
  { key: 'trace',      route: '/quality/trace',                 title: '추적성조회' },
  { key: 'inspresult', route: '/inspection/result',             title: '통전검사결과' },
  { key: 'visual',     route: '/quality/inspect',               title: '외관검사' },
  { key: 'pack',       route: '/shipping/pack',                 title: '제품포장관리' },
  { key: 'oqc',        route: '/quality/oqc',                   title: '출하검사(OQC)' },
];

test.use({ viewport: { width: 1600, height: 1000 } });

test('보고서용 화면 캡처', async ({ page }) => {
  test.setTimeout(SCREENS.length * 100_000 + 60_000);
  fs.mkdirSync(OUT, { recursive: true });

  const done: string[] = [];
  const failed: string[] = [];

  for (const s of SCREENS) {
    try {
      await page.goto(s.route, { waitUntil: 'load', timeout: 90_000 });
      // 그리드/패널 렌더와 첫 데이터 fetch 안정화 대기 (dev 서버는 networkidle에 도달하지 않음)
      await page.waitForTimeout(5000);
      await page.screenshot({ path: path.join(OUT, `${s.key}.png`), fullPage: false });
      done.push(`${s.key}  ${s.route}`);
    } catch (error: unknown) {
      failed.push(`${s.key}  ${s.route}  ${(error as Error)?.message?.slice(0, 80)}`);
    }
  }

  console.log('\n=== 캡처 완료 ===\n' + done.join('\n'));
  if (failed.length) console.log('\n=== 실패 ===\n' + failed.join('\n'));
  console.log(`\n저장 위치: ${OUT}`);
  expect(done.length, '캡처된 화면이 없습니다').toBeGreaterThan(0);
});
