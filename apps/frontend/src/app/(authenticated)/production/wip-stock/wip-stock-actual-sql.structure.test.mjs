import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const pagePath = join(
  process.cwd(),
  'apps/frontend/src/app/(authenticated)/production/wip-stock/WipStockView.tsx',
);
const source = readFileSync(pagePath, 'utf8');

test('/production/wip-stock SQL preview matches the backend ProductStock query', () => {
  assert.match(source, /const wipStockSql = useMemo\(\(\) => \{/);
  assert.match(source, /sqlQuery=\{wipStockSql\}/);
  assert.match(source, /FROM PRODUCT_STOCKS s/);
  assert.match(source, /LEFT JOIN ITEM_MASTERS im/);
  assert.match(source, /LEFT JOIN WAREHOUSES wh/);
  assert.match(source, /if \(effectiveItemType\) params\.itemType = effectiveItemType/);
  assert.match(source, /const sqlTypePredicate = effectiveItemType/);
  assert.match(source, /s\.ITEM_TYPE = '\$\{sqlItemType\}'/);
  assert.match(source, /s\.COMPANY = '40'/);
  assert.match(source, /s\.PLANT_CD = '1000'/);
  assert.match(source, /UPPER\(s\.ITEM_CODE\) LIKE/);
  assert.match(source, /UPPER\(im\.ITEM_NAME\) LIKE/);
  assert.match(source, /ORDER BY s\.UPDATED_AT DESC/);
  assert.match(source, /\[searchText, effectiveItemType\]/);
  assert.doesNotMatch(source, /FROM WIP_STOCKS/);
});
