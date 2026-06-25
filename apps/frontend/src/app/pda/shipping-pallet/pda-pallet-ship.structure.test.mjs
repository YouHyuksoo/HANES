import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const page = fs.readFileSync("apps/frontend/src/app/pda/shipping-pallet/page.tsx", "utf8");
const hook = fs.readFileSync("apps/frontend/src/hooks/pda/usePalletShipScan.ts", "utf8");
const menu = fs.readFileSync("apps/frontend/src/components/pda/pdaMenuConfig.ts", "utf8");

test("PDA pallet ship page wires the scan workflow", () => {
  assert.match(page, /usePalletShipScan/);
  assert.match(page, /useBarcodeDetector/);
  assert.match(page, /handleScanBox/);
  assert.match(page, /handleClosePallet/);
  assert.match(page, /handleShipPallet/);
});

test("hook calls the existing desktop pallet endpoints (no new backend)", () => {
  assert.match(hook, /\/fulfillment/);
  assert.match(hook, /\/pallets`/);
  assert.match(hook, /\/pallets\/\$\{encodeURIComponent\(pallet\.palletNo\)\}\/boxes/);
  assert.match(hook, /\/close`/);
  assert.match(hook, /\/ship-pallets`/);
});

test("PDA menu registers the pallet ship entry", () => {
  assert.match(menu, /PDA_PALLET_SHIP/);
  assert.match(menu, /\/pda\/shipping-pallet/);
});
