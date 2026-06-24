import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const pageSource = fs.readFileSync("apps/frontend/src/app/(authenticated)/workflow/page.tsx", "utf8");
const mapSource = fs.readFileSync("apps/frontend/src/config/workflowMap.ts", "utf8");

test("/workflow renders an interactive React Flow business map", () => {
  assert.match(pageSource, /@xyflow\/react/);
  assert.match(pageSource, /ReactFlow/);
  assert.match(pageSource, /Controls/);
  assert.match(pageSource, /Background/);
});

test("/workflow is static business guidance, not a live count dashboard", () => {
  assert.doesNotMatch(pageSource, /\/workflow\/summary/);
  assert.doesNotMatch(pageSource, /pendingCnt|activeCnt|doneCnt|reverseCnt/);
  assert.doesNotMatch(pageSource, /업무 활동\s*\{workflowNodes\.length\}/);
  assert.doesNotMatch(pageSource, /스윔레인\s*\{workflowLanes\.length\}/);
  assert.match(pageSource, /workflowNodes/);
  assert.match(pageSource, /workflowEdges/);
  assert.match(mapSource, /workflowLanes/);
});

test("/workflow keeps secondary relations out of the default visual noise", () => {
  assert.match(pageSource, /showAllRelations/);
  assert.match(pageSource, /보조 연결 보기/);
  assert.match(pageSource, /edge\.kind === "normal" \|\| edge\.kind === "branch"/);
});

test("/workflow uses swimlanes and business activity nodes", () => {
  assert.match(mapSource, /구매\/입하/);
  assert.match(mapSource, /자재\/IQC/);
  assert.match(mapSource, /추적\/역처리/);
  assert.match(mapSource, /activity/);
  assert.match(mapSource, /dataObjects/);
  assert.match(mapSource, /routes/);
});

test("/workflow shows input kiosk as the production floor start point", () => {
  assert.match(mapSource, /id: "input-kiosk-start"/);
  assert.match(mapSource, /activity: "조립실적\(키오스크\)"/);
  assert.match(mapSource, /path: "\/production\/input-kiosk"/);
  assert.match(mapSource, /source: "job-order", target: "input-kiosk-start", label: "현장 시작"/);
  assert.doesNotMatch(mapSource, /source: "job-order", target: "subprocess-kitting"/);
});

test("/workflow has a right-side detail panel and explicit route navigation", () => {
  assert.match(pageSource, /selectedNode/);
  assert.match(pageSource, /data-workflow-detail-panel/);
  assert.match(pageSource, /router\.push/);
  assert.match(pageSource, /관련 화면/);
  assert.match(pageSource, /생성\/변경 데이터/);
});

test("/workflow map carries onboarding guide fields and helpers", () => {
  assert.match(mapSource, /why\?: string/);
  assert.match(mapSource, /cautions\?: string\[\]/);
  assert.match(mapSource, /export function getNodesByLane/);
  assert.match(mapSource, /export function getVisibleNodeIds/);
  assert.match(mapSource, /export function getPreviousNodes/);
  assert.match(mapSource, /export function getNextNodes/);
  // 주 흐름 노드 본문 작성 확인
  assert.match(mapSource, /입하의 출처가 되는 구매 근거/);
  assert.match(mapSource, /작업지시를 현장에서 스캔해 실제 생산 실행을 시작/);
});
