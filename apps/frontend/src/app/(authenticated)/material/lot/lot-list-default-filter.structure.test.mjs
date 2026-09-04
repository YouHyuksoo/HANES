import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// 원칙: 목록 조회는 조건 없이 전량을 훑지 않는다.
// LOT 조회(현재상태 화면)는 기본 "재고 있는 LOT(잔량>0·NORMAL)" + 서버 페이징이고,
// 다른 상태(전체/보류/소진)를 볼 때는 입고일 구간(기본 당일)이 항상 붙는다.
const page = fs.readFileSync('apps/frontend/src/app/(authenticated)/material/lot/page.tsx', 'utf8');
const dto = fs.readFileSync('apps/backend/src/modules/material/dto/mat-lot.dto.ts', 'utf8');
const service = fs.readFileSync('apps/backend/src/modules/material/services/mat-lot.service.ts', 'utf8');

test('/material/lot defaults to in-stock LOTs and never requests the whole table', () => {
  assert.doesNotMatch(page, /limit:\s*"5000"/);
  assert.match(page, /useState\(LOT_ACTIVE_FILTER\)/);
  assert.match(page, /params\.activeOnly = "true"/);
  assert.match(page, /page: String\(page\), limit: String\(PAGE_SIZE\)/);
  assert.match(page, /<ServerPager[\s\S]*onPageChange=\{setPage\}/);
});

test('/material/lot attaches a recv-date range (default today) whenever a non-active status is chosen', () => {
  assert.match(page, /const dateRangeApplies = statusFilter !== LOT_ACTIVE_FILTER/);
  assert.match(page, /useState\(\(\) => getTodayLocal\(\)\)/);
  assert.doesNotMatch(page, /toISOString\(\)\.slice\(0,\s*10\)/);
  assert.match(page, /\{dateRangeApplies && \([\s\S]*<DateRangeFilter/);
  assert.match(page, /params\.fromDate = fromDate/);
});

test('filters reset to page 1 when any list condition changes', () => {
  assert.match(page, /useEffect\(\(\) => \{ setPage\(1\); \}, \[searchText, statusFilter, iqcFilter, fromDate, toDate\]\)/);
});

test('backend applies activeOnly and recv-date range as DB conditions (no post-page memory filter)', () => {
  assert.match(dto, /activeOnly\?: boolean/);
  assert.match(dto, /fromDate\?: string/);
  assert.match(service, /activeOnly && \{ status: 'NORMAL', currentQty: MoreThan\(0\) \}/);
  assert.match(service, /recvDateWhere && \{ recvDate: recvDateWhere \}/);
  assert.match(service, /parseDateStart\(fromDate\)/);
  assert.match(service, /parseDateEnd\(toDate\)/);
});
