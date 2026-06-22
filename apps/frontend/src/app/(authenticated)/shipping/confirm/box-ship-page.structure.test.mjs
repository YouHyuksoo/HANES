import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import test from "node:test";

const source = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");

test("box ship page reuses BoxScanShipModal and ship-order fulfillment", () => {
  // 박스 스캔 출하 모달 재사용
  assert.match(source, /BoxScanShipModal/);
  assert.match(source, /initialShipOrderNo=\{selectedOrderNo/);
  // 출하지시 기준 데이터 소스
  assert.match(source, /\/shipping\/orders/);
  assert.match(source, /\/fulfillment/);
  assert.match(source, /box-stock\//);
  // 팔레트/Shipment 잔재 제거
  assert.doesNotMatch(source, /OrderFulfillmentModal/);
  assert.doesNotMatch(source, /ShipmentScanModal/);
  assert.doesNotMatch(source, /\/shipping\/shipments/);
});
