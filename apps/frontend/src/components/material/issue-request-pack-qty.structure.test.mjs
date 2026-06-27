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

test('#1 작성 패널에서 BOM 외 품목을 직접 검색해 추가할 수 있다', () => {
  assert.match(panel, /searchStockItems/, 'BOM 외 품목 검색 prop을 받아야 한다');
  assert.match(panel, /addManualItem/, '검색 품목을 직접 추가하는 핸들러가 있어야 한다');
});

test('#7 실출고 모달은 LOT 입고일(FIFO)과 가용부족 경고를 표시한다', () => {
  assert.match(modal, /fmtRecvDate/, 'LOT 입고일을 표시해야 한다');
  assert.match(modal, /shortage/, '선택 LOT 가용재고 부족 경고가 있어야 한다');
});

test('#8 공정 지정 출고는 공정재고 적재 안내를 표시한다', () => {
  assert.match(panel, /processStockNotice/, '작성 패널에 공정재고 적재 안내가 있어야 한다');
  assert.match(modal, /processStockNotice/, '실출고 모달에 공정재고 적재 안내가 있어야 한다');
});
