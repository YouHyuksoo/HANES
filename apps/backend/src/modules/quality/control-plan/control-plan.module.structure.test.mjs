import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';

const moduleUrl = new URL('./control-plan.module.ts', import.meta.url);
const qualityModuleUrl = new URL('../quality.module.ts', import.meta.url);
const spcModuleUrl = new URL('../spc/spc.module.ts', import.meta.url);

test('전용 관리계획 모듈은 신규 Entity와 SharedModule을 등록한다', () => {
  assert.ok(existsSync(moduleUrl));
  const source = readFileSync(moduleUrl, 'utf8');
  for (const entity of [
    'QualityPlanPackageEntity', 'QualityPlanDocumentEntity', 'QualityPlanRevisionEntity',
    'ProcessFlowRowEntity', 'PfmeaRowEntity', 'QualityControlPlanRowEntity',
    'QualityPlanParticipantEntity', 'QualityPlanValidationEntity', 'QualityPlanEventEntity',
  ]) assert.match(source, new RegExp(entity));
  assert.match(source, /SharedModule/);
  assert.match(source, /export class ControlPlanDocumentModule/);
});

test('QualityModule은 전용 모듈을 import하고 export한다', () => {
  const source = readFileSync(qualityModuleUrl, 'utf8');
  assert.match(source, /import \{ ControlPlanDocumentModule \}/);
  assert.equal((source.match(/ControlPlanDocumentModule,/g) ?? []).length, 2);
});

test('legacy SPC 관리계획은 이관 전까지 유지한다', () => {
  const source = readFileSync(spcModuleUrl, 'utf8');
  assert.match(source, /ControlPlanController/);
  assert.match(source, /ControlPlanService/);
  assert.match(source, /ControlPlanItem/);
});

test('전용 모듈은 패키지, Revision, 편집, 검증, 출력 서비스를 등록한다', () => {
  const source = readFileSync(moduleUrl, 'utf8');
  for (const symbol of [
    'PlanPackageController', 'QualityDocumentController',
    'PlanPackageService', 'QualityDocumentRevisionService', 'ProcessFlowDocumentService',
    'PfmeaDocumentService', 'ControlPlanDocumentService', 'QualityPlanDraftGeneratorService',
    'QualityPlanValidationService', 'QualityPlanPrintModelService',
  ]) assert.match(source, new RegExp(symbol));
  assert.match(source, /controllers:\s*\[PlanPackageController, QualityDocumentController\]/);
  assert.match(source, /providers:\s*\[[^\]]*PlanPackageService[^\]]*QualityDocumentRevisionService[^\]]*QualityPlanPrintModelService[^\]]*\]/);
});
