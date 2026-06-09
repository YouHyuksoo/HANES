import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeEquipOptions } from './equipOptions.ts';

test('normalizes paged equipment response data into selectable options', () => {
  const result = normalizeEquipOptions({
    data: [
      { equipCode: 'EQ-CUT-01', equipName: '자동재단기', status: 'NORMAL' },
      { equipCode: 'EQ-ASM-01', equipName: '조립 지그', lineCode: 'LINE-01' },
    ],
    total: 2,
    page: 1,
    limit: 500,
  });

  assert.deepEqual(result, [
    { equipCode: 'EQ-CUT-01', equipName: '자동재단기' },
    { equipCode: 'EQ-ASM-01', equipName: '조립 지그' },
  ]);
});

test('normalizes item-wrapped equipment response data into selectable options', () => {
  const result = normalizeEquipOptions({
    data: {
      items: [
        { equipCode: 'EQ-TEST-01', equipName: '검사기' },
      ],
    },
  });

  assert.deepEqual(result, [
    { equipCode: 'EQ-TEST-01', equipName: '검사기' },
  ]);
});
