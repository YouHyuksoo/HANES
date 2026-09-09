import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const page = readFileSync(new URL('./page.tsx', import.meta.url), 'utf8');
const columns = readFileSync(new URL('./terminalCrimpSpecColumns.tsx', import.meta.url), 'utf8');
const panel = readFileSync(new URL('./TerminalCrimpSpecFormPanel.tsx', import.meta.url), 'utf8');

test('/master/terminal-crimp-spec keeps page.tsx thin: columns + form panel are separate files', () => {
  assert.match(columns, /export function createTerminalCrimpSpecGridColumns\(/);
  assert.match(columns, /\): ColumnDef<TerminalCrimpSpecRow>\[\]/);
  assert.match(page, /import \{ createTerminalCrimpSpecGridColumns, type TerminalCrimpSpecRow \} from "\.\/terminalCrimpSpecColumns"/);
  assert.match(page, /from "\.\/TerminalCrimpSpecFormPanel"/);
  assert.doesNotMatch(page, /accessorKey:/);
  assert.doesNotMatch(page, /<Input\s+label=/);
});

test('right-side panel follows master panel standard (top actions, data swap, unsaved guard)', () => {
  assert.match(page, /useUnsavedGuard/);
  assert.match(page, /markDirty\(dirty\)/);
  assert.match(page, /initialFormRef\.current = next/);
  assert.doesNotMatch(page, /<TerminalCrimpSpecFormPanel[^>]*\skey=/);
  assert.match(panel, /animate-slide-in-right/);
  // 액션 버튼(취소/저장)은 패널 헤더(상단)에 있어야 한다
  const headerBlock = panel.slice(panel.indexOf('border-b border-border'), panel.indexOf('overflow-y-auto'));
  assert.match(headerBlock, /onClick=\{onCancel\}/);
  assert.match(headerBlock, /onClick=\{onSave\}/);
});

test('coded values use shared select components, not free-text inputs', () => {
  assert.match(panel, /<PartSelect[\s\S]*value=\{form\.terminalItemCode\}/);
  assert.match(panel, /<PartSelect[\s\S]*value=\{form\.wireItemCode\}/);
  assert.match(panel, /<ComCodeSelect groupCode="TERMINAL_TYPE"/);
  assert.match(panel, /<UseYnSelect includeAll=\{false\}/);
  assert.match(page, /<ComCodeSelect groupCode="TERMINAL_TYPE"/);
  assert.match(columns, /<ComCodeBadge groupCode="TERMINAL_TYPE"/);
});

test('list uses server paging with default active filter and no browser dialogs', () => {
  assert.match(page, /ServerPager/);
  assert.match(page, /useState\("Y"\)/);
  assert.match(page, /params\.useYn = useYnFilter/);
  for (const banned of [/\balert\(/, /\bconfirm\(/, /\bprompt\(/, /as any/]) {
    assert.doesNotMatch(page, banned);
    assert.doesNotMatch(panel, banned);
    assert.doesNotMatch(columns, banned);
  }
  assert.match(page, /<ConfirmModal[\s\S]*variant="danger"/);
});

test('empty spec values render "-" instead of guessed numbers', () => {
  assert.match(columns, /if \(lsl == null && usl == null\) return "-"/);
  assert.match(page, /toNumberOrNull/);
});

test('no pastel background utility classes in badges/cells', () => {
  for (const src of [page, columns, panel]) {
    assert.doesNotMatch(src, /bg-(?:green|red|yellow|blue|amber|orange|purple|cyan|teal)-50\b/);
    assert.doesNotMatch(src, /bg-(?:green|red|yellow|blue|amber|orange|purple|cyan|teal)-100\b/);
  }
});
