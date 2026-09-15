import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const shared = [
  new URL('./DailyInspectModal.tsx', import.meta.url),
  new URL('./WorkerInspectModal.tsx', import.meta.url),
];

const kioskWrappers = [
  new URL('../../app/(authenticated)/production/input-kiosk/components/DailyInspectModal.tsx', import.meta.url),
  new URL('../../app/(authenticated)/production/input-kiosk/components/WorkerInspectModal.tsx', import.meta.url),
];

test('공용 점검 모달은 화면 스토어에 의존하지 않는다', () => {
  for (const url of shared) {
    const src = readFileSync(url, 'utf8');
    assert.doesNotMatch(src, /kioskStore/, `${url.pathname} 가 kioskStore를 참조하면 안 된다`);
    assert.match(src, /context/, `${url.pathname} 는 context prop을 받아야 한다`);
  }
});

test('키오스크 모달은 공용 모달을 감싸기만 한다', () => {
  for (const url of kioskWrappers) {
    const src = readFileSync(url, 'utf8');
    assert.match(src, /@\/components\/inspect/, `${url.pathname} 는 공용 모달을 import 해야 한다`);
    assert.ok(src.split('\n').length < 60, `${url.pathname} 는 얇은 래퍼여야 한다`);
  }
});

test('점검 완료는 콜백으로만 호출 화면에 전달한다', () => {
  for (const url of shared) {
    const src = readFileSync(url, 'utf8');
    assert.match(src, /context\.onInterlock/, '인터락 반영은 context.onInterlock 콜백으로 한다');
  }
});

test('컨텍스트 콜백은 안정된 참조로 감싼다 (무한 렌더 루프 방지)', () => {
  for (const url of shared) {
    const src = readFileSync(url, 'utf8');
    assert.doesNotMatch(
      src,
      /const setInterlock = context\.onInterlock \?\? \(\(\) => \{\}\)/,
      '매 렌더 새 함수를 만들면 deps에 걸린 effect가 무한 재실행된다',
    );
    assert.match(src, /useCallback<NonNullable<InspectModalContext\['onInterlock'\]>>/, 'useCallback으로 감싸야 한다');
  }
});
