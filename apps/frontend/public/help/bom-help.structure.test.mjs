import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const userHelp = readFileSync("apps/frontend/public/help/user/ko/MST_BOM.md", "utf8");
const operatorHelp = readFileSync("apps/frontend/public/help/operator/ko/MST_BOM.md", "utf8");
const pageSource = readFileSync("apps/frontend/src/app/(authenticated)/master/bom/page.tsx", "utf8");
const bomTabSource = readFileSync("apps/frontend/src/app/(authenticated)/master/bom/components/BomTab.tsx", "utf8");
const serviceSource = readFileSync("apps/backend/src/modules/master/services/bom.service.ts", "utf8");

const requiredUserPhrases = [
  "## 버튼별 기능",
  "## 업무 흐름",
  "## 엑셀 업로드 흐름",
  "적용일",
  "완료일",
  "리비전",
  "상위품목 + 자품목 + 적용일",
  "폼 다운로드",
  "엑셀 업로드",
  "기준일",
  "전체이력",
  "내보내기",
  "BOM 추가",
  "라우팅이동",
];

const requiredOperatorPhrases = [
  "## 버튼·API·상태 전이",
  "## 중복 판정 로직",
  "BOM_MASTERS",
  "COMPANY + PLANT_CD + PARENT_ITEM_CODE + CHILD_ITEM_CODE + VALID_FROM",
  "POST /master/boms",
  "PUT /master/boms/:id",
  "DELETE /master/boms/:id",
  "POST /master/boms/upload/preview",
  "POST /master/boms/upload",
  "GET /master/boms/hierarchy/:parentItemCode",
  "리비전은 이 판정에 관여하지 않는다",
];

test("MST_BOM user help explains actual buttons and work flow", () => {
  assert.match(userHelp, /^---\nmenuCode: MST_BOM\n/);
  for (const phrase of requiredUserPhrases) {
    assert.ok(userHelp.includes(phrase), `missing user help phrase: ${phrase}`);
  }
});

test("MST_BOM operator help maps buttons to APIs and documents validFrom-based key", () => {
  assert.match(operatorHelp, /^---\nmenuCode: MST_BOM\n/);
  for (const phrase of requiredOperatorPhrases) {
    assert.ok(operatorHelp.includes(phrase), `missing operator help phrase: ${phrase}`);
  }
});

test("MST_BOM help does not describe revision as the row key (stale pre-2026-07-03 behavior)", () => {
  const staleRevisionKeyPhrases = [
    "부모+자품목+리비전",
    "상위+자품목+리비전",
    "PARENT_ITEM_CODE + CHILD_ITEM_CODE + REVISION",
  ];
  for (const phrase of staleRevisionKeyPhrases) {
    assert.ok(!userHelp.includes(phrase), `stale revision-key phrasing leaked into user help: ${phrase}`);
    assert.ok(!operatorHelp.includes(phrase), `stale revision-key phrasing leaked into operator help: ${phrase}`);
  }
});

test("MST_BOM help does not contain generic template text", () => {
  const forbidden = [
    "조회 조건**: 기간, 상태, 품목, 바코드, 담당자",
    "문서번호(no)",
    "담당자(workerCode)",
  ];
  for (const phrase of forbidden) {
    assert.ok(!userHelp.includes(phrase), `generic help text leaked into user help: ${phrase}`);
  }
});

test("MST_BOM source still exposes the actions and API routes documented by help", () => {
  for (const sourceToken of [
    "master.bom.excelUpload",
    "master.bom.downloadTemplate",
    "master.bom.effectiveLookup",
    "master.bom.allHistoryLookup",
    "/master/boms/parents",
    "/master/boms/template",
  ]) {
    assert.ok(pageSource.includes(sourceToken), `documented source token missing from page.tsx: ${sourceToken}`);
  }
  for (const sourceToken of ["master.bom.addBom", "master.bom.expandAll", "master.bom.collapseAll"]) {
    assert.ok(bomTabSource.includes(sourceToken), `documented source token missing from BomTab.tsx: ${sourceToken}`);
  }
  for (const sourceToken of [
    "동일 상위·하위 품목에 같은 적용일자의 BOM이 이미 존재합니다",
    "toDateOnly",
  ]) {
    assert.ok(serviceSource.includes(sourceToken), `documented source token missing from bom.service.ts: ${sourceToken}`);
  }
});
