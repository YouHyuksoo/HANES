import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const bomTabSource = readFileSync(new URL('./components/EquipBomTab.tsx', import.meta.url), 'utf8');

test('equipment BOM tab uses a compact one-line equipment selector list', () => {
  assert.match(bomTabSource, /<div className="col-span-3">/);
  assert.match(bomTabSource, /<div className="col-span-9">/);
  assert.match(bomTabSource, /<CardContent className="flex-1 flex flex-col min-h-0 p-2">/);
  assert.match(bomTabSource, /grid-cols-\[88px_minmax\(0,1fr\)_16px\]/);
  assert.match(bomTabSource, /h-8/);
  assert.match(bomTabSource, /<span className="[^"]*truncate[^"]*">\{equip\.equipCode\}/);
  assert.match(bomTabSource, /<span className="[^"]*truncate[^"]*">\{equip\.equipName\}/);
  assert.doesNotMatch(bomTabSource, /text-xs text-text-muted">\{equip\.equipCode\}/);
  assert.doesNotMatch(bomTabSource, /text-left p-3 rounded-lg/);
});
