import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

/**
 * 통전·단자검사 화면(InspectionResultWorkflow)도 가공 키오스크와 같은 설비정지/관리자호출을 갖는다.
 * - 훅·버튼·모달은 input-kiosk 것을 그대로 쓴다(복제 금지).
 * - 정지 중이면 판정 버튼을 막고(prep.ready=false) 빨간 배너로 알린다. 서버도 같은 게이트를 가진다.
 */
const here = import.meta.dirname;
const workflow = readFileSync(resolve(here, "components/InspectionResultWorkflow.tsx"), "utf8");
const backend = readFileSync(resolve(here, "../../../../../../backend/src/modules/quality/continuity-inspect/services/continuity-inspect.service.ts"), "utf8");

test("검사 화면은 키오스크의 설비정지/관리자호출 훅·버튼·모달을 재사용한다", () => {
  assert.match(workflow, /import \{ useEquipStop, formatElapsed \} from "@\/app\/\(authenticated\)\/production\/input-kiosk\/hooks\/useEquipStop"/);
  assert.match(workflow, /import EquipActionButtons from "@\/app\/\(authenticated\)\/production\/input-kiosk\/components\/EquipActionButtons"/);
  assert.match(workflow, /import EquipStopModal from "@\/app\/\(authenticated\)\/production\/input-kiosk\/components\/EquipStopModal"/);
  assert.match(workflow, /import ManagerCallModal from "@\/app\/\(authenticated\)\/production\/input-kiosk\/components\/ManagerCallModal"/);
  // 설비·작업지시 기준으로 훅을 건다(경과시간은 서버 기준)
  assert.match(workflow, /useEquipStop\(selectedEquipCode \|\| null, selected\?\.orderNo \?\? null\)/);
  // 버튼은 우측 컬럼 맨 아래, 설비 없으면 잠김
  assert.match(workflow, /<EquipActionButtons\s+hasEquip=\{Boolean\(selectedEquipCode\)\}/);
  assert.match(workflow, /<EquipStopModal[\s\S]{0,700}onRelease=\{equipStop\.releaseStop\}/);
  assert.match(workflow, /<ManagerCallModal[\s\S]{0,500}onCall=\{equipStop\.createCall\}/);
});

test("정지 중이면 판정을 막고 배너를 띄운다", () => {
  assert.match(workflow, /equipStop\.isStopped\s*\?\s*\{ \.\.\.prep, ready: false, blockReason: t\("kiosk\.equipStop\.blockReason"/);
  assert.match(workflow, /<InspectPanel[\s\S]{0,300}prep=\{inspectPrep\}/);
  assert.match(workflow, /data-testid="kiosk-stop-banner"/);
  assert.match(workflow, /kiosk\.equipStop\.banner/);
});

test("서버 검사 등록 게이트도 진행중 정지를 가장 먼저 막는다", () => {
  assert.match(backend, /private readonly equipStopService: EquipStopService/);
  assert.match(backend, /if \(!equipCode\) return;\s*await this\.assertEquipNotStopped\(equipCode, company, plant\);\s*await this\.assertWorkerAssigned/);
  assert.match(backend, /설비가 정지 중입니다\. 정지를 해제한 뒤 검사를 등록하세요\./);
  // 준비 상태 조회도 정지를 ready=false 로 반영한다
  assert.match(backend, /ready: Boolean\(equipCode\) && !stopped && !gate\.blocked/);
});
