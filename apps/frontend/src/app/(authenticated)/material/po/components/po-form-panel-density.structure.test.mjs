import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import assert from 'node:assert/strict';
import { test } from 'node:test';

const source = readFileSync(
  join(process.cwd(), 'apps/frontend/src/app/(authenticated)/material/po/components/PoFormPanel.tsx'),
  'utf8',
);

test('PO item rows use compact inputs to preserve right panel space', () => {
  assert.match(
    source,
    /function CompactItemInput\(/,
    'item rows should use a compact local field instead of the full-height shared Input',
  );

  assert.match(
    source,
    /className="block text-\[10px\] font-medium leading-none text-text-muted"/,
    'compact item labels should use smaller type and tighter line height',
  );

  assert.match(
    source,
    /className=\{`h-7 w-full rounded border border-border bg-surface px-2 text-xs text-text/,
    'compact item inputs should be shorter than the shared h-10 input',
  );

  assert.match(
    source,
    /className="p-2 rounded-md border border-border bg-surface-secondary dark:bg-slate-800\/50"/,
    'item cards should use reduced padding and radius',
  );

  assert.match(
    source,
    /className="grid grid-cols-4 gap-1\.5"/,
    'item field grid should use tighter column gaps',
  );

  assert.match(
    source,
    /<CompactItemInput[\s\S]*?label=\{t\("material\.po\.lineNo"[\s\S]*?<CompactItemInput[\s\S]*?label=\{t\("material\.po\.revNo"[\s\S]*?<CompactItemInput[\s\S]*?label=\{t\("material\.po\.orderQty"[\s\S]*?<CompactItemInput[\s\S]*?label=\{t\("common\.remark"\)/,
    'all item row fields should use the compact input',
  );
});
