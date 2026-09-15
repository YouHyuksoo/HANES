import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('../../../migrations/2026-09-15_migrate_legacy_control_plans.sql', import.meta.url), 'utf8');

test('레거시 관리계획 행을 PFD-PFMEA-Control Plan 연결 구조로 이관한다', () => {
  assert.match(source, /V_PFMEA_ROW_ID := SEQ_QUALITY_PFMEA_ROW\.NEXTVAL/);
  assert.match(source, /INSERT INTO QUALITY_PFMEA_ROWS/);
  assert.match(source, /PROCESS_FLOW_ROW_ID,PFMEA_ROW_ID,PROCESS_NO/);
  assert.match(source, /V_PFD_ROW_ID,V_PFMEA_ROW_ID,TO_CHAR\(I\.SEQ\)/);
});

test('행이 없는 레거시 Revision은 발행 상태로 이관하지 않는다', () => {
  assert.match(source, /SELECT COUNT\(\*\) INTO V_ITEM_COUNT[\s\S]*WHEN V_ITEM_COUNT = 0 THEN 'DRAFT'/);
});
