import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

/**
 * 감사 갭 트랙 B — FIFO/유효기간/승인 IQC 가용재고 정책의 프론트 계약 고정.
 * - 출고·승인·요청생성 응답의 `warnings` 는 공통 지점(issue-warnings.ts) 한 곳에서 toast 로 보여준다(alert 금지).
 * - 출고요청 항목 그리드에 가용(IQC합격)·미검사 컬럼을 표시한다.
 */
const helper = readFileSync('apps/frontend/src/components/material/issue-warnings.ts', 'utf8');
const barcodeHook = readFileSync('apps/frontend/src/hooks/material/useBarcodeScan.ts', 'utf8');
const requestsHook = readFileSync('apps/frontend/src/hooks/material/useIssueRequests.ts', 'utf8');
const issueModal = readFileSync('apps/frontend/src/components/material/IssueFromRequestModal.tsx', 'utf8');
const requestItemList = readFileSync('apps/frontend/src/components/material/issue-from-request/RequestItemList.tsx', 'utf8');
const lotAllocationPanel = readFileSync('apps/frontend/src/components/material/issue-from-request/LotAllocationPanel.tsx', 'utf8');
const detailModal = readFileSync('apps/frontend/src/components/material/IssueRequestDetailModal.tsx', 'utf8');
const requestDataHook = readFileSync('apps/frontend/src/hooks/material/useIssueRequestData.ts', 'utf8');
const createPanels = [
  'apps/frontend/src/components/material/WorkOrderRequestPanel.tsx',
  'apps/frontend/src/components/material/ManualIssueRequestPanel.tsx',
  'apps/frontend/src/components/material/RequestModal.tsx',
].map((path) => [path, readFileSync(path, 'utf8')]);
const matIssueService = readFileSync('apps/backend/src/modules/material/services/mat-issue.service.ts', 'utf8');
const issueRequestService = readFileSync('apps/backend/src/modules/material/services/issue-request.service.ts', 'utf8');

test('경고 표시는 react-hot-toast 공통 헬퍼 한 곳이며 alert 를 쓰지 않는다', () => {
  assert.match(helper, /from 'react-hot-toast'/);
  assert.match(helper, /export function notifyIssueWarnings/);
  assert.match(helper, /export function extractIssueWarnings/);
  assert.doesNotMatch(helper, /\balert\(/);
});

test('스캔 출고·요청 기반 출고·승인 응답의 warnings 를 toast 로 보여준다', () => {
  assert.match(barcodeHook, /notifyIssueWarnings\(issueData\)/, '스캔 출고 응답 warnings');
  assert.match(issueModal, /const res = await api\.post\(`\/material\/issue-requests\/\$\{requestId\}\/issue`/, '출고 응답을 받아야 한다');
  assert.match(issueModal, /notifyIssueWarnings\(res\.data\)/, '요청 기반 출고 응답 warnings');
  assert.match(requestsHook, /const res = await api\.patch\(`\/material\/issue-requests\/\$\{requestNo\}\/approve`\)/, '승인 응답을 받아야 한다');
  assert.match(requestsHook, /notifyIssueWarnings\(res\.data\)/, '승인 응답 warnings');
});

test('출고요청 생성 3경로 모두 IQC 미검사 안내 warnings 를 toast 로 보여준다', () => {
  for (const [path, source] of createPanels) {
    assert.match(source, /const res = await api\.post\('\/material\/issue-requests'/, `${path}: 생성 응답을 받아야 한다`);
    assert.match(source, /notifyIssueWarnings\(res\.data\)/, `${path}: 생성 응답 warnings`);
  }
});

test('출고요청 항목 그리드에 가용(IQC합격)·미검사 컬럼을 표시한다', () => {
  // 2단 구조에서는 요청 품목 그리드가 모달 본문의 DataGrid 컬럼이 아니라
  // 좌측 RequestItemList 컴포넌트로 옮겨졌다 — 같은 두 값을 그 표에서 확인한다.
  assert.match(requestItemList, /row\.issuableQty/);
  assert.match(requestItemList, /row\.pendingIqcQty/);
  assert.match(requestItemList, /material\.issue\.issuableQty/);
  assert.match(requestItemList, /material\.issue\.pendingIqcQty/);
  assert.match(detailModal, /material\.issue\.issuableQty/);
  assert.match(detailModal, /material\.issue\.pendingIqcQty/);
  assert.match(requestDataHook, /issuableQty\?: number/);
  assert.match(requestDataHook, /pendingIqcQty\?: number/);
});

test('IssueFromRequestModal 의 FIFO 권장 표시는 유지한다', () => {
  // 롯트 선택 Select 의 ⭐ 접두 라벨은 우측 LotAllocationPanel 의 선입 LOT 뱃지로 이어졌다
  // (여러 LOT 를 동시에 보여주는 2단 구조라 셀렉트 라벨 접두어 방식은 더 이상 맞지 않는다).
  // i === 0 && ... fifoFirst 를 하나의 표현식으로 묶어서 확인해야 한다 — 각각 따로 매치하면
  // 파일 어딘가에 있는 아무 index-0 분기와 아무 fifoFirst 참조만으로도 통과해버린다.
  assert.match(
    lotAllocationPanel,
    /i === 0 &&[\s\S]{0,200}material\.issue\.fifoFirst/,
    '첫 번째(선입) LOT 행에만 fifoFirst 뱃지가 나와야 한다',
  );
});

test('백엔드 계약: 출고 행·승인·생성 응답에 warnings, 상세 항목에 issuableQty/pendingIqcQty', () => {
  assert.match(matIssueService, /warnings: policyWarnings/);
  assert.match(matIssueService, /async evaluateIssuePolicy\(/);
  assert.match(matIssueService, /loadIssuePolicyConfig\(company, plant\)/, '정책 설정은 출고 1건당 1회');
  assert.match(issueRequestService, /issuableQty: stock\.issuableQty/);
  assert.match(issueRequestService, /pendingIqcQty: stock\.pendingIqcQty/);
  assert.match(issueRequestService, /MAT_ISSUE_STOCK_CHECK/);
  assert.match(issueRequestService, /return \{ \.\.\.detail, warnings \};/);
});
