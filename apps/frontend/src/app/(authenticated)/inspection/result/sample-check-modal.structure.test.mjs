import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('./components/SampleCheckModal.tsx', import.meta.url), 'utf8');

test('견본 스캔은 공용 BarcodeScanInput을 쓴다', () => {
  assert.match(src, /BarcodeScanInput/, 'BarcodeScanInput을 써야 한다');
  assert.doesNotMatch(src, /onKeyDown=\{[^}]*Enter/, '일반 Input + Enter 조합을 쓰면 안 된다');
  assert.match(src, /maintainFocus/, '연속 스캔을 위해 maintainFocus를 써야 한다');
});

test('스캔하지 않은 견본은 결과 입력이 막힌다', () => {
  assert.match(src, /scannedCodes/, '스캔된 코드 집합을 추적해야 한다');
  assert.match(src, /disabled=\{!scanned/, 'PASS/FAIL 버튼이 스캔 여부로 막혀야 한다');
});

test('만료 견본이 있으면 저장이 막히고 브라우저 대화상자를 쓰지 않는다', () => {
  assert.match(src, /expiredRequired\.length === 0/, '만료 필수견본이 있으면 저장 불가여야 한다');
  assert.doesNotMatch(src, /window\.confirm|alert\(/, 'alert/confirm 금지');
});

test('OK/NG 판정은 서버 응답을 따른다', () => {
  assert.match(src, /overallResult/, '서버 종합판정을 사용해야 한다');
  assert.doesNotMatch(src, /expectedResult ===\s*actualResult/, '화면에서 판정을 산출하면 안 된다');
});
