import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('./IqcDetailModal.tsx', import.meta.url), 'utf8');

test('검사유형/검사수량 컬럼을 표시한다', () => {
  assert.match(src, /IQC_ITEM_INSP_TYPE/);
  assert.match(src, /requiredQty/);
});
