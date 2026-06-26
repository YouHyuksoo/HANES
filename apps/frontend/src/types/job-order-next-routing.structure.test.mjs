import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const sharedProductionTypes = fs.readFileSync('packages/shared/src/types/production.ts', 'utf8');
const jobOrderService = fs.readFileSync('apps/backend/src/modules/production/services/job-order.service.ts', 'utf8');

test('job order shared type exposes current and next routing process metadata', () => {
  assert.match(sharedProductionTypes, /export interface JobOrderRoutingProcessSnapshot/);
  assert.match(sharedProductionTypes, /executionType: 'IN_HOUSE' \| 'SUBCON';/);
  assert.match(sharedProductionTypes, /subconVendorCode: string \| null;/);
  assert.match(sharedProductionTypes, /currentRoutingProcess\?: JobOrderRoutingProcessSnapshot \| null;/);
  assert.match(sharedProductionTypes, /nextRoutingProcess\?: JobOrderRoutingProcessSnapshot \| null;/);
});

test('backend job order service returns next routing process metadata', () => {
  assert.match(jobOrderService, /interface RoutingProcessSnapshot/);
  assert.match(jobOrderService, /nextRoutingProcess: this\.toRoutingProcessSnapshot\(nextRoutingProcess\)/);
  assert.match(jobOrderService, /return \{ \.\.\.jobOrder, prodResults, routingProcesses, \.\.\.this\.resolveRoutingFlow\(jobOrder, routingProcesses\) \}/);
});
