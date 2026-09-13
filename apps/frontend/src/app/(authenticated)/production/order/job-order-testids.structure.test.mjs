import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

/**
 * 작업지시 화면의 data-testid 계약.
 *
 * 시나리오 JSON(인앱 드라이버가 실행하는 절차)이 이 이름들로 요소를 찾는다.
 * 시나리오는 서버에 배포된 JSON이라 화면 코드와 같이 바뀌지 않는다 —
 * 여기서 testid가 조용히 사라지면 배포된 시나리오가 런타임에 깨진다.
 * 그래서 이름을 계약으로 고정한다.
 *
 * 규칙: data-testid="<화면>-<요소>"
 *   화면 = 라우트 기반 케밥(job-order), 요소 = 역할 기반(create/save/plan-qty)
 *   i18n 문구·CSS 클래스와 무관하게 유지되는 이름만 쓴다.
 */

const page = readFileSync(new URL('./page.tsx', import.meta.url), 'utf8');
const modal = readFileSync(new URL('./components/JobOrderCreateModal.tsx', import.meta.url), 'utf8');

test('목록 화면에 작업지시 생성 버튼 testid가 있다', () => {
  assert.match(page, /data-testid="job-order-create"/);
});

test('생성 모달의 입력·버튼 testid가 모두 있다', () => {
  for (const id of [
    'job-order-item-code',
    'job-order-item-search',
    'job-order-plan-qty',
    'job-order-plan-date',
    'job-order-line',
    'job-order-save',
    'job-order-cancel',
  ]) {
    assert.match(modal, new RegExp(`data-testid="${id}"`), `${id} testid가 없다`);
  }
});

test('쓰기 버튼(save)은 취소와 구분된 이름을 가진다', () => {
  // 드라이버는 save 직전에 사용자 확인을 받는다. 두 버튼이 같은 이름이면 확인 없이 저장된다.
  assert.notEqual('job-order-save', 'job-order-cancel');
  assert.match(modal, /data-testid="job-order-save"[\s\S]{0,400}handleSubmit|handleSubmit[\s\S]{0,400}data-testid="job-order-save"/);
});
