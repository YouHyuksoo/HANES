import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import test from "node:test";

const pageSource = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");
const modalSource = readFileSync(new URL("./OrderFulfillmentModal.tsx", import.meta.url), "utf8");
const source = `${pageSource}\n${modalSource}`;

test("shipping confirm page loads unshipped confirmed ship orders for the left panel", () => {
  assert.match(source, /interface ShipOrderSummary/);
  assert.match(source, /const \[shipOrders, setShipOrders\] = useState<ShipOrderSummary\[\]>/);
  assert.match(source, /api\.get\('\/shipping\/orders', \{ params: \{ status: 'CONFIRMED', limit: '5000' \} \}\)/);
  assert.match(source, /item\.orderQty > item\.shippedQty/);
  assert.match(source, /setShipOrders\(unshipped\)/);
});

test("shipping confirm page renders a left ship-order grid and opens fulfillment work only from the row action icon", () => {
  assert.match(source, /shipOrderColumns = useMemo<ColumnDef<ShipOrderSummary>\[\]>/);
  assert.match(source, /data=\{shipOrders\}/);
  assert.match(source, /selectedRowId=\{selectedShipOrderNo \?\? undefined\}/);
  assert.match(source, /getRowId=\{\(row\) => row\.shipOrderNo\}/);
  assert.doesNotMatch(source, /onRowClick=\{openFulfillmentForOrder\}/);
  assert.match(source, /id: 'fulfillmentAction'/);
  assert.match(source, /title=\{t\('shipping\.confirm\.startFulfillment'/);
  assert.match(source, /e\.stopPropagation\(\); openFulfillmentForOrder\(row\.original\)/);
  assert.match(source, /OrderFulfillmentModal/);
  assert.doesNotMatch(source, /initialShipOrderNo=\{selectedShipOrderNo \?\? undefined\}/);
  assert.doesNotMatch(source, /박스 스캔 출하/);
});

test("shipping confirm page uses order-centric fulfillment APIs", () => {
  assert.match(source, /encodeURIComponent\(shipOrderNo\)\}\/fulfillment/);
  assert.match(source, /encodeURIComponent\(shipOrderNo\)\}\/pallets/);
  assert.match(source, /encodeURIComponent\(shipOrderNo\)\}\/ship-pallets/);
});

test("shipping confirm fulfillment modal uses the wide full viewport size", () => {
  assert.match(modalSource, /<Modal[^>]*title="출하작업"[^>]*size="full"/);
  assert.doesNotMatch(modalSource, /<Modal[^>]*title="출하작업"[^>]*size="xl"/);
});
