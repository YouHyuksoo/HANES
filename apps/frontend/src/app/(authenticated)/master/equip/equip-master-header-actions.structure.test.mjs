import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const pageSource = readFileSync(new URL('./page.tsx', import.meta.url), 'utf8');
const masterTabSource = readFileSync(new URL('./components/EquipMasterTab.tsx', import.meta.url), 'utf8');

test('equipment page delegates layout to a self-contained master tab (partner pattern)', () => {
  // page는 헤더/headerActions 없이 EquipMasterTab만 렌더한다.
  assert.match(pageSource, /<EquipMasterTab\s*\/>/);
  assert.doesNotMatch(pageSource, /onHeaderActionsChange/);
  assert.doesNotMatch(pageSource, /headerActions/);
});

test('equip master tab renders its own page-height layout with sibling slide panel', () => {
  // 최상위: 가로 flex + 전체 높이 (partner page와 동일)
  assert.match(masterTabSource, /<div className="flex h-full animate-fade-in">/);
  // 좌측 컬럼: 헤더 + 그리드
  assert.match(masterTabSource, /<div className="flex-1 min-w-0 flex flex-col overflow-hidden p-6 gap-4">/);
  // 헤더가 탭 내부에서 직접 렌더된다 (제목/부제 + 새로고침/추가 버튼)
  assert.match(masterTabSource, /master\.equip\.title/);
  assert.match(masterTabSource, /master\.equip\.subtitle/);
  assert.match(masterTabSource, /fetchEquipments/);
  assert.match(masterTabSource, /master\.equip\.addEquip/);
});

test('equip master tab no longer lifts header actions via callback prop', () => {
  assert.doesNotMatch(masterTabSource, /onHeaderActionsChange/);
  assert.doesNotMatch(masterTabSource, /interface\s+EquipMasterTabProps/);
});
