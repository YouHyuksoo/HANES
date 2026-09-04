import { existsSync, readFileSync, readdirSync } from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';

/*
 * /quality/spc — 고전압 하네스 SPC 관리도 보드 구조 테스트
 * 실행: 저장소 루트에서 node --test "apps/frontend/src/app/(authenticated)/quality/spc/hv-spc-board.structure.test.mjs"
 */
const DIR = 'apps/frontend/src/app/(authenticated)/quality/spc';
const read = (path) => readFileSync(path, 'utf8');

const page = read(`${DIR}/page.tsx`);
const board = read(`${DIR}/components/HvSpcBoard.tsx`);
const detail = read(`${DIR}/components/HvSpcDetail.tsx`);
const list = read(`${DIR}/components/HvSpcTargetList.tsx`);
const charts = read(`${DIR}/components/HvSpcCharts.tsx`);
const css = read(`${DIR}/components/hv-spc-theme.css`);
const rules = read(`${DIR}/components/spc-rules.ts`);
const types = read(`${DIR}/types.ts`);

test('page renders the HV SPC board and drops the old control-chart CRUD screen', () => {
  assert.match(page, /import HvSpcBoard from "\.\/components\/HvSpcBoard"/);
  assert.match(page, /<HvSpcBoard \/>/);
  assert.match(page, /usePageAiTools\("quality\.spc"\)/);
  assert.doesNotMatch(page, /spcColumns|createSpcGridColumns|SpcFormPanel|SpcChartView|DataGrid/);
  for (const gone of ['spcColumns.tsx', 'spc-columns.structure.test.mjs', 'components/SpcFormPanel.tsx',
    'components/SpcChartView.tsx', 'components/SpcControlCharts.tsx', 'components/SpcHistogram.tsx']) {
    assert.equal(existsSync(`${DIR}/${gone}`), false, `${gone} should be deleted`);
  }
});

test('board calls the HV SPC backend contract with days/k and reads ApiResponse.data', () => {
  assert.match(board, /`\/quality\/spc\/hv\/targets\?days=\$\{days\}&k=\$\{kLimit\}`/);
  assert.match(board, /`\/quality\/spc\/hv\/targets\/\$\{encodeURIComponent\(effectiveId\)\}\?days=\$\{days\}&k=\$\{kLimit\}`/);
  assert.match(board, /useApiQuery<SpcTargetsResponse>/);
  assert.match(board, /useApiQuery<SpcTargetData>/);
  assert.match(board, /listQuery\.data\?\.data/);
  assert.match(board, /detailQuery\.data\?\.data/);
  assert.doesNotMatch(board, /useSWR|next-intl|@\/lib\/fetcher/);
});

test('board keeps period / subgroup k / process filters, search and OOC·WARN·total summary', () => {
  assert.match(types, /SPC_DAY_OPTIONS = \[7, 14, 30, 60\]/);
  assert.match(types, /SPC_K_OPTIONS = \[0, 25, 50\]/);
  assert.match(board, /SPC_DAY_OPTIONS\.map/);
  assert.match(board, /SPC_K_OPTIONS\.map/);
  assert.match(board, /setProcessFilter/);
  assert.match(board, /quality\.spc\.hv\.searchPlaceholder/);
  assert.match(board, /counts\.ooc/);
  assert.match(board, /counts\.warn/);
  assert.match(board, /counts\.total/);
});

test('mock-data badge shows only when sourceKind === MOCK', () => {
  assert.match(board, /list\?\.sourceKind === "MOCK" && \(/);
  assert.match(board, /className="hv-banner"/);
  assert.match(board, /quality\.spc\.hv\.mockBanner/);
});

test('status and rule labels come from i18n keys, not a local Korean dictionary', () => {
  assert.match(list, /t\(`quality\.spc\.hv\.status\.\$\{tg\.health\}`\)/);
  assert.match(detail, /t\(`quality\.spc\.hv\.status\.\$\{target\.health\}`\)/);
  assert.match(detail, /t\(`quality\.spc\.hv\.rules\.\$\{v\.rule\}`\)/);
  for (const src of [board, detail, list, charts]) {
    assert.match(src, /from "react-i18next"/);
    // JSX 텍스트 노드에 한글 상태 라벨 직접 삽입 금지 (t() 의 기본값 인자는 허용)
    assert.doesNotMatch(src, />\s*(관리상태|이탈|주의)\s*</, 'status labels must not be hard-coded in JSX');
    assert.doesNotMatch(src, /STABLE:\s*["']관리상태["']|OOC:\s*["']이탈["']/, 'no local status dictionary');
  }
});

test('theme stays scoped to .hvspc-root, follows HANES dark class, and bans white/pastel backgrounds', () => {
  assert.match(css, /^\.hvspc-root \{/m);
  assert.match(css, /^\.dark \.hvspc-root \{/m);
  assert.match(css, /--hv-bg: var\(--background\)/);
  assert.match(css, /--hv-line: var\(--border\)/);
  assert.match(css, /--hv-ink: var\(--foreground\)/);
  assert.doesNotMatch(css, /#fff\b|#ffffff|background:\s*white/i);
  for (const [name, src] of Object.entries({ page, board, detail, list, charts })) {
    assert.doesNotMatch(src, /\bbg-[a-z]+-(50|100)\b/, `${name} must not use pastel bg-*-50/100`);
    assert.doesNotMatch(src, /\b(text|bg|border)-(blue|purple|indigo|violet)-\d{3}\b/, `${name} must not use raw tailwind blue/purple colors`);
  }
});

test('charts use recharts (already a HANES dependency) and read colors from CSS variables', () => {
  assert.match(charts, /from "recharts"/);
  assert.match(charts, /cssVar\("--hv-stop"/);
  assert.match(charts, /ReferenceLine y=\{stats\.xbarUCL\}/);
  assert.match(charts, /ReferenceArea/);
  const pkg = JSON.parse(read('apps/frontend/package.json'));
  assert.ok(pkg.dependencies.recharts, 'recharts must be declared in frontend package.json');
});

test('flagBySubgroup: R1/RR1 flag only the point, pattern rules flag all members, OOC wins over WARN', () => {
  assert.match(rules, /export function flagBySubgroup\(/);
  assert.match(rules, /OOC_RULES: readonly SpcRuleCode\[\] = \["R1", "RR1"\]/);
  assert.match(detail, /import \{ flagBySubgroup, isOocRule \} from "\.\/spc-rules"/);
});

test('no stray files in spc folder besides the board set', () => {
  const files = readdirSync(`${DIR}/components`).sort();
  assert.deepEqual(files, ['HvSpcBoard.tsx', 'HvSpcCharts.tsx', 'HvSpcDetail.tsx', 'HvSpcTargetList.tsx', 'hv-spc-theme.css', 'spc-rules.ts']);
});
