import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const userHelp = readFileSync("apps/frontend/public/help/user/ko/SHIP_ORDER.md", "utf8");
const operatorHelp = readFileSync("apps/frontend/public/help/operator/ko/SHIP_ORDER.md", "utf8");
const pageSource = readFileSync(
  "apps/frontend/src/app/(authenticated)/shipping/order/page.tsx",
  "utf8",
);

const requiredUserPhrases = [
  "## 버튼별 기능",
  "## 업무 흐름",
  "## 입력 규칙 / 검증",
  "## 자주 묻는 질문",
  "출하지시번호",
  "고객 PO번호",
  "출하일",
  "납기일",
  "확정취소",
  "저장 후 확정",
  "DRAFT",
  "CONFIRMED",
  "기간 밖",
];

const requiredOperatorPhrases = [
  "## 버튼·API·상태 전이",
  "## 문제 해결 (트러블슈팅)",
  "GET /shipping/orders",
  "POST /shipping/orders",
  "PUT /shipping/orders/:id/confirm",
  "PUT /shipping/orders/:id/unconfirm",
  "DELETE /shipping/orders/:id",
  "SHIPMENT_ORDERS",
  "SHIPMENT_ORDER_ITEMS",
  "DRAFT",
  "CONFIRMED",
  "includeOpen",
];

test("SHIP_ORDER user help has required sections and phrases", () => {
  assert.match(userHelp, /^---\nmenuCode: SHIP_ORDER\n/);
  for (const phrase of requiredUserPhrases) {
    assert.ok(userHelp.includes(phrase), `missing user help phrase: ${phrase}`);
  }
});

test("SHIP_ORDER operator help maps buttons to APIs and DB effects", () => {
  assert.match(operatorHelp, /^---\nmenuCode: SHIP_ORDER\n/);
  for (const phrase of requiredOperatorPhrases) {
    assert.ok(operatorHelp.includes(phrase), `missing operator help phrase: ${phrase}`);
  }
});

test("SHIP_ORDER help does not contain generic template text", () => {
  const forbidden = [
    "문서번호(no)",
    "바코드(barcode)",
    "판정(result)",
    "담당자(workerCode)",
    "처리일시(processedAt)",
    "조회 조건**: 기간, 상태, 품목, 바코드, 담당자",
    "고객/품목/출하일 기준 출하지시를 등록하고 확정합니다.에서 대상 식별",
  ];
  for (const phrase of forbidden) {
    assert.ok(!userHelp.includes(phrase), `generic template text in user help: ${phrase}`);
    assert.ok(!operatorHelp.includes(phrase), `generic template text in operator help: ${phrase}`);
  }
});

test("SHIP_ORDER source still exposes the actions documented by help", () => {
  for (const token of [
    "/shipping/orders",
    "/confirm",
    "/unconfirm",
    "includeOpen",
    "DRAFT",
    "CONFIRMED",
    "handleSaveAndConfirm",
    "handleUnconfirmOrder",
    "window.print",
  ]) {
    assert.ok(pageSource.includes(token), `documented source token missing: ${token}`);
  }
});
