import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';

const repoRoot = process.cwd();
const read = (path) => readFileSync(resolve(repoRoot, path), 'utf8');

test('routing material editor links selected BOM material to an optional harness circuit spec', () => {
  const types = read('apps/frontend/src/app/(authenticated)/master/routing/types.ts');
  const editor = read('apps/frontend/src/app/(authenticated)/master/routing/components/RoutingMaterialEditor.tsx');
  const dto = read('apps/backend/src/modules/master/dto/routing-group.dto.ts');
  const entity = read('apps/backend/src/entities/routing-material.entity.ts');
  const service = read('apps/backend/src/modules/master/services/routing-group.service.ts');

  assert.match(types, /circuitId: number \| null;/);
  assert.match(types, /circuitNo: string \| null;/);
  assert.match(types, /lengthMm: number \| null;/);
  assert.match(types, /stripA: number \| null;/);
  assert.match(types, /stripB: number \| null;/);

  assert.match(editor, /circuitId/);
  assert.match(editor, /circuitNo/);
  assert.match(editor, /lengthMm/);
  assert.match(editor, /stripA/);
  assert.match(editor, /stripB/);

  assert.match(dto, /circuitId\?: number;/);
  assert.match(entity, /CIRCUIT_ID/);
  assert.match(service, /validateMaterialCircuitLinks/);
  assert.match(service, /HarnessCircuitSpec/);
});
