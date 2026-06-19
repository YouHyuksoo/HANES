import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const pagePath = 'apps/frontend/src/app/(authenticated)/quality/aql/page.tsx';

test('AQL page uses the real AQL API and registration fields', () => {
  const page = fs.readFileSync(pagePath, 'utf8');

  assert.match(page, /api\.get\(["']\/quality\/aql["']/);
  assert.match(page, /api\.post\(["']\/quality\/aql["']/);
  assert.match(page, /api\.put\(`\/quality\/aql\/\$\{encodeURIComponent\(form\.aqlCode\)\}`/);
  assert.match(page, /api\.delete\(`\/quality\/aql\/\$\{encodeURIComponent\(selected\.aqlCode\)\}`/);
  assert.match(page, /aqlCode/);
  assert.match(page, /aqlName/);
  assert.match(page, /inspectionLevel/);
  assert.match(page, /aqlValue/);
  assert.match(page, /lotQtyFrom/);
  assert.match(page, /lotQtyTo/);
  assert.match(page, /sampleSize/);
  assert.match(page, /acceptQty/);
  assert.match(page, /rejectQty/);
});
