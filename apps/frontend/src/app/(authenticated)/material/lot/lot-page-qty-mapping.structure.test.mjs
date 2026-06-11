import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('./page.tsx', import.meta.url), 'utf8');

// 근본 원인: GET /material/lots는 현재고를 `currentQty`로 반환하지만 화면 모델은 `qty`를 사용.
// qty가 undefined인 채 `qty.toLocaleString()`을 호출하면 렌더 중 TypeError → client-side 예외.
test('lot list maps API currentQty into qty so grid does not crash', () => {
  // 인터페이스가 API 실제 필드 currentQty를 인지해야 한다.
  assert.match(source, /currentQty\?:\s*number/);
  // fetch 경계에서 currentQty를 qty로 정규화(절대 guard만으로 0 표시되면 안 됨).
  assert.match(source, /qty:\s*\w+\.qty\s*\?\?\s*\w+\.currentQty\s*\?\?\s*0/);
});

test('numeric cell renderers guard null/undefined as defense-in-depth', () => {
  // initQty/qty 셀과 모달이 null-safe해야 한다.
  assert.doesNotMatch(source, /row\.original\.qty\.toLocaleString\(\)/);
  assert.doesNotMatch(source, /row\.original\.initQty\.toLocaleString\(\)/);
  assert.doesNotMatch(source, /selectedLot\.qty\.toLocaleString\(\)/);
  assert.doesNotMatch(source, /selectedLot\.initQty\.toLocaleString\(\)/);
});
