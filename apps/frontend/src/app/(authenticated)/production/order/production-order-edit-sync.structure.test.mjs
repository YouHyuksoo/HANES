import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const pageSource = readFileSync(new URL('./page.tsx', import.meta.url), 'utf8');
const panelSource = readFileSync(new URL('./components/JobOrderFormPanel.tsx', import.meta.url), 'utf8');

test('production order edit panel maps rows through a reusable form data helper', () => {
  assert.match(pageSource, /const\s+toJobOrderFormData\s*=\s*\(row:\s*JobOrderItem\):\s*JobOrderFormData\s*=>/);
  assert.match(pageSource, /orderNo:\s*row\.orderNo/);
  assert.match(pageSource, /planDate:\s*row\.planDate\s*\?\s*String\(row\.planDate\)\.slice\(0,\s*10\)\s*:\s*undefined/);
});

test('production order row click synchronizes an already-open edit panel', () => {
  assert.match(pageSource, /const\s+nextSelected\s*=\s*selectedRow\?\.orderNo\s*===\s*row\.orderNo\s*\?\s*null\s*:\s*row/);
  assert.match(pageSource, /setSelectedRow\(nextSelected\)/);
  assert.match(pageSource, /if\s*\(\s*nextSelected\s*&&\s*isPanelOpen\s*&&\s*editingOrder\s*\)/);
  assert.match(pageSource, /panelAnimateRef\.current\s*=\s*false/);
  assert.match(pageSource, /setEditingOrder\(toJobOrderFormData\(nextSelected\)\)/);
});

test('production order form places line and process controls in one row', () => {
  assert.match(panelSource, /<div className="grid grid-cols-2 gap-3">\s*<LineSelect[\s\S]*?<ProcessSelect/);
});

test('production order form shows equipment choices without a dropdown', () => {
  assert.doesNotMatch(panelSource, /<EquipSelect/);
  assert.match(panelSource, /equipOptions\.map\(\(option\)\s*=>/);
  assert.match(panelSource, /type="button"[\s\S]*onClick=\{\(\)\s*=>\s*setField\("equipCode",\s*option\.value\)\}/);
  assert.match(panelSource, /form\.equipCode\s*===\s*option\.value/);
});
