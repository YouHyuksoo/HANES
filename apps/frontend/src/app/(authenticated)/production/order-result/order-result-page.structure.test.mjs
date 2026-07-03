import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.existsSync(path) ? fs.readFileSync(path, "utf8") : "";

const pagePath = "apps/frontend/src/app/(authenticated)/production/order-result/page.tsx";
const columnsPath = "apps/frontend/src/app/(authenticated)/production/order-result/orderResultColumns.tsx";
const typesPath = "apps/frontend/src/app/(authenticated)/production/order-result/types.ts";
const controllerPath = "apps/backend/src/modules/production/controllers/prod-result.controller.ts";
const servicePath = "apps/backend/src/modules/production/services/prod-result.service.ts";
const dtoPath = "apps/backend/src/modules/production/dto/prod-result.dto.ts";
const menuConfigPath = "apps/frontend/src/config/menuConfig.ts";
const validatorPath = "apps/backend/src/modules/menu-categories/utils/menu-code-validator.ts";
const seedPath = "apps/backend/src/seeds/menu-config.json";
const migrationPath = "apps/backend/src/migrations/2026-07-03_prod_order_result_menu_seed.sql";

test("/production/order-result has a focused page, types, and extracted columns", () => {
  assert.ok(fs.existsSync(pagePath), "page.tsx should exist");
  assert.ok(fs.existsSync(typesPath), "types.ts should exist");
  assert.ok(fs.existsSync(columnsPath), "orderResultColumns.tsx should exist");

  const page = read(pagePath);
  const columns = read(columnsPath);
  const types = read(typesPath);

  assert.match(types, /export interface ProdOrderResultRow/);
  assert.match(columns, /export function createOrderResultGridColumns\(/);
  assert.match(columns, /ColumnDef<ProdOrderResultRow>\[\]/);
  assert.match(columns, /StatusBadge codeType="JOB_ORDER_STATUS"/);
  assert.match(page, /api\.get\(["']\/production\/prod-results\/summary\/by-job-order["']/);
  assert.match(page, /DateRangeFilter/);
  assert.match(page, /planDateFrom/);
  assert.match(page, /planDateTo/);
  assert.doesNotMatch(page, /ColumnDef</);
});

test("backend exposes job-order based production result summary from JOB_ORDERS left joined with PROD_RESULTS", () => {
  const controller = read(controllerPath);
  const service = read(servicePath);
  const dto = read(dtoPath);

  assert.match(dto, /export class ProdOrderResultQueryDto extends PaginationQueryDto/);
  assert.match(controller, /@Get\(['"]summary\/by-job-order['"]\)/);
  assert.match(controller, /getSummaryByJobOrderList\(/);
  assert.match(service, /async getSummaryByJobOrderList\(/);
  assert.match(service, /createQueryBuilder\(['"]jo['"]\)/);
  assert.match(service, /leftJoin\(\s*['"]jo\.prodResults['"],\s*['"]pr['"]/);
  assert.match(service, /pr\.status != :canceled/);
  assert.match(service, /SUM\(NVL\(pr\.goodQty, 0\)\)/);
});

test("작업지시대비실적 menu is registered consistently", () => {
  const menuConfig = read(menuConfigPath);
  const validator = read(validatorPath);
  const seed = read(seedPath);
  const migration = read(migrationPath);

  assert.match(menuConfig, /code: "PROD_ORDER_RESULT", labelKey: "menu\.production\.orderResult", path: "\/production\/order-result"/);
  assert.match(validator, /'PROD_ORDER_RESULT'/);
  assert.match(seed, /"PROD_ORDER_RESULT"/);
  assert.match(migration, /PROD_ORDER_RESULT/);
  assert.match(migration, /MENU_CATEGORY_ITEMS/);
  assert.match(migration, /ROLE_MENU_PERMISSIONS/);
  assert.match(migration, /\n\/\n/);
});
