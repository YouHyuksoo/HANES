import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const modal = readFileSync('apps/frontend/src/components/material/IssueFromRequestModal.tsx', 'utf8');
const panel = readFileSync('apps/frontend/src/components/material/issue-from-request/LotAllocationPanel.tsx', 'utf8');

test('출고 모달이 공통 FIFO 배분 규칙을 쓴다', () => {
  assert.match(modal, /allocateFifo/, '자체 배분 로직 대신 @harness/shared 의 allocateFifo 를 써야 한다');
  assert.match(modal, /from '@harness\/shared'/, 'allocateFifo 는 공통 패키지에서 import 해야 한다');
});

test('한 요청 품목이 여러 LOT 를 쓸 수 있다', () => {
  assert.equal(
    modal.includes('selectedMatUids'),
    false,
    '품목당 LOT 1개를 고르던 단일 선택 상태가 남아 있으면 안 된다',
  );
  assert.match(
    modal,
    /flatMap|\.map\([\s\S]{0,400}slices/,
    'items 페이로드는 품목별 slices 를 펼쳐 같은 requestItemId 로 복수 엔트리를 보내야 한다',
  );
  assert.match(
    modal,
    /requestItemId:\s*String\(/,
    'requestItemId 는 요청 품목 seq 문자열이어야 한다',
  );
});

test('qty=0 조각은 전송하지 않는다', () => {
  assert.match(
    modal,
    /qty\s*>\s*0/,
    'issueQty 는 @Min(1) 이므로 0 조각을 걸러야 한다',
  );
});

test('배분 수량 입력은 공통 QtyInput 을 쓴다', () => {
  assert.match(panel, /QtyInput/, '천단위 표시를 위해 공통 QtyInput 을 써야 한다');
  assert.equal(
    panel.includes('type="number"'),
    false,
    'type=number 는 천단위 구분 기호를 표시하지 못한다',
  );
});

test('우측 패널이 FIFO 순서와 입고일을 보여준다', () => {
  assert.match(panel, /recvDate/, '선입선출 판단 근거인 입고일을 표시해야 한다');
});

test('LOT 재조회 응답 처리는 수동배분 여부를 ref 로 읽어 stale closure 를 피한다', () => {
  // LOT 목록 재조회(loadAvailableLots)는 [isOpen, issueRows] effect 안의 async 콜백이라
  // manualRowKeys state 를 직접 읽으면 effect 실행 시점 값이 캡처된다. 조회가 진행되는
  // 동안 사용자가 수동 배분을 하면, 응답 도착 시 그 캡처된(오래된) Set 기준으로
  // setAllocation 이 사용자의 수동 배분을 덮어써버린다. ref 를 통해 "쓰는 시점"의
  // 최신값을 읽어야 한다.
  assert.match(
    modal,
    /const manualRowKeysRef = useRef\(manualRowKeys\)/,
    'manualRowKeys 를 최신값으로 읽기 위한 ref 가 있어야 한다',
  );
  assert.match(
    modal,
    /manualRowKeysRef\.current = manualRowKeys/,
    'ref 는 manualRowKeys 가 바뀔 때마다 최신값으로 동기화돼야 한다',
  );
  assert.match(
    modal,
    /manualRowKeysRef\.current\.has\(row\.rowKey\)/,
    'LOT 재조회 응답 처리에서 수동배분 여부는 ref 를 통해 읽어야 한다',
  );
  assert.equal(
    modal.includes('manualRowKeys.has('),
    false,
    'async 콜백에서 state 를 직접 .has() 로 읽으면 stale closure 로 되돌아간 것이다 — 반드시 ref 를 거쳐야 한다',
  );
});
