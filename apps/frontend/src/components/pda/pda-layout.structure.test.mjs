import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const layout = fs.readFileSync('apps/frontend/src/components/pda/PdaLayout.tsx', 'utf8');
const grid = fs.readFileSync('apps/frontend/src/components/pda/PdaMenuGrid.tsx', 'utf8');

test('PDA 화면은 넓은 창에서도 단말 폭을 넘지 않는다', () => {
  // PC 브라우저로 열면 2열 그리드가 화면 폭만큼 늘어나 버튼이 띠처럼 보인다.
  assert.match(layout, /max-w-md/);
  assert.match(layout, /mx-auto/);
});

test('2열 메뉴 그리드는 항목이 홀수여도 마지막 칸이 비지 않는다', () => {
  // 자재관리 메뉴가 4개 → 5개(창고랙 지정)가 되면서 마지막 버튼 옆이 비었다.
  assert.match(grid, /col-span-2/);
  assert.match(grid, /isLastOdd|items\.length % 2/);
});
