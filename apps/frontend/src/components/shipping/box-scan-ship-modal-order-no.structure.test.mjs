import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import test from "node:test";

const source = readFileSync(new URL("./BoxScanShipModal.tsx", import.meta.url), "utf8");

test("box scan ship modal renders the loaded ship order number in the order summary", () => {
  assert.match(source, /order\.shipOrderNo/);
  assert.match(source, /font-mono[\s\S]*order\.shipOrderNo/);
  assert.match(source, /shipping\.boxScan\.shipOrderNo/);

  const summaryIndex = source.indexOf("order.shipOrderNo");
  const boxInputIndex = source.indexOf("shipping.boxScan.boxNo");
  assert.ok(summaryIndex > -1, "loaded order number should be rendered");
  assert.ok(boxInputIndex > -1, "box scan input should still exist");
  assert.ok(summaryIndex < boxInputIndex, "loaded order number should appear before box scan input");
});

test("box scan ship modal keeps the ship-box API tied to the loaded order", () => {
  assert.match(source, /api\.post\(`\/shipping\/orders\/\$\{encodeURIComponent\(order\.shipOrderNo\)\}\/ship-box`/);
  assert.match(source, /api\.post\(`\/shipping\/orders\/\$\{encodeURIComponent\(order\.shipOrderNo\)\}\/cancel-ship-box`/);
});
