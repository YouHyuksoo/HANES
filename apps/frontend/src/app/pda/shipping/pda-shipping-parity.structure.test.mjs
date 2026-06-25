import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const page = fs.readFileSync("apps/frontend/src/app/pda/shipping/page.tsx", "utf8");
const panel = fs.readFileSync("apps/frontend/src/app/pda/shipping/components/ShippingProgressPanel.tsx", "utf8");
const hook = fs.readFileSync("apps/frontend/src/hooks/pda/useShippingScan.ts", "utf8");

test("PDA box shipping uses the same order-centric ship/cancel APIs as desktop", () => {
  assert.match(hook, /\/shipping\/orders\/\$\{encodeURIComponent\(scannedOrder\.shipOrderNo\)\}\/ship-box/);
  assert.match(hook, /\/shipping\/orders\/\$\{encodeURIComponent\(scannedOrder\.shipOrderNo\)\}\/cancel-ship-box/);
  assert.doesNotMatch(hook, /\/shipments\/.*mark-shipped/);
  assert.doesNotMatch(hook, /\/shipping\/pallets\/.*mark-shipped/);
});

test("PDA box shipping exposes reverse transition for scanned boxes", () => {
  assert.match(page, /handleCancelBox/);
  assert.match(panel, /onCancelBox/);
  assert.match(panel, /pda\.shipping\.cancelBox/);
});

test("PDA box shipping does not ask for a second server-side confirmation after immediate ship", () => {
  assert.doesNotMatch(page, /label: t\("pda\.shipping\.confirmShip"\)/);
  assert.match(page, /label: t\("pda\.shipping\.nextOrder"/);
});
