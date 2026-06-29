import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const rules = fs.readFileSync('packages/shared/src/utils/work-instruction-rules.ts', 'utf8');
const sharedIndex = fs.readFileSync('packages/shared/src/utils/index.ts', 'utf8');
const service = fs.readFileSync('apps/backend/src/modules/master/services/work-instruction.service.ts', 'utf8');
const panel = fs.readFileSync('apps/frontend/src/app/(authenticated)/master/work-instruction/components/WorkInstructionFormPanel.tsx', 'utf8');

test('작업지도서 복합키 계약을 @harness/shared 단일 출처로 노출한다', () => {
  assert.match(rules, /export const WORK_INSTRUCTION_KEY_SEPARATOR = '::'/);
  assert.match(rules, /export function buildWorkInstructionKey\(/);
  assert.match(rules, /export function parseWorkInstructionKey\(id: string\)/);
  assert.match(sharedIndex, /export \* from '\.\/work-instruction-rules'/);
});

test('백엔드 work-instruction.service가 공유 parse를 사용한다', () => {
  assert.match(service, /import \{ parseWorkInstructionKey \} from '@harness\/shared'/);
  assert.match(service, /const key = parseWorkInstructionKey\(id\)/);
  // 로컬 '::' split 제거
  assert.doesNotMatch(service, /id\.split\('::'\)/);
});

test('프론트 getWorkInstructionKey가 공유 build로 위임한다', () => {
  assert.match(panel, /import \{ buildWorkInstructionKey \} from "@harness\/shared"/);
  assert.match(panel, /getWorkInstructionKey = \([\s\S]*\) => buildWorkInstructionKey\(item\)/);
  // 로컬 '::' 템플릿 리터럴 제거
  assert.doesNotMatch(panel, /`\$\{item\.itemCode\}::/);
});
