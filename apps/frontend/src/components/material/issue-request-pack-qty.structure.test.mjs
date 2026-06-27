import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const modal = readFileSync('apps/frontend/src/components/material/IssueFromRequestModal.tsx', 'utf8');
const panel = readFileSync('apps/frontend/src/components/material/WorkOrderRequestPanel.tsx', 'utf8');

test('실출고 모달은 포장단위 올림 잔여까지 출고를 허용한다', () => {
  assert.match(modal, /roundUpToPack/, '실출고수량은 포장단위 올림으로 계산해야 한다');
  assert.match(modal, /packRemainQty/, '최대 출고 허용 수량은 포장단위 올림 잔여여야 한다');
  assert.match(modal, /max=\{item\.packRemainQty\}/, '출고수량 입력 상한은 낱개 잔여가 아닌 포장단위 올림 잔여여야 한다');
  assert.match(modal, /issueQty:\s*packRemainQty/, '기본 출고수량은 포장단위 올림 잔여여야 한다');
  assert.match(modal, /minPackQty/, '포장단위 컬럼을 표시해야 한다');
});

test('출고요청 작성 그리드는 요청/포장단위/실출고 3값을 표시한다', () => {
  assert.match(panel, /calcIssueQty/, '실출고수량 = ceil(요청/포장단위)*포장단위');
  assert.match(panel, /material\.request\.minPackQty/, '포장단위 컬럼 헤더를 표시해야 한다');
  assert.match(panel, /material\.request\.issueQtyLabel/, '실출고수량 컬럼 헤더를 표시해야 한다');
});
