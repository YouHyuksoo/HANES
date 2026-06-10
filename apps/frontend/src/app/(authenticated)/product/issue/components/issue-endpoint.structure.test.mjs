import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const source = readFileSync(
  join(process.cwd(), 'apps/frontend/src/app/(authenticated)/product/issue/components/IssueFormPanel.tsx'),
  'utf8',
);

test('product issue stock lookup uses the backend product stocks route', () => {
  assert.match(source, /api\.get\("\/inventory\/product\/stocks"/);
  assert.doesNotMatch(source, /api\.get\("\/inventory\/product\/stock"/);
});
