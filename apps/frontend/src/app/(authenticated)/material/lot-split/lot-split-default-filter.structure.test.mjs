import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// 원칙: 처리성 화면(분할 대상 선택)은 대상이 되는 LOT(재고>1·NORMAL·예약0·입고완료)만 서버 조건으로 받고,
// 전량(limit 5000)이 아니라 서버 페이징(page/limit)으로 받는다.
const page = fs.readFileSync('apps/frontend/src/app/(authenticated)/material/lot-split/page.tsx', 'utf8');
const service = fs.readFileSync('apps/backend/src/modules/material/services/lot-split.service.ts', 'utf8');

test('/material/lot-split uses server paging instead of fetching everything', () => {
  assert.doesNotMatch(page, /limit:\s*"5000"/);
  assert.match(page, /page: String\(page\), limit: String\(PAGE_SIZE\)/);
  assert.match(page, /useEffect\(\(\) => \{ setPage\(1\); \}, \[searchText\]\)/);
  assert.match(page, /<ServerPager[\s\S]*onPageChange=\{setPage\}/);
});

test('backend restricts split candidates in the DB query, not in memory', () => {
  assert.match(service, /\.where\('stock\.qty > 1'\)/);
  // 활성 LOT 집합은 shared MAT_LOT_ACTIVE_STATUSES 단일 출처(하드코딩 'NORMAL' 금지)
  assert.match(service, /\.andWhere\('lot\.status IN \(:\.\.\.activeStatuses\)', \{ activeStatuses: \[\.\.\.MAT_LOT_ACTIVE_STATUSES\] \}\)/);
  assert.match(service, /\.andWhere\('NVL\(stock\.reservedQty, 0\) = 0'\)/);
  assert.match(service, /\.skip\(skip\)\.take\(limit\)\.getMany\(\)/);
});
