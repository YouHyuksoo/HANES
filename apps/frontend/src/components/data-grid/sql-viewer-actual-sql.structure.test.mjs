import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import assert from 'node:assert/strict';
import { test } from 'node:test';

const root = process.cwd();
const read = (relativePath) => readFileSync(join(root, relativePath), 'utf8');

test('SQL viewer prefers request-captured actual SQL over hardcoded preview SQL', () => {
  const api = read('apps/frontend/src/services/api.ts');
  const modal = read('apps/frontend/src/components/data-grid/SqlViewerModal.tsx');
  const databaseModule = read('apps/backend/src/database/database.module.ts');
  const main = read('apps/backend/src/main.ts');

  assert.match(
    api,
    /recordSqlDebugResponse\(response\.config\?\.url,\s*response\.data\?\.meta\?\.debugSql\)/,
    'axios response interceptor should cache debug SQL from every API response',
  );

  assert.match(
    api,
    /isCountOnlySql\(entry\.sql\)/,
    'SQL cache matching should avoid showing getManyAndCount COUNT SQL as the grid query',
  );

  assert.match(
    modal,
    /getLatestActualSqlForPreview\(sql\) \?\? sql/,
    'SQL modal should prefer cached actual SQL for the preview SQL table',
  );

  assert.match(
    databaseModule,
    /new SqlDebugTypeormLogger\(/,
    'TypeORM should use the SQL debug logger',
  );

  assert.match(
    main,
    /new SqlDebugInterceptor\(\)/,
    'Nest should attach captured SQL to responses through a global interceptor',
  );
});
