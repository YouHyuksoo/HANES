import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import test from "node:test";

const source = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");

test("ship cancel page wires shipped history, detail, and order cancel", () => {
  // 통합 출하이력 + 상세 + 취소 엔드포인트
  assert.match(source, /\/shipping\/orders\/shipped/);
  assert.match(source, /shipped-detail/);
  assert.match(source, /cancel-shipment/);
  // 박스출하 팔레트번호 * 표기
  assert.match(source, /'\*'|"\*"/);
  // 취소이력 보기(기존 returns 재사용)
  assert.match(source, /\/shipping\/returns/);
  // 기존 수동 반품 CRUD 제거
  assert.doesNotMatch(source, /api\.post\("\/shipping\/returns"/);
  assert.doesNotMatch(source, /api\.put\(`\/shipping\/returns/);
  assert.doesNotMatch(source, /api\.delete\(`\/shipping\/returns/);
});
