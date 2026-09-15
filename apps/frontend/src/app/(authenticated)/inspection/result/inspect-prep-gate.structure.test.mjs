import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (name) => readFileSync(new URL(`./components/${name}`, import.meta.url), 'utf8');

test('InspectPanel은 prep 단일 prop을 받고 준비 미완료면 판정 버튼을 막는다', () => {
  const src = read('InspectPanel.tsx');
  assert.match(src, /prep: InspectPrepState/, 'prep 단일 prop을 받아야 한다');
  assert.doesNotMatch(src, /consumablesReady\?:/, '소모품 상태는 prep로 흡수해야 한다');
  assert.doesNotMatch(src, /unmountedConsumCount\?:/, '미장착 수량도 prep로 흡수해야 한다');
  assert.match(src, /const prepBlocked = !prep\.ready/, '준비 상태로 판정을 막아야 한다');
  assert.match(src, /scanDisabled = .*prepBlocked/s, 'PASS/FAIL 비활성 조건에 prepBlocked가 들어가야 한다');
});

test('검사 등록 시 대표 작업자를 검사자로 보낸다', () => {
  const src = read('InspectPanel.tsx');
  const matches = src.match(/workerId: prep\.workers\[0\]\.id/g) ?? [];
  assert.ok(matches.length >= 2, 'PASS/FAIL 두 경로 모두 작업자를 보내야 한다');
});

test('검사 화면은 공용 작업자 선택 모달과 현재작업자 배정 API를 쓴다', () => {
  const src = read('InspectStationBar.tsx');
  assert.match(src, /@\/components\/worker\/WorkerSelectModal/, '공용 WorkerSelectModal을 써야 한다');
  assert.match(src, /\/workers`/, '현재 작업자 배정 API를 호출해야 한다');
  assert.doesNotMatch(src, /bg-(green|red|orange)-50/, '파스텔 배경은 쓰지 않는다');
});

test('준비 체크바는 4단계와 양/불체크 시작·이력 버튼을 제공한다', () => {
  const src = read('InspectPrepCheckBar.tsx');
  for (const key of ['prep.dailyInspect', 'prep.workerInspect', 'prep.sampleCheck', 'prep.consumable']) {
    assert.match(src, new RegExp(key.replace('.', '\.')), `${key} 단계가 있어야 한다`);
  }
  assert.match(src, /prep\.sampleCheckStart/, '양/불체크 시작 버튼이 있어야 한다');
  assert.match(src, /prep\.sampleCheckHistory/, '대조 이력 버튼이 있어야 한다');
});

test('워크플로우는 공용 점검 모달을 재사용한다', () => {
  const src = read('InspectionResultWorkflow.tsx');
  assert.match(src, /from "@\/components\/inspect"/, '공용 점검 모달을 import 해야 한다');
  assert.match(src, /useInspectPrepStatus/, '준비 상태 훅을 써야 한다');
  assert.match(src, /onStatusChange=\{prep\.setConsumableStatus\}/, '소모품 상태는 prep로 모아야 한다');
});
