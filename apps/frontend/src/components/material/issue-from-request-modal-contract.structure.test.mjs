import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const source = readFileSync('apps/frontend/src/components/material/IssueFromRequestModal.tsx', 'utf8');

test('IssueFromRequestModal sends backend issue-request contract with selected LOT', () => {
  assert.match(
    source,
    /\/material\/stocks\/available/,
    'approved request issue flow must load selectable IQC PASS material lots',
  );

  assert.match(
    source,
    /allocation\[row\.rowKey\]/,
    'modal should keep FIFO allocation slices per request item',
  );

  assert.match(
    source,
    /requestItemId:\s*String\(row\.seq/,
    'payload must send requestItemId as the request item seq expected by the backend',
  );

  assert.match(
    source,
    /matUid:\s*slice\.matUid/,
    'payload must include each allocated lot matUid',
  );

  assert.equal(
    source.includes('itemId: r.id'),
    false,
    'payload must not send the obsolete itemId field',
  );
});
