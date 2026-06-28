import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const pageSource = readFileSync(new URL('./page.tsx', import.meta.url), 'utf8');
const tabSource = readFileSync(new URL('./components/EquipMasterTab.tsx', import.meta.url), 'utf8');
const helpSource = readFileSync(new URL('./components/EquipFieldHelp.tsx', import.meta.url), 'utf8');

test('equip master exposes image upload state and form controls like part master', () => {
  assert.match(tabSource, /imageUrl|photoUrl/);
  assert.match(tabSource, /FileReader|createObjectURL|previewUrl/);
  assert.match(tabSource, /type="file"/);
  assert.match(tabSource, /accept="image\/jpeg,image\/png,image\/gif,image\/webp"/);
});

test('equip master field help includes image field db metadata', () => {
  assert.match(helpSource, /imageUrl:\s*\{\s*db:\s*"EQUIP_MASTERS\.IMAGE_URL"/);
});

test('equip page keeps equip master tab as the place where image upload is wired', () => {
  assert.match(pageSource, /<EquipMasterTab\s*\/>/);
});

test('equip master panel submit button uses save copy instead of add copy', () => {
  assert.match(tabSource, /t\("common\.save",\s*"저장"\)/);
  assert.doesNotMatch(tabSource, /t\("common\.add",\s*"등록"\)/);
});
