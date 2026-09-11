import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const hook = readFileSync(new URL('./useIssueRequestData.ts', import.meta.url), 'utf8');
const panel = readFileSync(new URL('../../components/material/WorkOrderRequestPanel.tsx', import.meta.url), 'utf8');
const backend = readFileSync(new URL('../../../../backend/src/modules/material/services/issue-request.service.ts', import.meta.url), 'utf8');

test('issue-request job-order list hides canceled/done ancestors and operation orders (defects 09/11, 2026-09-09)', () => {
  assert.match(hook, /isJobOrderFinished\(String\(node\.status \?\? ''\)\)/);
  assert.match(hook, /const isItemOrder = String\(row\.orderKind \?\? 'ITEM'\)\.toUpperCase\(\) !== 'OPERATION';/);
  assert.match(panel, /production\.order\.orderKindOperation/);
  assert.match(panel, /production\.order\.orderKindItem/);
});

test('backend rejects issue requests registered on OPERATION orders', () => {
  assert.match(backend, /private async assertItemOrderForRequest\(/);
  assert.match(backend, /await this\.assertItemOrderForRequest\(dto\.orderNo, company, plant\);/);
  assert.match(backend, /=== 'OPERATION'\) \{\s*throw new BadRequestException/);
});
