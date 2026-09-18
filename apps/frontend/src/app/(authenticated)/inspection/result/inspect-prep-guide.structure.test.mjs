import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (rel) => readFileSync(new URL(rel, import.meta.url), 'utf8');

test('준비 안내 단계는 순수 함수 한 곳에서 계산하고, current/locked 배정은 공용 규칙을 쓴다', () => {
  const src = read('./hooks/prepGuideSteps.ts');
  assert.match(src, /export function buildPrepGuideSteps/, '단계 계산 순수 함수가 있어야 한다');
  for (const key of ['"equip"', '"worker"', '"order"', '"daily"', '"workerInspect"', '"sampleCheck"']) {
    assert.match(src, new RegExp(key), `${key} 단계가 있어야 한다`);
  }
  assert.match(src, /assignPrepGuideStatuses\(raw\)/, '배정 규칙은 공용 assignPrepGuideStatuses를 써야 한다');
  assert.match(src, /@\/components\/shared\/prep-guide/, '공용 prep-guide 모듈을 import 해야 한다');
});

test('통전검사 안내는 공용 PrepGuideModal 위의 얇은 매핑이다', () => {
  const src = read('./components/InspectPrepGuideModal.tsx');
  assert.match(src, /PrepGuideModal/, '공용 PrepGuideModal을 써야 한다');
  assert.doesNotMatch(src, /createPortal/, '포탈·레이아웃은 공용 모달이 담당한다');
  assert.match(src, /testIdPrefix="inspect-guide"/, '테스트 ID 접두어가 inspect-guide여야 한다');
  assert.match(src, /inspect-guide-equip-list/, '검사기 직접 선택 목록이 있어야 한다');
  assert.match(src, /inspect-guide-order-list/, '작업지시 직접 선택 목록이 있어야 한다');
  assert.doesNotMatch(src, /bg-(green|red|orange|blue)-50/, '파스텔 배경은 쓰지 않는다');
});

test('워크플로우가 공용 훅으로 안내를 띄우고 헤더의 작업자 선택을 제어한다', () => {
  const wf = read('./components/InspectionResultWorkflow.tsx');
  assert.match(wf, /InspectPrepGuideModal/, '안내 모달을 렌더해야 한다');
  assert.match(wf, /usePrepGuide\(guideSteps\)/, '공용 usePrepGuide를 써야 한다');
  assert.match(wf, /buildPrepGuideSteps\(/, '단계는 순수 함수로 계산해야 한다');
  assert.match(wf, /inspect-guide-open/, '헤더에 안내 다시 열기 버튼이 있어야 한다');
  assert.match(wf, /workerSelectOpen=\{/, '작업자 선택 모달 열림을 워크플로우가 제어해야 한다');
  const header = read('./components/InspectStationHeader.tsx');
  assert.match(header, /workerSelectOpen\?:/, '헤더는 작업자 선택 열림을 controlled로 받을 수 있어야 한다');
  assert.match(header, /onWorkerSelectOpenChange\?:/, '헤더는 열림 변경을 부모에 알려야 한다');
});

test('i18n 4개 언어에 검사 화면 guide 키가 모두 있고, 공용 문구는 prepGuide로 옮겨졌다', () => {
  const required = [
    'title', 'subtitle', 'allReadyDesc',
    'stepEquip', 'stepWorker', 'stepOrder', 'stepDaily', 'stepWorkerInspect', 'stepSampleCheck',
    'hintEquip', 'hintWorker', 'hintOrder', 'hintDaily', 'hintWorkerInspect', 'hintSampleCheck',
    'searchOrder', 'noTesters',
  ];
  const movedToShared = ['later', 'reopen', 'allReady', 'progress', 'actionOpen', 'notTarget', 'doneLabel', 'currentLabel', 'waitLabel'];
  for (const lang of ['ko', 'en', 'zh', 'vi']) {
    const json = JSON.parse(readFileSync(new URL(`../../../../locales/${lang}.json`, import.meta.url), 'utf8'));
    const guide = json.inspection?.result?.guide;
    assert.ok(guide, `${lang}: inspection.result.guide 가 있어야 한다`);
    for (const key of required) {
      assert.equal(typeof guide[key], 'string', `${lang}: guide.${key} 누락`);
    }
    for (const key of movedToShared) {
      assert.equal(guide[key], undefined, `${lang}: guide.${key}는 prepGuide.${key}로 옮겨야 한다(중복 금지)`);
    }
  }
});
