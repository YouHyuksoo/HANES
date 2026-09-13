/**
 * @file header-check-item-state.structure.test.mjs
 * @description 키오스크 헤더의 완료/미완료 구분이 약해지지 않게 고정한다.
 *
 * 왜 고정하나:
 * 설비일상점검·작업자설비점검 카드가 완료든 미완료든 같은 회색 테두리에 같은 글자색이었고,
 * 12px 아이콘 하나만 초록/빨강으로 갈렸다. 현장에서 구분이 안 된다는 지적을 받았다(2026-09-14).
 * 상태는 **왼쪽 굵은 세로 보더 + 상태 문구 색 + 입력 버튼 톤** 셋으로 같이 말한다.
 * 카드 배경에 파스텔을 깔아 해결하지 않는다 — 이 프로젝트가 금지한 방식이다.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const checkItem = readFileSync(join(here, 'HeaderCheckItem.tsx'), 'utf8');
const header = readFileSync(join(here, 'EquipHeader.tsx'), 'utf8');

test('점검 카드는 상태축 하나로 테두리·문구색·버튼톤을 함께 정한다', () => {
  assert.match(checkItem, /const tone = notTarget \? 'muted' : done \? 'done' : 'todo'/);
  assert.match(checkItem, /border-l-4 border-l-green-600/);
  assert.match(checkItem, /border-l-4 border-l-red-500/);
  assert.match(checkItem, /text-green-700 dark:text-green-400/);
  assert.match(checkItem, /text-red-600 dark:text-red-400/);
});

test('끝난 점검은 입력 버튼을 primary 로 두지 않는다', () => {
  // 남은 일만 primary 로 도드라져야 한다. 완료 카드까지 같은 무게면 다시 안 보인다.
  // primary 는 done 이 false 인 가지에만 있어야 한다.
  assert.match(checkItem, /done[\s\S]{0,160}\? 'border border-border bg-transparent/);
  assert.match(checkItem, /: 'bg-primary text-white hover:bg-primary\/90'/);
  assert.match(checkItem, /\{done \? t\('common\.view', '보기'\) : t\('common\.input', '입력'\)\}/);
});

test('작업자 영역도 같은 신호를 쓰고 파스텔 배경을 쓰지 않는다', () => {
  assert.match(header, /selectedWorkers\.length > 0[\s\S]{0,120}border-l-4 border-l-green-600/);
  assert.ok(
    !/bg-green-100/.test(header),
    '작업자 칩에 파스텔 배경(bg-green-100) 금지 — 테두리와 글자색으로 구분한다',
  );
  assert.match(header, /border border-green-600[^"]*text-green-700/);
});

test('작업자 없음 경고는 미완료와 같은 빨강을 쓴다', () => {
  // 주황/빨강이 섞이면 "덜 급한 것"처럼 읽힌다. 실적입력을 막는 조건은 전부 같은 색이어야 한다.
  assert.match(header, /text-red-600 dark:text-red-400">\s*<AlertTriangle[\s\S]{0,120}workerRequired/);
  assert.ok(!/text-orange-500[\s\S]{0,200}workerRequired/.test(header), '작업자 필요 경고에 주황 금지');
});
