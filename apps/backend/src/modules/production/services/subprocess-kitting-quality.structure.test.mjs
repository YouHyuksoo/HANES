import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const dtoSource = readFileSync(
  join(process.cwd(), 'apps/backend/src/modules/production/dto/subprocess-kitting.dto.ts'),
  'utf8',
);
const serviceSource = readFileSync(
  join(process.cwd(), 'apps/backend/src/modules/production/services/subprocess-kitting.service.ts'),
  'utf8',
);
const confirmSubKitDtoSource = dtoSource.slice(dtoSource.indexOf('export class ConfirmSubKitDto'));

test('ConfirmSubKitDto accepts explicit goodQty and defectQty split', () => {
  assert.match(confirmSubKitDtoSource, /goodQty\?: number/);
  assert.match(confirmSubKitDtoSource, /defectQty\?: number/);
  assert.match(confirmSubKitDtoSource, /@IsInt\(\)/);
  assert.match(confirmSubKitDtoSource, /@Min\(0\)/);
});

test('confirmSubKit validates a single SFG result and persists good-vs-defect split', () => {
  assert.match(serviceSource, /const goodQty = dto\.goodQty \?\? 1/);
  assert.match(serviceSource, /const defectQty = dto\.defectQty \?\? 0/);
  assert.match(serviceSource, /goodQty \+ defectQty !== 1/);
  assert.match(serviceSource, /qualityStatus = defectQty > 0 \? 'DEFECT' : 'GOOD'/);
  assert.match(serviceSource, /newSg\.status = qualityStatus === 'DEFECT' \? 'DEFECT' : 'IN_STOCK'/);
  assert.match(serviceSource, /goodQty,\s*\n\s*defectQty,/);
  assert.match(serviceSource, /qualityStatus,/);
});
