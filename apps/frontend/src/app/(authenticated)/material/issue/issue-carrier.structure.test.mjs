import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const panel = readFileSync(new URL('./components/IssueScanPanel.tsx', import.meta.url), 'utf8');
const hook = readFileSync(new URL('../../../../hooks/material/useBarcodeScan.ts', import.meta.url), 'utf8');

test('자재 출고 스캔에 선택형 키팅 대차 입력이 있고 출고 요청에 carrierNo가 실린다', () => {
  assert.match(panel, /data-testid="issue-carrier-input"/);
  assert.match(panel, /BarcodeScanInput/);
  assert.match(hook, /const \[carrierNo, setCarrierNo\] = useState\(''\)/);
  assert.match(hook, /carrierNo: carrierNo\.trim\(\) \|\| undefined/);
  assert.doesNotMatch(panel, /disabled=\{[^}]*!carrierNo/);
});
