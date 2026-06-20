import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const types = fs.readFileSync('apps/frontend/src/app/(authenticated)/master/routing/types.ts', 'utf8');
const manager = fs.readFileSync('apps/frontend/src/app/(authenticated)/master/routing/components/RoutingGroupManager.tsx', 'utf8');
const dto = fs.readFileSync('apps/backend/src/modules/master/dto/routing-group.dto.ts', 'utf8');
const service = fs.readFileSync('apps/backend/src/modules/master/services/routing-group.service.ts', 'utf8');
const ko = JSON.parse(fs.readFileSync('apps/frontend/src/locales/ko.json', 'utf8'));

test('/master/routing exposes SG and FG label issue flags in frontend types', () => {
  assert.match(types, /issueSgLabelYn: string;/);
  assert.match(types, /issueFgLabelYn: string;/);
});

test('/master/routing process modal edits SG and FG label issue flags', () => {
  assert.match(manager, /issueSgLabelYn: "N"/);
  assert.match(manager, /issueFgLabelYn: "N"/);
  assert.match(manager, /process\.issueSgLabelYn \|\| "N"/);
  assert.match(manager, /process\.issueFgLabelYn \|\| "N"/);
  assert.match(manager, /issueSgLabelYn: processForm\.issueSgLabelYn \|\| "N"/);
  assert.match(manager, /issueFgLabelYn: processForm\.issueFgLabelYn \|\| "N"/);
  assert.match(manager, /checked=\{processForm\.issueSgLabelYn === "Y"\}/);
  assert.match(manager, /checked=\{processForm\.issueFgLabelYn === "Y"\}/);
  assert.match(manager, /t\("master\.routing\.issueSgLabel"/);
  assert.match(manager, /t\("master\.routing\.issueFgLabel"/);
});

test('/master/routing process grid shows SG and FG label issue badges', () => {
  assert.match(manager, /process\.issueSgLabelYn === 'Y'/);
  assert.match(manager, /process\.issueFgLabelYn === 'Y'/);
  assert.match(manager, /t\("master\.routing\.labelIssue"/);
  assert.match(manager, /t\("master\.routing\.sgLabelShort"/);
  assert.match(manager, /t\("master\.routing\.fgLabelShort"/);
});

test('routing process DTO accepts SG and FG label issue flags', () => {
  assert.match(dto, /issueSgLabelYn\?: string;/);
  assert.match(dto, /issueFgLabelYn\?: string;/);
  assert.match(dto, /description: 'SG 라벨 발행 여부'/);
  assert.match(dto, /description: 'FG 라벨 발행 여부'/);
});

test('routing process service persists SG and FG label issue flags on create and update', () => {
  assert.match(service, /issueSgLabelYn: dto\.issueSgLabelYn \?\? 'N'/);
  assert.match(service, /issueFgLabelYn: dto\.issueFgLabelYn \?\? 'N'/);
  assert.match(service, /\| 'issueSgLabelYn'/);
  assert.match(service, /\| 'issueFgLabelYn'/);
  assert.match(service, /dto\.issueSgLabelYn !== undefined \? \{ issueSgLabelYn: dto\.issueSgLabelYn \} : \{\}/);
  assert.match(service, /dto\.issueFgLabelYn !== undefined \? \{ issueFgLabelYn: dto\.issueFgLabelYn \} : \{\}/);
});

test('routing label issue locale keys are present', () => {
  assert.equal(ko.master.routing.labelIssue, '라벨발행');
  assert.equal(ko.master.routing.issueSgLabel, 'SG 라벨 발행');
  assert.equal(ko.master.routing.issueFgLabel, 'FG 라벨 발행');
  assert.equal(ko.master.routing.sgLabelShort, 'SG');
  assert.equal(ko.master.routing.fgLabelShort, 'FG');
});
