import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const userHelp = readFileSync("apps/frontend/public/help/user/ko/SHIP_PALLET.md", "utf8");
const operatorHelp = readFileSync("apps/frontend/public/help/operator/ko/SHIP_PALLET.md", "utf8");
const pageSource = readFileSync(
  "apps/frontend/src/app/(authenticated)/shipping/pallet/page.tsx",
  "utf8",
);

const requiredUserPhrases = [
  "## 버튼별 기능",
  "## 업무 흐름",
  "## 입력 규칙 / 검증",
  "## 자주 묻는 질문",
  "팔레트번호",
  "박스추가",
  "마감",
  "재오픈",
  "라벨출력",
  "빈팔레트삭제",
  "OPEN",
  "CLOSED",
  "OQC",
  "기간 밖",
  "출하지시번호",
];

const requiredOperatorPhrases = [
  "## 버튼·API·상태 전이",
  "## 문제 해결 (트러블슈팅)",
  "GET /shipping/pallets",
  "POST /shipping/orders/{shipOrderNo}/pallets",
  "POST /shipping/orders/{shipOrderNo}/pallets/{palletNo}/boxes",
  "DELETE /shipping/orders/{shipOrderNo}/pallets/{palletNo}/boxes",
  "POST /shipping/orders/{shipOrderNo}/pallets/{palletNo}/close",
  "POST /shipping/pallets/{palletNo}/reopen",
  "DELETE /shipping/pallets/{palletNo}",
  "PALLET_MASTERS",
  "BOX_MASTERS",
  "OQC_ENABLED",
  "includeOpen",
];

test("SHIP_PALLET user help has required sections and phrases", () => {
  assert.match(userHelp, /^---\nmenuCode: SHIP_PALLET\n/);
  for (const phrase of requiredUserPhrases) {
    assert.ok(userHelp.includes(phrase), `missing user help phrase: ${phrase}`);
  }
});

test("SHIP_PALLET operator help maps buttons to APIs and DB effects", () => {
  assert.match(operatorHelp, /^---\nmenuCode: SHIP_PALLET\n/);
  for (const phrase of requiredOperatorPhrases) {
    assert.ok(operatorHelp.includes(phrase), `missing operator help phrase: ${phrase}`);
  }
});

test("SHIP_PALLET help does not contain generic template text", () => {
  const forbidden = [
    "문서번호(no)",
    "바코드(barcode)",
    "판정(result)",
    "담당자(workerCode)",
    "처리일시(processedAt)",
    "조회 조건**: 기간, 상태, 품목, 바코드, 담당자",
    "출하지시 기준 팔레트 생성, 박스 적재, 마감, 재오픈을 처리합니다.에서 대상 식별",
  ];
  for (const phrase of forbidden) {
    assert.ok(!userHelp.includes(phrase), `generic template text in user help: ${phrase}`);
    assert.ok(!operatorHelp.includes(phrase), `generic template text in operator help: ${phrase}`);
  }
});

test("SHIP_PALLET source still exposes the actions documented by help", () => {
  for (const token of [
    "/shipping/pallets",
    "/shipping/orders",
    "/boxes",
    "/close",
    "/reopen",
    "includeOpen",
    "OPEN",
    "CLOSED",
    "OQC_ENABLED",
    "handleClosePallet",
    "handleReopenPallet",
    "handleDeletePallet",
    "handleAssignBoxes",
    "handleRemoveBox",
  ]) {
    assert.ok(pageSource.includes(token), `documented source token missing: ${token}`);
  }
});
