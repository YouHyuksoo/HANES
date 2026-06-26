import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const pagePath = 'apps/frontend/src/app/(authenticated)/quality/trace/page.tsx';
const wizardPath = 'apps/frontend/src/app/(authenticated)/quality/trace/components/TraceSearchWizard.tsx';
const typesPath = 'apps/frontend/src/app/(authenticated)/quality/trace/types.ts';
const controllerPath = 'apps/backend/src/modules/quality/inspection/controllers/trace.controller.ts';
const servicePath = 'apps/backend/src/modules/quality/inspection/services/product-traceability.service.ts';
const dtoPath = 'apps/backend/src/modules/quality/inspection/dto/product-traceability.dto.ts';

test('trace page opens a WebDisplay-style search wizard before querying', () => {
  const page = fs.readFileSync(pagePath, 'utf8');
  const wizard = fs.readFileSync(wizardPath, 'utf8');

  assert.match(page, /TraceSearchWizard/);
  assert.match(page, /useState\(true\)/);
  assert.match(page, /setWizardOpen\(true\)/);
  assert.match(page, /currentSearch/);
  assert.match(page, /candidateItems/);
  assert.match(page, /selectedTraceKey/);

  assert.match(wizard, /const MODE_CARDS/);
  assert.match(wizard, /step, setStep/);
  assert.match(wizard, /["']pick["'] \| ["']input["']/);
  assert.match(wizard, /TraceSearchMode/);
  assert.match(wizard, /Package/);
  assert.match(wizard, /Wrench/);
});

test('trace wizard offers the HANES trace start points as cards', () => {
  const wizard = fs.readFileSync(wizardPath, 'utf8');

  for (const mode of [
    'product',
    'material',
    'box',
    'pallet',
    'shipOrder',
    'equipment',
    'workOrder',
    'sg',
  ]) {
    assert.match(wizard, new RegExp(`mode: "${mode}"`));
  }

  assert.match(wizard, /value: string/);
  assert.match(wizard, /equipCode: string/);
  assert.match(wizard, /dateFrom: string/);
  assert.match(wizard, /dateTo: string/);
  assert.match(wizard, /onSubmit/);
  assert.match(wizard, /onBack/);
});

test('trace page uses candidates API and then existing product detail API', () => {
  const page = fs.readFileSync(pagePath, 'utf8');
  const types = fs.readFileSync(typesPath, 'utf8');

  assert.match(types, /export type TraceSearchMode/);
  assert.match(types, /export interface TraceCandidate/);
  assert.match(types, /sourceLabel: string/);
  assert.match(types, /traceType: "FG" \| "SG"/);

  assert.match(page, /api\.get\("\/quality\/trace\/candidates"/);
  assert.match(page, /api\.get\("\/quality\/trace"/);
  assert.match(page, /params: \{ serial: traceKey \}/);
  assert.match(page, /fetchCandidates/);
  assert.match(page, /fetchProductTrace/);
});

test('backend exposes candidates endpoint and resolver for WebDisplay-style trace starts', () => {
  const controller = fs.readFileSync(controllerPath, 'utf8');
  const service = fs.readFileSync(servicePath, 'utf8');
  const dto = fs.readFileSync(dtoPath, 'utf8');

  assert.match(controller, /@Get\('candidates'\)/);
  assert.match(controller, /getCandidates/);
  assert.match(controller, /mode: TraceSearchMode/);
  assert.match(controller, /dateFrom/);
  assert.match(controller, /dateTo/);

  assert.match(dto, /export type TraceSearchMode/);
  assert.match(dto, /export interface TraceCandidate/);

  assert.match(service, /async findCandidates/);
  assert.match(service, /resolveProductCandidates/);
  assert.match(service, /resolveMaterialCandidates/);
  assert.match(service, /resolveBoxCandidates/);
  assert.match(service, /resolvePalletCandidates/);
  assert.match(service, /resolveShipOrderCandidates/);
  assert.match(service, /resolveEquipmentCandidates/);
  assert.match(service, /resolveWorkOrderCandidates/);
  assert.match(service, /resolveSgCandidates/);
});
