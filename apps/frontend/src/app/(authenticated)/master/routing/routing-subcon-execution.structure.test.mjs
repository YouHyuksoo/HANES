import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read = (path) => fs.readFileSync(path, 'utf8');

const types = read('apps/frontend/src/app/(authenticated)/master/routing/types.ts');
const manager = read('apps/frontend/src/app/(authenticated)/master/routing/components/RoutingGroupManager.tsx');
const dto = read('apps/backend/src/modules/master/dto/routing-group.dto.ts');
const service = read('apps/backend/src/modules/master/services/routing-group.service.ts');
const entity = read('apps/backend/src/entities/routing-process.entity.ts');

test('/master/routing exposes subcontract execution metadata in frontend types', () => {
  assert.match(types, /executionType: "IN_HOUSE" \| "SUBCON";/);
  assert.match(types, /subconVendorCode: string \| null;/);
});

test('/master/routing process modal edits execution type and vendor selector', () => {
  assert.match(manager, /executionType: "IN_HOUSE"/);
  assert.match(manager, /subconVendorCode: ""/);
  assert.match(manager, /api\.get\("\/outsourcing\/vendors"/);
  assert.match(manager, /process\.executionType \|\| "IN_HOUSE"/);
  assert.match(manager, /process\.subconVendorCode \|\| ""/);
  assert.match(manager, /executionType: processForm\.executionType/);
  assert.match(manager, /subconVendorCode: processForm\.executionType === "SUBCON" \? processForm\.subconVendorCode \|\| undefined : undefined/);
  assert.match(manager, /value=\{processForm\.executionType\}/);
  assert.match(manager, /value=\{processForm\.subconVendorCode\}/);
});

test('/master/routing process grid shows in-house or subcontract execution state', () => {
  assert.match(manager, /process\.executionType === "SUBCON"/);
  assert.match(manager, /master\.routing\.executionSubcon/);
  assert.match(manager, /master\.routing\.executionInHouse/);
});

test('/master/routing backend accepts and persists subcontract execution metadata', () => {
  assert.match(dto, /executionType\?: 'IN_HOUSE' \| 'SUBCON';/);
  assert.match(dto, /subconVendorCode\?: string;/);
  assert.match(entity, /name: 'EXECUTION_TYPE'/);
  assert.match(entity, /executionType: 'IN_HOUSE' \| 'SUBCON';/);
  assert.match(entity, /name: 'SUBCON_VENDOR_CODE'/);
  assert.match(entity, /subconVendorCode: string \| null;/);
  assert.match(service, /executionType: dto\.executionType \?\? 'IN_HOUSE'/);
  assert.match(service, /subconVendorCode: dto\.executionType === 'SUBCON' \? dto\.subconVendorCode \?\? null : null/);
  assert.match(service, /\| 'executionType'/);
  assert.match(service, /\| 'subconVendorCode'/);
  assert.match(service, /const nextExecutionType = dto\.executionType \?\? existing\.executionType \?\? 'IN_HOUSE'/);
  assert.match(service, /dto\.executionType !== undefined && nextExecutionType !== 'SUBCON'/);
  assert.match(service, /dto\.executionType !== undefined \? \{ executionType: dto\.executionType \} : \{\}/);
  assert.match(service, /nextSubconVendorCode !== undefined \? \{ subconVendorCode: nextSubconVendorCode \} : \{\}/);
});
