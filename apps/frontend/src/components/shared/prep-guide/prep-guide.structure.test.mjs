import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (rel) => readFileSync(new URL(rel, import.meta.url), 'utf8');

test('공용 준비 안내 규칙: 배정·현재단계·완료수·열림 훅이 한 파일에 있다', () => {
  const src = read('./prepGuide.ts');
  assert.match(src, /export function assignPrepGuideStatuses/, '배정 규칙이 있어야 한다');
  assert.match(src, /export function findCurrentGuideStep/, '현재 단계 선택 함수가 있어야 한다');
  assert.match(src, /export function countGuideDone/, '완료 수 함수가 있어야 한다');
  assert.match(src, /export function usePrepGuide/, '열림 상태 훅이 있어야 한다');
  assert.match(src, /PREP_GUIDE_AUTO_CLOSE_MS/, '자동 닫힘 지연 상수가 있어야 한다');
});

test('공용 안내 모달은 글래스 패널 + z-40 + ESC 리스너 없음 + transform CTA 없음', () => {
  const src = read('./PrepGuideModal.tsx');
  assert.match(src, /backdrop-blur/, '글래스몰피즘 blur가 있어야 한다');
  assert.match(src, /className="[^"]*\bz-40\b/, '점검 모달(z-50)보다 아래에 떠야 한다');
  assert.doesNotMatch(src, /className="[^"]*\bz-50\b/, 'z-50을 쓰면 점검 모달이 가려진다');
  assert.match(src, /createPortal/, 'body로 portal 해야 한다');
  assert.doesNotMatch(src, /addEventListener\("keydown"/, '위 모달의 ESC가 같이 닫히므로 document ESC 리스너를 달지 않는다');
  assert.doesNotMatch(src, /active:scale|hover:scale|translate-y/, 'CTA에 transform 애니메이션을 쓰면 시나리오 러너 클릭이 불안정하다');
  assert.match(src, /\$\{testIdPrefix\}-later/, '나중에 하기 버튼이 있어야 한다');
  assert.match(src, /\$\{testIdPrefix\}-action/, '현재 단계 실행 버튼이 있어야 한다');
  assert.doesNotMatch(src, /bg-(green|red|orange|blue)-50/, '파스텔 배경은 쓰지 않는다');
  assert.doesNotMatch(src, /\balert\(|\bconfirm\(/, 'alert/confirm 금지');
});

test('안내 애니메이션은 globals.css keyframes로 정의하고 CTA는 transform을 쓰지 않는다', () => {
  const css = readFileSync(new URL('../../../app/globals.css', import.meta.url), 'utf8');
  for (const name of ['guide-ring', 'guide-pop', 'guide-rise', 'guide-progress', 'guide-cta']) {
    assert.match(css, new RegExp(`@keyframes ${name}`), `${name} keyframes가 있어야 한다`);
  }
  const cta = css.slice(css.indexOf('@keyframes guide-cta'), css.indexOf('@keyframes guide-cta') + 400);
  assert.doesNotMatch(cta, /transform/, 'guide-cta는 그림자만 움직인다');
});

test('i18n 4개 언어에 공용 prepGuide 키가 모두 있다', () => {
  const required = ['later', 'reopen', 'allReady', 'progress', 'actionOpen', 'notTarget', 'doneLabel', 'currentLabel', 'waitLabel'];
  for (const lang of ['ko', 'en', 'zh', 'vi']) {
    const json = JSON.parse(readFileSync(new URL(`../../../locales/${lang}.json`, import.meta.url), 'utf8'));
    const g = json.prepGuide;
    assert.ok(g, `${lang}: prepGuide 가 있어야 한다`);
    for (const key of required) assert.equal(typeof g[key], 'string', `${lang}: prepGuide.${key} 누락`);
  }
});
