import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const pageSource = fs.readFileSync("apps/frontend/src/app/(authenticated)/workflow/page.tsx", "utf8");
const mapSource = fs.readFileSync("apps/frontend/src/config/workflowMap.ts", "utf8");
const flowSource = fs.readFileSync(
  "apps/frontend/src/app/(authenticated)/workflow/components/WorkflowFlow.tsx",
  "utf8",
);
const guideSource = fs.readFileSync(
  "apps/frontend/src/app/(authenticated)/workflow/components/WorkflowGuide.tsx",
  "utf8",
);

test("/workflow renders an interactive React Flow business map", () => {
  assert.match(flowSource, /@xyflow\/react/);
  assert.match(flowSource, /ReactFlow/);
  assert.match(flowSource, /Controls/);
  assert.match(flowSource, /Background/);
});

test("/workflow is static business guidance, not a live count dashboard", () => {
  assert.doesNotMatch(pageSource, /\/workflow\/summary/);
  assert.doesNotMatch(pageSource, /pendingCnt|activeCnt|doneCnt|reverseCnt/);
  assert.match(flowSource, /workflowNodes/);
  assert.match(flowSource, /workflowEdges/);
  assert.match(mapSource, /workflowLanes/);
});

test("/workflow keeps secondary relations out of the default visual noise", () => {
  assert.match(flowSource, /showAllRelations/);
  assert.match(flowSource, /보조 연결 보기/);
  assert.match(flowSource, /\.kind === "normal" \|\| \w+\.kind === "branch"/);
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

test("/workflow has a guide hub with tabs, sidebar and inline help", () => {
  assert.match(pageSource, /selectedNodeId/);
  assert.match(pageSource, /data-workflow-detail-panel/);
  assert.match(pageSource, /WorkflowSidebar/);
  assert.match(pageSource, /WorkflowGuide/);
  assert.match(pageSource, /WorkflowFlow/);
  assert.match(pageSource, /가이드/);
  assert.match(pageSource, /흐름도/);
  assert.match(guideSource, /router\.push/);
  assert.match(guideSource, /화면 바로가기/);
  assert.match(guideSource, /관련 화면 도움말/);
  assert.match(guideSource, /왜 하는가/);
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
