import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const workflow = fs.readFileSync('apps/frontend/src/app/(authenticated)/inspection/result/components/InspectionResultWorkflow.tsx', 'utf8');
const equipMaster = fs.readFileSync('apps/frontend/src/app/(authenticated)/master/equip/components/EquipMasterTab.tsx', 'utf8');

test('inspection workflow requests testers for its own inspection type', () => {
  assert.match(workflow, /get\("\/equipment\/equips\/type\/TESTER", \{ params: \{ inspectType \} \}\)/);
});

test('equipment master manages inspection type as a common-code selection', () => {
  assert.match(equipMaster, /inspectType: string/);
  assert.match(equipMaster, /groupCode="INSPECT_TYPE"/);
  assert.match(equipMaster, /inspectType: form\.equipType === "TESTER" \? form\.inspectType \|\| null : null/);
});
