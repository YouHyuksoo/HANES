import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");

test("shipping order SQL preview reflects the actual list query tables", () => {
  assert.doesNotMatch(source, /FROM SHIPPING_ORDERS/, "shipping order preview must not reference the wrong SHIPPING_ORDERS table");
  assert.match(source, /FROM SHIPMENT_ORDERS so/, "preview should start from the actual shipment order header table");
  assert.match(source, /LEFT JOIN SHIPMENT_ORDER_ITEMS soi/, "preview should show detail item lookup");
  assert.match(source, /LEFT JOIN ITEM_MASTERS im/, "preview should show item name lookup");
  assert.match(source, /LEFT JOIN PARTNER_MASTERS pm/, "preview should show customer name lookup");
  assert.match(source, /so\.COMPANY = '40'/, "preview should include company tenant filter");
  assert.match(source, /so\.PLANT_CD = '1000'/, "preview should include plant tenant filter");
  assert.match(source, /ORDER BY so\.CREATED_AT DESC/, "preview should match backend ordering");
});
