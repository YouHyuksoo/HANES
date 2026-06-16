import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import assert from 'node:assert/strict';
import { test } from 'node:test';

const root = process.cwd();
const source = readFileSync(join(root, 'apps/frontend/src/components/data-grid/SqlViewerModal.tsx'), 'utf8');

test('SqlViewerModal shows column schema only after the user toggles it', () => {
  assert.match(
    source,
    /const \[showSchema,\s*setShowSchema\] = useState\(false\)/,
    'column schema panel should be hidden by default',
  );

  assert.match(
    source,
    /setShowSchema\(\(prev\) => !prev\)/,
    'column schema visibility should be user-toggleable',
  );

  assert.match(
    source,
    /showSchema \? "컬럼명세 숨기기" : "컬럼명세 보기"/,
    'toggle button should clearly describe show/hide state',
  );

  assert.match(
    source,
    /showSchema && \(/,
    'schema panel should render only when showSchema is true',
  );

  assert.match(
    source,
    /if \(!showSchema \|\| !tableName\) return;/,
    'table schema should be loaded only when the user asks to view it',
  );
});
