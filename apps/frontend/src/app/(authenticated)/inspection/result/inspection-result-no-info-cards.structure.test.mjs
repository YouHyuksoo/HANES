import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const panelSource = readFileSync(new URL('./components/InspectPanel.tsx', import.meta.url), 'utf8');
const koLocale = JSON.parse(readFileSync(new URL('../../../../locales/ko.json', import.meta.url), 'utf8'));

test('inspection result panel does not render top summary info cards', () => {
  assert.doesNotMatch(panelSource, /<StatCard/);
  assert.doesNotMatch(panelSource, /통계 카드/);
  assert.doesNotMatch(panelSource, /const\s+\[stats,\s*setStats\]/);
  assert.doesNotMatch(panelSource, /EMPTY_STATS/);
  assert.doesNotMatch(panelSource, /\/quality\/continuity-inspect\/stats/);
  assert.doesNotMatch(panelSource, /StatCard/);
  assert.doesNotMatch(panelSource, /BarChart3/);
  assert.doesNotMatch(panelSource, /Package/);
});

test('inspection result panel does not duplicate selected order information', () => {
  assert.doesNotMatch(panelSource, /작업지시 정보/);
  assert.doesNotMatch(panelSource, /ClipboardList/);
  assert.doesNotMatch(panelSource, /order\.itemName/);
  assert.doesNotMatch(panelSource, /inspection\.result\.planQty/);
});

test('continuity inspection menu label is concise', () => {
  assert.equal(koLocale.menu['inspection.result'], '통전검사');
});
