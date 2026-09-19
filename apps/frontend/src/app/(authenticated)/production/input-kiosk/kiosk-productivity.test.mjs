import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { kioskProductivity } from './utils/kioskProductivity.ts';

test('각 생산성 지표는 공통 도움말 툴팁에 산출근거를 표시한다', () => {
  const source = readFileSync(new URL('./components/KioskProductivity.tsx', import.meta.url), 'utf8');
  assert.match(source, /<HelpTooltip/);
  assert.match(source, /description=\{metricDescriptions\[label\]\}/);
  for (const formula of ['CT = 경과시간(초) ÷ 총생산수량', 'UPH = 총생산수량 ÷ 경과시간(시간)', 'UPPH = UPH ÷ 현재 배정 인원']) {
    assert.ok(source.includes(formula));
  }
});

test('생산수량과 경과시간으로 CT/UPH/현재인원 UPPH를 계산한다', () => {
  const start = '2026-09-19T00:00:00Z';
  assert.deepEqual(kioskProductivity(120, start, null, 2, Date.parse(start) + 3600000), { ct: 30, uph: 120, upph: 60 });
});
test('완료된 지시는 종료시각에서 생산성을 고정한다', () => {
  assert.deepEqual(kioskProductivity(60, '2026-09-19T00:00:00Z', '2026-09-19T01:00:00Z', 1, Date.now()), { ct: 60, uph: 60, upph: 60 });
});
test('수량/시간/인원 미확정은 계산 가능한 지표만 표시한다', () => {
  assert.equal(kioskProductivity(100, null, null, 1, Date.now()).ct, null);
  assert.equal(kioskProductivity(0, '2026-09-19T00:00:00Z', null, 1, Date.now()).uph, null);
  assert.equal(kioskProductivity(1, 'invalid', null, 1, Date.now()).ct, null);
  assert.equal(kioskProductivity(100, '2026-09-19T00:00:00Z', '2026-09-19T01:00:00Z', 0, Date.now()).upph, null);
});
