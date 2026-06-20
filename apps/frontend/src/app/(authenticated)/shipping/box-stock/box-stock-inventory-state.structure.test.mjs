import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import test from "node:test";

const source = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");

test("box stock page separates packed waiting stock from warehouse received stock", () => {
  assert.match(source, /inventoryState/);
  assert.match(source, /PACKED_WAITING/);
  assert.match(source, /WAREHOUSE_RECEIVED/);
  assert.match(source, /shipping\.boxStock\.packedWaiting/);
  assert.match(source, /shipping\.boxStock\.warehouseReceived/);
});

test("box stock SQL preview uses product transactions for warehouse receipt state", () => {
  assert.match(source, /PRODUCT_TRANSACTIONS/);
  assert.match(source, /REF_TYPE\s*=\s*'BOX'/);
  assert.match(source, /TRANS_TYPE IN \('WIP_OUT', 'FG_IN'\)/);
  assert.match(source, /BOX_NO IS NOT NULL/);
});
