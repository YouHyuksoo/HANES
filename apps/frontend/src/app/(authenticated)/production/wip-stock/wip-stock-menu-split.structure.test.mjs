import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();
const wipPagePath = join(root, 'apps/frontend/src/app/(authenticated)/production/wip-stock/page.tsx');
const fgPagePath = join(root, 'apps/frontend/src/app/(authenticated)/production/fg-stock/page.tsx');
const sharedViewPath = join(root, 'apps/frontend/src/app/(authenticated)/production/wip-stock/WipStockView.tsx');
const menuConfigPath = join(root, 'apps/frontend/src/config/menuConfig.ts');
const pageRegistryPath = join(root, 'apps/frontend/src/components/layout/pageRegistry.generated.ts');
const validatorPath = join(root, 'apps/backend/src/modules/menu-categories/utils/menu-code-validator.ts');
const migrationPath = join(root, 'apps/backend/src/migrations/2026-06-20_split_wip_fg_stock_menus.sql');

test('production stock inquiry is split into semi-product and finished-product routes', () => {
  assert.ok(existsSync(sharedViewPath), 'shared stock view should exist');
  assert.ok(existsSync(fgPagePath), 'finished-product stock route should exist');

  const wipPage = readFileSync(wipPagePath, 'utf8');
  const fgPage = readFileSync(fgPagePath, 'utf8');
  const sharedView = readFileSync(sharedViewPath, 'utf8');

  assert.match(wipPage, /itemType="SEMI_PRODUCT"/);
  assert.match(wipPage, /titleKey="production\.wipStock\.semiTitle"/);
  assert.doesNotMatch(wipPage, /enableTypeFilter/);
  assert.match(fgPage, /itemType="FINISHED"/);
  assert.match(fgPage, /titleKey="production\.wipStock\.fgTitle"/);
  assert.match(fgPage, /enableTypeFilter/);

  assert.match(sharedView, /const effectiveItemType = enableTypeFilter \? typeFilter : itemType/);
  assert.match(sharedView, /if \(effectiveItemType\) params\.itemType = effectiveItemType/);
});

test('production menu exposes separate semi-product and finished-product stock entries', () => {
  const menuConfig = readFileSync(menuConfigPath, 'utf8');
  const pageRegistry = readFileSync(pageRegistryPath, 'utf8');
  const validator = readFileSync(validatorPath, 'utf8');
  const migration = readFileSync(migrationPath, 'utf8');

  assert.match(menuConfig, /code:\s*"PROD_WIP_STOCK"[\s\S]*labelKey:\s*"menu\.production\.wipSemiStock"[\s\S]*path:\s*"\/production\/wip-stock"/);
  assert.match(menuConfig, /code:\s*"PROD_FG_STOCK"[\s\S]*labelKey:\s*"menu\.production\.fgStock"[\s\S]*path:\s*"\/production\/fg-stock"/);
  assert.match(pageRegistry, /"\/production\/fg-stock"/);
  assert.match(validator, /'PROD_FG_STOCK'/);
  assert.match(migration, /PROD_FG_STOCK/);
  assert.match(migration, /MENU_CATEGORY_ITEMS/);
});
