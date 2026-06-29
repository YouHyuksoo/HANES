import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const userHelp = readFileSync("apps/frontend/public/help/user/ko/SHIP_PACK.md", "utf8");
const operatorHelp = readFileSync("apps/frontend/public/help/operator/ko/SHIP_PACK.md", "utf8");
const pageSource = readFileSync("apps/frontend/src/app/(authenticated)/shipping/pack/page.tsx", "utf8");

const requiredUserPhrases = [
  "## 버튼별 기능",
  "## 업무 흐름",
  "포장 대기",
  "박스 생성",
  "제품 담기",
  "시리얼 추가",
  "시리얼 제거",
  "포장 완료 · 라벨 출력",
  "박스 마감",
  "박스 재오픈",
  "라벨 재발행",
  "빈 박스 삭제",
  "OPEN",
  "CLOSED",
];

const requiredOperatorPhrases = [
  "## 버튼·API·상태 전이",
  "GET /shipping/boxes",
  "GET /shipping/boxes/packable-serials",
  "POST /shipping/boxes { itemCode }",
  "POST /shipping/boxes/:boxNo/serials",
  "DELETE /shipping/boxes/:boxNo/serials",
  "POST /shipping/boxes/:boxNo/close",
  "POST /shipping/boxes/:boxNo/reopen",
  "DELETE /shipping/boxes/:boxNo",
  "BOX_MASTERS",
  "FG_LABELS",
  "OQC_REQUESTS",
];

test("SHIP_PACK user help explains actual buttons and work flow", () => {
  assert.match(userHelp, /^---\nmenuCode: SHIP_PACK\n/);
  for (const phrase of requiredUserPhrases) {
    assert.ok(userHelp.includes(phrase), `missing user help phrase: ${phrase}`);
  }
});

test("SHIP_PACK operator help maps buttons to APIs and state transitions", () => {
  assert.match(operatorHelp, /^---\nmenuCode: SHIP_PACK\n/);
  for (const phrase of requiredOperatorPhrases) {
    assert.ok(operatorHelp.includes(phrase), `missing operator help phrase: ${phrase}`);
  }
});

test("SHIP_PACK help does not contain generic template columns", () => {
  const forbidden = [
    "문서번호(no)",
    "바코드(barcode)",
    "판정(result)",
    "담당자(workerCode)",
    "처리일시(processedAt)",
    "조회 조건**: 기간, 상태, 품목, 바코드, 담당자",
  ];
  for (const phrase of forbidden) {
    assert.ok(!userHelp.includes(phrase), `generic help text leaked into user help: ${phrase}`);
  }
});

test("SHIP_PACK source still exposes the actions documented by help", () => {
  for (const sourceToken of [
    "shipping.pack.waitingTitle",
    "shipping.pack.createBox",
    "shipping.pack.packProducts",
    "shipping.pack.closeBox",
    "shipping.pack.reopenBox",
    "shipping.pack.reprintLabel",
    "shipping.pack.deleteEmptyBox",
    "shipping.pack.completeAndPrint",
    "/shipping/boxes/packable-serials",
    "/shipping/boxes/${selectedBox.boxNo}/serials",
    "/shipping/boxes/${box.boxNo}/close",
    "/shipping/boxes/${box.boxNo}/reopen",
  ]) {
    assert.ok(pageSource.includes(sourceToken), `documented source token missing: ${sourceToken}`);
  }
});
