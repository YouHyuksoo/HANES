import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");

test("pallet ship center grid status column exposes detailed transition help", () => {
  assert.match(source, /HelpCircle/, "status header should use a question help icon");
  assert.match(source, /const palletShipStatusHelpText/, "page should define pallet ship status help text");
  for (const status of ["OPEN", "CLOSED", "LOADED", "SHIPPED"]) {
    assert.match(source, new RegExp(`${status}:\\s*[^\\n]`), `${status} should be explained`);
  }
  assert.match(source, /OPEN -> CLOSED -> SHIPPED/, "help should explain the pallet-ship transition");
  assert.match(source, /header:\s*\(\)\s*=>\s*<PalletShipStatusHeader/, "status column should use a help header");
});

test("pallet ship center grid shows a normalized shipment number", () => {
  assert.match(source, /interface OrderPalletRow extends OrderPallet/, "grid should use a row type with normalized shipment number");
  assert.match(source, /const palletRows = useMemo/, "page should compute display rows for the center grid");
  assert.match(source, /shipmentNo: p\.shipmentId \?\? fallbackShipmentNo/, "shipment number should prefer pallet shipmentId and fall back to fulfillment shipment");
  assert.match(source, /accessorKey: "shipmentNo", header: "출하번호"/, "grid should display shipmentNo instead of raw shipmentId");
  assert.match(source, /p\.status === "SHIPPED" \? "확인필요" : "출하 전"/, "empty shipment number should explain whether it is pre-shipment or needs checking");
});
