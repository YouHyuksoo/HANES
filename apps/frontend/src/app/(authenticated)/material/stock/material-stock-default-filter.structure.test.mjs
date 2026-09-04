import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// 원칙: 재고(현재상태 화면)는 기본 수량>0 + 서버 페이징. "재고 0 포함"은 기본 꺼짐이고,
// 켜면 최종변동일 구간(기본 당일)이 항상 붙는다. 검색어도 DB WHERE 로 건다(페이지 후 메모리 필터 금지).
const page = fs.readFileSync('apps/frontend/src/app/(authenticated)/material/stock/page.tsx', 'utf8');
const dto = fs.readFileSync('apps/backend/src/modules/material/dto/mat-stock.dto.ts', 'utf8');
const service = fs.readFileSync('apps/backend/src/modules/material/services/mat-stock.service.ts', 'utf8');

test('/material/stock defaults to qty>0 with server paging and an off-by-default include-zero toggle', () => {
  assert.doesNotMatch(page, /limit:\s*200/);
  assert.match(page, /const \[includeZero, setIncludeZero\] = useState\(false\)/);
  assert.match(page, /limit: PAGE_SIZE/);
  assert.match(page, /\.\.\.\(includeZero && \{ includeZero: "true", fromDate, toDate \}\)/);
  assert.match(page, /useEffect\(\(\) => \{ setPage\(1\); \}, \[warehouseFilter, searchText, includeZero, fromDate, toDate\]\)/);
  assert.match(page, /<ServerPager[\s\S]*onPageChange=\{setPage\}/);
});

test('/material/stock shows the date range only when include-zero is on, defaulting to local today', () => {
  assert.match(page, /useState\(\(\) => getTodayLocal\(\)\)/);
  assert.doesNotMatch(page, /toISOString\(\)\.slice\(0,\s*10\)/);
  assert.match(page, /\{includeZero && \([\s\S]*<DateRangeFilter/);
  assert.match(page, /t\("common\.includeZero"\)/);
});

test('backend findAll applies qty>0 / updatedAt range / search as DB conditions', () => {
  assert.match(dto, /includeZero\?: boolean/);
  assert.match(service, /!includeZero && \{ qty: MoreThan\(0\) \}/);
  assert.match(service, /updatedAtWhere && \{ updatedAt: updatedAtWhere \}/);
  assert.match(service, /qb\.andWhere\('stock\.qty > 0'\)/);
  assert.match(service, /UPPER\(im\."ITEM_NAME"\) LIKE :search/);
  // 페이지를 자른 뒤 메모리에서 검색어를 거르는 코드가 남아 있으면 안 된다
  assert.doesNotMatch(service, /stock\.itemCode\.toLowerCase\(\)\.includes\(searchLower\)/);
});
