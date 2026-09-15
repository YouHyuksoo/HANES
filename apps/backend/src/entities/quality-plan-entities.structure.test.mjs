import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';

const entityFiles = {
  QUALITY_PLAN_PACKAGES: 'quality-plan-package.entity.ts',
  QUALITY_PLAN_DOCUMENTS: 'quality-plan-document.entity.ts',
  QUALITY_PLAN_REVISIONS: 'quality-plan-revision.entity.ts',
  QUALITY_PROCESS_FLOW_ROWS: 'process-flow-row.entity.ts',
  QUALITY_PFMEA_ROWS: 'pfmea-row.entity.ts',
  QUALITY_CONTROL_PLAN_ROWS: 'quality-control-plan-row.entity.ts',
  QUALITY_PLAN_PARTICIPANTS: 'quality-plan-participant.entity.ts',
  QUALITY_PLAN_VALIDATIONS: 'quality-plan-validation.entity.ts',
  QUALITY_PLAN_EVENTS: 'quality-plan-event.entity.ts',
};

test('품질 문서 Entity는 migration 테이블과 tenant 컬럼을 명시한다', () => {
  for (const [table, file] of Object.entries(entityFiles)) {
    const url = new URL(file, import.meta.url);
    assert.ok(existsSync(url), `${file}가 있어야 합니다.`);
    const source = readFileSync(url, 'utf8');
    assert.match(source, new RegExp(`name:\\s*['\"]${table}['\"]`));
    assert.match(source, /name:\s*['"]COMPANY['"]/);
    assert.match(source, /name:\s*['"]PLANT_CD['"]/);
  }
});

test('migration은 모든 테이블과 숫자 PK Sequence 및 핵심 unique 제약을 정의한다', () => {
  const url = new URL('../migrations/2026-09-15_quality_plan_document_system.sql', import.meta.url);
  assert.ok(existsSync(url), '품질 문서체계 migration이 있어야 합니다.');
  const sql = readFileSync(url, 'utf8').toUpperCase();

  for (const table of Object.keys(entityFiles)) assert.match(sql, new RegExp(`CREATE TABLE ${table}`));
  for (const sequence of [
    'SEQ_QUALITY_PLAN_PACKAGE',
    'SEQ_QUALITY_PLAN_DOCUMENT',
    'SEQ_QUALITY_PLAN_REVISION',
    'SEQ_QUALITY_PROCESS_FLOW_ROW',
    'SEQ_QUALITY_PFMEA_ROW',
    'SEQ_QUALITY_CONTROL_PLAN_ROW',
    'SEQ_QUALITY_PLAN_PARTICIPANT',
    'SEQ_QUALITY_PLAN_VALIDATION',
    'SEQ_QUALITY_PLAN_EVENT',
    'SEQ_QUALITY_PFD_NO',
    'SEQ_QUALITY_PFMEA_NO',
    'SEQ_QUALITY_CP_NO',
  ]) assert.match(sql, new RegExp(`CREATE SEQUENCE ${sequence}`));

  assert.match(sql, /UNIQUE \(COMPANY, PLANT_CD, DOCUMENT_NO\)/);
  assert.match(sql, /UNIQUE \(COMPANY, PLANT_CD, DOCUMENT_ID, REVISION_CODE\)/);
  assert.match(sql, /CASE WHEN STATUS = 'DRAFT' THEN DOCUMENT_ID END/);
  assert.doesNotMatch(sql, /MAX\s*\([^)]*\)\s*\+\s*1/);
});

test('legacy 이관은 PLAN_NO 계보당 문서를 한 번 만들고 여러 Revision을 내부 순회한다', () => {
  const sql = readFileSync(new URL('../migrations/2026-09-15_migrate_legacy_control_plans.sql', import.meta.url), 'utf8').toUpperCase();
  const groupLoop = sql.indexOf('FOR G IN');
  const documentInsert = sql.indexOf('INSERT INTO QUALITY_PLAN_DOCUMENTS');
  const revisionLoop = sql.indexOf('FOR H IN');
  const revisionInsert = sql.indexOf('INSERT INTO QUALITY_PLAN_REVISIONS');
  assert.ok(groupLoop >= 0 && documentInsert > groupLoop && revisionLoop > documentInsert && revisionInsert > revisionLoop);
  assert.match(sql, /GROUP BY P\.COMPANY,P\.PLANT_CD,P\.ITEM_CODE,P\.PHASE,P\.PLAN_NO/);
  assert.match(sql, /WHEN H\.REVISION_NO <> G\.MAX_REVISION_NO THEN 'SUPERSEDED'/);
});
