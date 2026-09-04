import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const types = fs.readFileSync('apps/frontend/src/app/(authenticated)/master/routing/types.ts', 'utf8');
const manager = fs.readFileSync('apps/frontend/src/app/(authenticated)/master/routing/components/RoutingGroupManager.tsx', 'utf8');
const dto = fs.readFileSync('apps/backend/src/modules/master/dto/routing-group.dto.ts', 'utf8');
const service = fs.readFileSync('apps/backend/src/modules/master/services/routing-group.service.ts', 'utf8');
const ko = JSON.parse(fs.readFileSync('apps/frontend/src/locales/ko.json', 'utf8'));

test('/master/routing exposes label issue type in frontend types', () => {
  assert.match(types, /issueLabelType: string;/);
});

test('/master/routing process modal edits label issue type', () => {
  assert.match(manager, /issueLabelType: "NONE"/);
  assert.match(manager, /process\.issueLabelType \|\| "NONE"/);
  assert.match(manager, /issueLabelType: processForm\.issueLabelType \|\| "NONE"/);
  assert.match(manager, /value=\{processForm\.issueLabelType \|\| "NONE"\}/);
  assert.match(manager, /<option value="NONE">/);
  assert.match(manager, /<option value="BUNDLE">/);
  assert.match(manager, /<option value="SG">/);
  assert.match(manager, /<option value="FG">/);
  assert.match(manager, /t\("master\.routing\.labelIssue"/);
});

test('/master/routing process grid shows label issue type badges', () => {
  assert.match(manager, /process\.issueLabelType === 'BUNDLE'/);
  assert.match(manager, /process\.issueLabelType === 'SG'/);
  assert.match(manager, /process\.issueLabelType === 'FG'/);
  assert.match(manager, /t\("master\.routing\.labelIssue"/);
  assert.match(manager, /t\("master\.routing\.bundleLabelShort"/);
  assert.match(manager, /t\("master\.routing\.sgLabelShort"/);
  assert.match(manager, /t\("master\.routing\.fgLabelShort"/);
});

test('routing process DTO accepts label issue type', () => {
  assert.match(dto, /issueLabelType\?: string;/);
  assert.match(dto, /IsIn\(\['NONE', 'BUNDLE', 'SG', 'FG'\]\)/);
  assert.match(dto, /description: '라벨 발행 종류 \(NONE\/BUNDLE\/SG\/FG\)'/);
});

test('routing process service persists label issue type on create and update', () => {
  assert.match(service, /issueLabelType: dto\.issueLabelType \?\? 'NONE'/);
  assert.match(service, /\| 'issueLabelType'/);
  assert.match(service, /dto\.issueLabelType !== undefined \? \{ issueLabelType: dto\.issueLabelType \} : \{\}/);
});

test('routing label issue locale keys are present', () => {
  assert.equal(ko.master.routing.labelIssue, '라벨발행');
  assert.equal(ko.master.routing.bundleLabelShort, '묶음');
  assert.equal(ko.master.routing.sgLabelShort, 'SFG');
  assert.equal(ko.master.routing.fgLabelShort, 'FG');
  assert.equal(ko.master.routing.issueLabelTypeNone, '없음');
  assert.equal(ko.master.routing.issueLabelTypeBundle, '묶음 추적 라벨');
  assert.equal(ko.master.routing.issueLabelTypeSg, '반제품(SFG) 라벨');
  assert.equal(ko.master.routing.issueLabelTypeFg, '완제품(FG) 라벨');
});
