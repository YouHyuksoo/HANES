import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const userHelp = readFileSync("apps/frontend/public/help/user/ko/PROD_RECEIVE.md", "utf8");
const operatorHelp = readFileSync("apps/frontend/public/help/operator/ko/PROD_RECEIVE.md", "utf8");
const pageSource = readFileSync("apps/frontend/src/app/(authenticated)/product/receive/page.tsx", "utf8");
const panelSource = readFileSync(
  "apps/frontend/src/app/(authenticated)/product/receive/components/ReceivablePanel.tsx",
  "utf8",
);
const useBoxReceiveSource = readFileSync(
  "apps/frontend/src/app/(authenticated)/product/receive/components/useBoxReceive.ts",
  "utf8",
);

const requiredUserPhrases = [
  "## 버튼별 기능",
  "## 업무 흐름",
  "## 입력 규칙 / 검증",
  "## 자주 묻는 질문",
  "박스 스캔",
  "입고창고",
  "박스번호",
  "FG_IN",
  "FG_IN_CANCEL",
  "PACKED_WAITING",
  "이중입고",
];

const requiredOperatorPhrases = [
  "## 버튼·API·상태 전이",
  "## 문제 해결 (트러블슈팅)",
  "GET /inventory/product/transactions",
  "GET /shipping/box-stock",
  "POST /inventory/fg/receive",
  "PRODUCT_TRANSACTIONS",
  "PRODUCT_STOCKS",
  "FG_LABELS",
  "PACKED_WAITING",
  "WAREHOUSE_RECEIVED",
  "순차 처리",
];

test("PROD_RECEIVE user help has required sections and phrases", () => {
  assert.match(userHelp, /^---\nmenuCode: PROD_RECEIVE\n/);
  for (const phrase of requiredUserPhrases) {
    assert.ok(userHelp.includes(phrase), `missing user help phrase: ${phrase}`);
  }
});

test("PROD_RECEIVE operator help maps buttons to APIs and DB effects", () => {
  assert.match(operatorHelp, /^---\nmenuCode: PROD_RECEIVE\n/);
  for (const phrase of requiredOperatorPhrases) {
    assert.ok(operatorHelp.includes(phrase), `missing operator help phrase: ${phrase}`);
  }
});

test("PROD_RECEIVE help does not contain generic template text", () => {
  const forbidden = [
    "문서번호(no)",
    "바코드(barcode)",
    "판정(result)",
    "담당자(workerCode)",
    "처리일시(processedAt)",
    "조회 조건**: 기간, 상태, 품목, 바코드, 담당자",
    "저장·정정 시 PRODUCT_STOCKS 및 조인 테이블의 실제 컬럼을 함께 확인합니다",
  ];
  for (const phrase of forbidden) {
    assert.ok(!userHelp.includes(phrase), `generic template text in user help: ${phrase}`);
    assert.ok(!operatorHelp.includes(phrase), `generic template text in operator help: ${phrase}`);
  }
});

test("PROD_RECEIVE source still exposes the actions documented by help", () => {
  for (const token of [
    "/inventory/product/transactions",
    "FG_IN,FG_IN_CANCEL",
  ]) {
    assert.ok(pageSource.includes(token), `documented page source token missing: ${token}`);
  }
  for (const token of [
    "/shipping/box-stock",
    "PACKED_WAITING",
    "receiveBoxes",
  ]) {
    assert.ok(panelSource.includes(token), `documented panel source token missing: ${token}`);
  }
  assert.ok(
    useBoxReceiveSource.includes("/inventory/fg/receive"),
    "documented useBoxReceive source token missing: /inventory/fg/receive",
  );
});
