import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import test from "node:test";

const source = readFileSync(new URL("./BoxScanShipModal.tsx", import.meta.url), "utf8");

test("box scan ship modal accepts an initial ship order number and auto loads it", () => {
  assert.match(source, /initialShipOrderNo\?: string/);
  assert.match(source, /BoxScanShipModal\(\{ isOpen, onClose, onShipped, initialShipOrderNo \}/);
  assert.match(source, /if \(!isOpen \|\| !initialShipOrderNo\) return/);
  assert.match(source, /setOrderNoInput\(initialShipOrderNo\)/);
  assert.match(source, /loadOrder\(initialShipOrderNo\)/);
  assert.match(source, /\{!initialShipOrderNo && \(/);
});
