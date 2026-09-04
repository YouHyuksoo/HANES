import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

// 상태 컬럼 헤더 도움말은 화면별 문구 상수가 아니라 공통 StatusHeaderHelp(공통코드 SHIP_ORDER_STATUS 전체 값+의미 자동 나열)를 쓴다.
const columns = readFileSync(new URL("./shippingOrderColumns.tsx", import.meta.url), "utf8");
const page = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");

test("ship order grid status column exposes the common comCode help header", () => {
  assert.match(columns, /import StatusHeaderHelp from "@\/components\/shared\/StatusHeaderHelp"/);
  assert.match(columns, /accessorKey: "status",\s*header: \(\) => <StatusHeaderHelp label=\{t\("common\.status"\)\} codeType="SHIP_ORDER_STATUS"/);
  assert.match(columns, /<ComCodeBadge groupCode="SHIP_ORDER_STATUS"/);
  // 화면별 상태 설명 사전을 새로 만들지 않는다(i18n comCode.SHIP_ORDER_STATUS 단일 출처)
  assert.doesNotMatch(page, /shipOrderStatusHelpText|ShipOrderStatusHeader/);
});

test("ship order open/closed judgement comes from the shared rule, not a hardcoded status", () => {
  assert.match(page, /import \{ isShipOrderOpen \} from "@harness\/shared"/);
  assert.match(page, /isShipOrderOpen\(o\.status\)/);
  assert.doesNotMatch(page, /o\.status !== "SHIPPED"/);
});
