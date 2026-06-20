import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");

test("shipping order page prints registered order with 2d barcode", () => {
  assert.match(source, /import\s+QRCode\s+from\s+["']react-qr-code["']/, "print form should use a 2D QR barcode renderer");
  assert.match(source, /Printer/, "registered rows should expose a print action");
  assert.match(source, /handlePrintShipOrder/, "print action should use an explicit ship-order print handler");
  assert.match(source, /window\.print\(\)/, "print handler should invoke browser print");
  assert.match(source, /<QRCode[\s\S]*value=\{printTarget\.shipOrderNo\}/, "printed form should encode shipOrderNo as the 2D barcode value");
  assert.match(source, /printTarget\.shipOrderNo/, "printed form should render the ship order number as text");
  assert.match(source, /ship-order-print-root/, "printed form should be isolated from the screen layout");
  assert.match(source, /@media print/, "print styles should only expose the printable ship-order form");
});
