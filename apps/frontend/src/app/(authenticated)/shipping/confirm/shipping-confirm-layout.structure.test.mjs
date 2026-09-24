import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const page = fs.readFileSync('apps/frontend/src/app/(authenticated)/shipping/confirm/page.tsx', 'utf8');

test('shipping confirm constrains the desktop grid row to the available page height', () => {
  assert.match(page, /lg:grid-rows-\[minmax\(0,1fr\)\]/);
});

test('shipping confirm clips the detail card and scrolls only its serial list', () => {
  assert.match(page, /\{\/\* right: selected box serials \*\/\}[\s\S]*?<Card className="min-h-0 overflow-hidden" padding="none">[\s\S]*?<div className="flex-1 min-h-0 overflow-y-auto space-y-1">/);
});
