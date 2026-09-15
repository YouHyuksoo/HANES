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
});

test('분할 후에는 LOT 목록을 재조회한다', () => {
  assert.match(
    modal,
    /reloadLots|loadAvailableLots/,
    '분할로 생긴 신규 시리얼을 반영하려면 LOT 목록을 다시 읽어야 한다',
  );
  assert.match(
    modal,
    /setAllocation\(\{\}\)/,
    '분할 후에는 클라이언트 배분 상태를 버리고 재계산해야 한다',
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
