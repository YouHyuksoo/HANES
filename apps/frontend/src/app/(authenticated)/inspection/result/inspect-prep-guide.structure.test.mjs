import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (rel) => readFileSync(new URL(rel, import.meta.url), 'utf8');

test('준비 안내 단계는 순수 함수 한 곳에서 계산한다', () => {
  const src = read('./hooks/prepGuideSteps.ts');
  assert.match(src, /export function buildPrepGuideSteps/, '단계 계산 순수 함수가 있어야 한다');
  for (const key of ['"equip"', '"worker"', '"order"', '"daily"', '"workerInspect"', '"sampleCheck"']) {
    assert.match(src, new RegExp(key), `${key} 단계가 있어야 한다`);
  }
  assert.match(src, /export function findCurrentGuideStep/, '현재 단계 선택 함수가 있어야 한다');
});

test('안내 모달은 글래스 패널 + 공용 z-index 아래(z-40)에 떠서 점검 모달이 위에 뜬다', () => {
  const src = read('./components/InspectPrepGuideModal.tsx');
  assert.match(src, /backdrop-blur/, '글래스몰피즘 blur가 있어야 한다');
  assert.match(src, /className="[^"]*\bz-40\b/, '점검 모달(z-50)보다 아래에 떠야 한다');
  assert.doesNotMatch(src, /className="[^"]*\bz-50\b/, 'z-50을 쓰면 점검 모달이 가려진다');
  assert.match(src, /createPortal/, 'body로 portal 해야 헤더 overflow에 잘리지 않는다');
  assert.match(src, /inspect-guide-later/, '나중에 하기 버튼이 있어야 한다');
  assert.match(src, /inspect-guide-action/, '현재 단계 실행 버튼이 있어야 한다');
  assert.doesNotMatch(src, /bg-(green|red|orange|blue)-50/, '파스텔 배경은 쓰지 않는다');
  assert.doesNotMatch(src, /\balert\(|\bconfirm\(/, 'alert/confirm 금지');
});

test('안내 모달 애니메이션은 globals.css keyframes로 정의한다', () => {
  const css = readFileSync(new URL('../../../globals.css', import.meta.url), 'utf8');
  for (const name of ['guide-ring', 'guide-pop', 'guide-rise', 'guide-progress']) {
    assert.match(css, new RegExp(`@keyframes ${name}`), `${name} keyframes가 있어야 한다`);
  }
});

test('워크플로우가 안내 모달을 띄우고 헤더의 작업자 선택을 제어한다', () => {
  const wf = read('./components/InspectionResultWorkflow.tsx');
  assert.match(wf, /InspectPrepGuideModal/, '안내 모달을 렌더해야 한다');
  assert.match(wf, /useInspectPrepGuide/, '안내 상태 훅을 써야 한다');
  assert.match(wf, /inspect-guide-open/, '헤더에 안내 다시 열기 버튼이 있어야 한다');
  assert.match(wf, /workerSelectOpen=\{/, '작업자 선택 모달 열림을 워크플로우가 제어해야 한다');
  const header = read('./components/InspectStationHeader.tsx');
  assert.match(header, /workerSelectOpen\?:/, '헤더는 작업자 선택 열림을 controlled로 받을 수 있어야 한다');
  assert.match(header, /onWorkerSelectOpenChange\?:/, '헤더는 열림 변경을 부모에 알려야 한다');
});

test('i18n 4개 언어에 guide 키가 모두 있다', () => {
  const required = [
    'title', 'subtitle', 'later', 'reopen', 'allReady', 'allReadyDesc', 'progress',
    'stepEquip', 'stepWorker', 'stepOrder', 'stepDaily', 'stepWorkerInspect', 'stepSampleCheck',
    'hintEquip', 'hintWorker', 'hintOrder', 'hintDaily', 'hintWorkerInspect', 'hintSampleCheck',
    'actionOpen', 'searchOrder', 'notTarget', 'doneLabel', 'currentLabel', 'waitLabel', 'noTesters',
  ];
  for (const lang of ['ko', 'en', 'zh', 'vi']) {
    const json = JSON.parse(readFileSync(new URL(`../../../../locales/${lang}.json`, import.meta.url), 'utf8'));
    const guide = json.inspection?.result?.guide;
    assert.ok(guide, `${lang}: inspection.result.guide 가 있어야 한다`);
    for (const key of required) {
      assert.equal(typeof guide[key], 'string', `${lang}: guide.${key} 누락`);
    }
  }
});
