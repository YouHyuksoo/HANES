import { readFileSync } from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';

const source = readFileSync(
  'apps/frontend/src/app/(authenticated)/material/receive/components/ReceivableTable.tsx',
  'utf8',
);

test('입고대기 성적서 상태는 첨부 파일이 있으면 필수 여부보다 첨부를 우선 표시한다', () => {
  const uploadedCheck = source.indexOf('row.original.certUploaded');
  const requiredCheck = source.indexOf('!row.original.certRequired');

  assert.notEqual(uploadedCheck, -1, 'certUploaded 상태 분기가 필요하다');
  assert.notEqual(requiredCheck, -1, 'certRequired 상태 분기가 필요하다');
  assert.ok(uploadedCheck < requiredCheck, '첨부 상태가 필수 아님 상태보다 먼저 평가되어야 한다');
});
