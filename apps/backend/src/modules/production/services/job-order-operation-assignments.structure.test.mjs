import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const dtoSource = readFileSync(
  join(process.cwd(), 'apps/backend/src/modules/production/dto/job-order.dto.ts'),
  'utf8',
);
const serviceSource = readFileSync(
  join(process.cwd(), 'apps/backend/src/modules/production/services/job-order.service.ts'),
  'utf8',
);

test('job order create dto accepts per-operation equipment assignments', () => {
  assert.match(dtoSource, /export class CreateJobOrderOperationAssignmentDto/);
  assert.match(dtoSource, /itemCode\?: string/);
  assert.match(dtoSource, /routingCode\?: string/);
  assert.match(dtoSource, /routingSeq\?: number/);
  assert.match(dtoSource, /processCode: string/);
  assert.match(dtoSource, /equipCode\?: string/);
  assert.match(dtoSource, /operationAssignments\?: CreateJobOrderOperationAssignmentDto\[\]/);
});

test('job order service applies operation assignments when creating routing operation orders', () => {
  assert.match(serviceSource, /operationAssignmentMap/);
  assert.match(serviceSource, /buildOperationAssignmentMap/);
  assert.match(serviceSource, /buildOperationAssignmentKey/);
  assert.match(serviceSource, /getAssignmentsForItemRouting/);
  assert.match(serviceSource, /validateOperationAssignment/);
  assert.match(serviceSource, /createRoutingOperationOrders\([\s\S]*operationAssignmentMap/);
  assert.match(serviceSource, /equipCode: assignment\?\.equipCode \?\? null/);
  assert.match(serviceSource, /createChildOrdersRecursive\([\s\S]*operationAssignments/);
});
