import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import test from "node:test";

const source = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");

test("shipping confirm page loads unshipped confirmed ship orders for the left panel", () => {
  assert.match(source, /interface ShipOrderSummary/);
  assert.match(source, /const \[orders, setOrders\] = useState<ShipOrderSummary\[\]>/);
  assert.match(source, /api\.get\("\/shipping\/orders", \{ params: \{ status: "CONFIRMED", limit: "200" \} \}\)/);
  assert.match(source, /it\.orderQty > it\.shippedQty/);
  assert.match(source, /setOrders\(unshipped\)/);
});

test("shipping confirm page renders a left ship-order list and opens box scan ship only from the toolbar action", () => {
  assert.match(source, /orders\.map\(\(o\) => \{/);
  assert.match(source, /onClick=\{\(\) => selectOrder\(o\.shipOrderNo\)\}/);
  assert.match(source, /selectedOrderNo === o\.shipOrderNo/);
  assert.match(source, /disabled=\{!selectedOrderNo\}\s+onClick=\{\(\) => setScanOpen\(true\)\}/);
  assert.match(source, /BoxScanShipModal/);
  assert.match(source, /initialShipOrderNo=\{selectedOrderNo \?\? undefined\}/);
  assert.doesNotMatch(source, /OrderFulfillmentModal/);
});

test("shipping confirm page uses order-centric fulfillment and box-serial APIs", () => {
  assert.match(source, /encodeURIComponent\(orderNo\)\}\/fulfillment/);
  assert.match(source, /encodeURIComponent\(box\.boxNo\)\}\/serials/);
  // 팔레트 출하는 /shipping/pallet, /shipping/pallet-ship 별도 화면으로 분리되어 이 화면은 관여하지 않는다
  assert.doesNotMatch(source, /\/pallets/);
  assert.doesNotMatch(source, /\/ship-pallets/);
});

test("shipping confirm page reuses the shared box scan ship modal instead of a page-local fulfillment modal", () => {
  const modalSource = readFileSync(
    new URL("../../../../components/shipping/BoxScanShipModal.tsx", import.meta.url),
    "utf8",
  );
  assert.match(modalSource, /<Modal[^>]*size="xl"/);
});
