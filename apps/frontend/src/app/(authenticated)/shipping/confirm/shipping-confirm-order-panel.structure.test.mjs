import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import test from "node:test";

const source = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");

test("shipping confirm page loads unshipped confirmed ship orders for the left panel", () => {
  assert.match(source, /interface ShipOrderSummary/);
  assert.match(source, /const \[shipOrders, setShipOrders\] = useState<ShipOrderSummary\[\]>/);
  assert.match(source, /api\.get\('\/shipping\/orders', \{ params: \{ status: 'CONFIRMED', limit: '5000' \} \}\)/);
  assert.match(source, /item\.orderQty > item\.shippedQty/);
  assert.match(source, /setShipOrders\(unshipped\)/);
});

test("shipping confirm page renders a left ship-order grid and opens box scan with selected order", () => {
  assert.match(source, /shipOrderColumns = useMemo<ColumnDef<ShipOrderSummary>\[\]>/);
  assert.match(source, /data=\{shipOrders\}/);
  assert.match(source, /selectedRowId=\{selectedShipOrderNo \?\? undefined\}/);
  assert.match(source, /getRowId=\{\(row\) => row\.shipOrderNo\}/);
  assert.match(source, /onRowClick=\{openBoxScanForOrder\}/);
  assert.match(source, /initialShipOrderNo=\{selectedShipOrderNo \?\? undefined\}/);
});
