import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import assert from 'node:assert/strict';
import { test } from 'node:test';

const source = readFileSync(
  join(process.cwd(), 'apps/frontend/src/app/(authenticated)/material/po/components/PoFormPanel.tsx'),
  'utf8',
);

test('PO item list expands to fill available side panel height', () => {
  assert.doesNotMatch(
    source,
    /max-h-\[320px\]/,
    'item list must not cap high-resolution side panel height at 320px',
  );

  assert.match(
    source,
    /className="flex-1 min-h-0 overflow-hidden px-5 py-3 flex flex-col gap-4"/,
    'panel body should be a bounded flex column so only the item list scrolls',
  );

  assert.match(
    source,
    /className="border-t border-border pt-3 flex-1 min-h-0 flex flex-col"/,
    'item section should consume remaining panel height',
  );

  assert.match(
    source,
    /className="flex-1 min-h-0 space-y-1\.5 overflow-y-auto pr-1"/,
    'item list should scroll within the remaining flexible area',
  );
});
