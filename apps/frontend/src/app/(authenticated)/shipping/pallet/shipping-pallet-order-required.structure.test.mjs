import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");

test("pallet page creates pallets only through a confirmed ship order", () => {
  assert.match(source, /interface ShipOrderSummary/, "page should keep confirmed ship order summaries");
  assert.match(source, /api\.get\("\/shipping\/orders", \{ params: \{ status: "CONFIRMED", limit: "5000" \} \}\)/, "page should load confirmed ship orders");
  assert.match(source, /item\.orderQty > item\.shippedQty/, "ship order options should exclude fully shipped orders");
  assert.match(source, /order\.palletCount === 0/, "ship order options should exclude orders that already have pallets");
  assert.match(source, /const \[selectedShipOrderNo, setSelectedShipOrderNo\]/, "create modal should require a selected ship order");
  assert.match(source, /api\.post\(`\/shipping\/orders\/\$\{encodeURIComponent\(targetShipOrderNo\)\}\/pallets`, \{\}\)/, "create should use order-centric pallet API");
  assert.doesNotMatch(source, /api\.post\("\/shipping\/pallets", \{\}\)/, "page should not create general unbound pallets");
});

test("pallet create modal is scan-first and shows waiting orders as a helper list", () => {
  assert.match(source, /shipOrderScanInputRef/, "create modal should focus a ship order scan input");
  assert.match(source, /shipOrderScanText/, "create modal should keep scanned ship order text");
  assert.match(source, /handleShipOrderScan/, "create modal should resolve scanned ship order number");
  assert.match(source, /onKeyDown=\{\(e: React\.KeyboardEvent<HTMLInputElement>\) => \{ if \(e\.key === "Enter"\)/, "scan input should submit with Enter");
  assert.match(source, /shipping\.pallet\.waitingShipOrders/, "modal should label the waiting ship-order list");
  assert.match(source, /shipOrders\.map\(\(order\) => \(/, "modal should render waiting ship orders");
  assert.doesNotMatch(source, /options=\{shipOrderOptions\}/, "create modal should not rely on a select dropdown for ship order entry");
});

test("pallet page uses order-centric box work APIs and blocks unbound pallets", () => {
  assert.match(source, /!selectedPallet\.shipOrderNo/, "box work should reject pallets without a ship order");
  assert.match(source, /\/shipping\/orders\/\$\{encodeURIComponent\(selectedPallet\.shipOrderNo\)\}\/pallets\/\$\{selectedPallet\.palletNo\}\/boxes/, "assign should use order-centric box API");
  assert.match(source, /\/shipping\/orders\/\$\{encodeURIComponent\(selectedPallet\.shipOrderNo\)\}\/pallets\/\$\{selectedPallet\.palletNo\}\/boxes/, "remove should use order-centric box remove API");
  assert.match(source, /\/shipping\/orders\/\$\{encodeURIComponent\(pallet\.shipOrderNo\)\}\/pallets\/\$\{pallet\.palletNo\}\/close/, "close should use order-centric close API");
  assert.match(source, /disabled=\{!isOpen \|\| !pallet\.shipOrderNo\}/, "assign/close buttons should be disabled for unbound pallets");
});
