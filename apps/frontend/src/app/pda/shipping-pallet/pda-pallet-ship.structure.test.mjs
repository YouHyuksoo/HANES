import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const buildPage = fs.readFileSync("apps/frontend/src/app/pda/shipping-pallet/page.tsx", "utf8");
const shipPage = fs.readFileSync("apps/frontend/src/app/pda/pallet-ship/page.tsx", "utf8");
const buildHook = fs.readFileSync("apps/frontend/src/hooks/pda/usePalletShipScan.ts", "utf8");
const shipHook = fs.readFileSync("apps/frontend/src/hooks/pda/usePalletShipByScan.ts", "utf8");
const menu = fs.readFileSync("apps/frontend/src/components/pda/pdaMenuConfig.ts", "utf8");

test("PDA pallet BUILD screen builds pallets (create/scan/close, no ship)", () => {
  assert.match(buildPage, /usePalletShipScan/);
  assert.match(buildPage, /handleCreatePallet/);
  assert.match(buildPage, /handleScanBox/);
  assert.match(buildPage, /handleClosePallet/);
  // 구성 화면에는 출하 버튼/핸들러가 없어야 한다(출하는 별도 화면)
  assert.doesNotMatch(buildPage, /handleShipPallet/);
});

test("build hook calls the existing desktop pallet endpoints (no new backend)", () => {
  assert.match(buildHook, /\/fulfillment/);
  assert.match(buildHook, /\/pallets`/);
  assert.match(buildHook, /\/pallets\/\$\{encodeURIComponent\(pallet\.palletNo\)\}\/boxes/);
  assert.match(buildHook, /\/close`/);
  assert.doesNotMatch(buildHook, /\/ship-pallets`/, "pallet build hook should not ship pallets");
});

test("PDA pallet SHIP screen ships a scanned CLOSED pallet", () => {
  assert.match(shipPage, /usePalletShipByScan/);
  assert.match(shipPage, /handleScanPallet/);
  assert.match(shipPage, /handleShip\b/);
  assert.match(shipHook, /\/pallets\/pallet-no\//);
  assert.match(shipHook, /\/ship-pallets`/);
});

test("PDA menu registers both pallet build and ship entries", () => {
  assert.match(menu, /PDA_PALLET_BUILD/);
  assert.match(menu, /PDA_PALLET_SHIP/);
  assert.match(menu, /\/pda\/shipping-pallet/);
  assert.match(menu, /\/pda\/pallet-ship/);
});
