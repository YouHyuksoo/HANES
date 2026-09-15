import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const modal = readFileSync('apps/frontend/src/components/material/IssueFromRequestModal.tsx', 'utf8');
const sequence = readFileSync('apps/frontend/src/components/material/issue-from-request/SplitLabelSequence.tsx', 'utf8');

test('분할은 전용 엔드포인트를 호출한다', () => {
  assert.match(modal, /split-for-issue/, '분할은 출고 준비 전용 API 를 써야 한다');
});

test('부분 사용 롯트만 분할 대상이다', () => {
  assert.match(
    modal,
    /qty\s*<\s*available|available\s*>\s*slice\.qty/,
    '전량 사용 롯트는 분할하지 않아야 한다',
  );
  // 잔량이 1 미만이면 자식 LOT 의 INIT_QTY(정수 컬럼)를 만들 수 없다
  assert.match(
    modal,
    /available\s*-\s*slice\.qty\s*>=\s*1/,
    '소수 잔량만 남는 롯트는 분할 대상이 아니어야 한다',
  );
});

test('분할 후에는 LOT 목록을 재조회하고 참여 행만 초기화한다', () => {
  assert.match(
    modal,
    /reloadLots|loadAvailableLots/,
    '분할로 생긴 신규 시리얼을 반영하려면 LOT 목록을 다시 읽어야 한다',
  );
  assert.match(
    modal,
    /splitRowKeys/,
    '분할에 참여한 행만 초기화해야 한다 — 전체를 지우면 사용자가 일부러 건너뛴 롯트를 자동배분이 되살린다',
  );
  assert.equal(
    modal.includes('setAllocation({})'),
    false,
    '전체 배분 초기화는 다른 품목의 수동 배분까지 날린다',
  );
  assert.equal(
    modal.includes('setManualRowKeys(new Set())'),
    false,
    '수동 플래그 전체 초기화는 건너뛴 롯트를 다시 집어가게 만든다',
  );
});

test('분할이 커밋된 뒤의 실패는 조회 실패가 아니라 라벨 미출력으로 안내한다', () => {
  assert.match(modal, /committed/, '분할 커밋 여부를 구분해야 한다');
  assert.match(
    modal,
    /splitCommittedReloadFailed/,
    '분할은 이미 커밋됐다는 사실과 라벨 출력이 남았다는 것을 알려야 한다',
  );
});

test('분할 대상이 있어도 [출고] 버튼은 항상 남는다', () => {
  // 분할 불가 롯트(IS_SPLITTABLE=N, 예약 보유, 재고실사 freeze)는 서버가 400 으로 막는다.
  // 그때 출고 버튼까지 사라지면 화면이 막다른 길이 된다(설계 §9: 출고는 막지 않는다).
  assert.equal(
    /splitTargets\.length > 0 \?[\s\S]{0,400}\) : \(/.test(modal),
    false,
    '분할/출고를 삼항으로 갈라 한쪽 버튼을 감추면 안 된다',
  );
  assert.match(modal, /disabledReason/, '컨트롤은 숨기지 말고 disabled + 사유로 처리한다');
});

test('라벨 재출력은 모달을 다시 열어도 복원된다', () => {
  // 문자열이 어딘가 있기만 해서는 안 된다 — 모달이 "열릴 때" 실제로 부르고 그 결과로
  // splitGroups 를 채워야 재출력 버튼이 재마운트 뒤에도 살아난다.
  assert.match(
    modal,
    /useEffect\(\(\) => \{[\s\S]{0,200}isOpen[\s\S]{0,600}split-labels[\s\S]{0,400}setSplitGroups\([\s\S]{0,600}\}, \[isOpen/,
    '분할 결과는 컴포넌트 state 가 아니라 모달 오픈 시 서버(분할 수불)에서 복원해야 한다',
  );
});

test('라벨 미리보기는 원본 롯트별 그룹으로 순차 표시한다', () => {
  assert.match(sequence, /MatLabelPreviewModal/, '기존 라벨 미리보기 컴포넌트를 재사용해야 한다');
  assert.match(sequence, /groups\[/, '원본 롯트별 그룹을 순서대로 넘겨야 한다');
});

test('분할 완료 후 라벨 재출력이 가능하다', () => {
  assert.match(
    modal,
    /reprintLabel|splitGroups/,
    '출력 실패에 대비해 분할 결과를 보관하고 재출력할 수 있어야 한다',
  );
});
