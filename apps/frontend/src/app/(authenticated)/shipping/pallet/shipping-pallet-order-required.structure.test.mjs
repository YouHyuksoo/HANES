import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");

test("pallet page creates pallets only through a confirmed ship order", () => {
  assert.match(source, /interface ShipOrderSummary/, "page should keep confirmed ship order summaries");
  assert.match(source, /api\.get\("\/shipping\/orders", \{ params: \{ status: "CONFIRMED", limit: "5000" \} \}\)/, "page should load confirmed ship orders");
  assert.match(source, /item\.orderQty > item\.shippedQty/, "ship order options should exclude fully shipped orders");
  assert.match(source, /const \[selectedShipOrderNo, setSelectedShipOrderNo\]/, "create modal should require a selected ship order");
  assert.match(source, /api\.post\(`\/shipping\/orders\/\$\{encodeURIComponent\(selectedShipOrderNo\)\}\/pallets`, \{\}\)/, "create should use order-centric pallet API");
  assert.doesNotMatch(source, /api\.post\("\/shipping\/pallets", \{\}\)/, "page should not create general unbound pallets");
});

test("pallet page uses order-centric box work APIs and blocks unbound pallets", () => {
  assert.match(source, /!selectedPallet\.shipOrderNo/, "box work should reject pallets without a ship order");
  assert.match(source, /\/shipping\/orders\/\$\{encodeURIComponent\(selectedPallet\.shipOrderNo\)\}\/pallets\/\$\{selectedPallet\.palletNo\}\/boxes/, "assign should use order-centric box API");
  assert.match(source, /\/shipping\/orders\/\$\{encodeURIComponent\(selectedPallet\.shipOrderNo\)\}\/pallets\/\$\{selectedPallet\.palletNo\}\/boxes/, "remove should use order-centric box remove API");
  assert.match(source, /\/shipping\/orders\/\$\{encodeURIComponent\(pallet\.shipOrderNo\)\}\/pallets\/\$\{pallet\.palletNo\}\/close/, "close should use order-centric close API");
  assert.match(source, /disabled=\{!isOpen \|\| !pallet\.shipOrderNo\}/, "assign/close buttons should be disabled for unbound pallets");
});
