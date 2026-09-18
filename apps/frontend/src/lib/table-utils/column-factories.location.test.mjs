import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const factories = fs.readFileSync('apps/frontend/src/lib/table-utils/column-factories.tsx', 'utf8');

test('보관위치 컬럼 팩토리를 공통으로 제공한다', () => {
  // 재고 화면마다 컬럼을 직접 쓰면 라벨과 폴백 규칙이 갈린다 — 한 곳에서 만든다.
  assert.match(factories, /export function createLocationColumn</);
  assert.match(factories, /accessorKey: "locationCode"/);
  assert.match(factories, /material\.stock\.columns\.location/);
});

test('보관위치는 기준정보 명칭을 우선 표시하고 없으면 코드로 대체한다', () => {
  // /master/warehouse 의 로케이션 기준정보(LOCATION_NAME)가 정본이다.
  assert.match(factories, /locationName/);
});
