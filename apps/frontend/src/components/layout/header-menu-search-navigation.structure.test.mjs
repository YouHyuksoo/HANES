/**
 * @file header-menu-search-navigation.structure.test.mjs
 * @description 헤더 메뉴검색이 사이드바와 같은 방식으로 이동하는지 고정한다.
 *
 * 왜 고정하나:
 * 검색이 router.push 를 쓰고 있었다(2026-09-14 실측). App Router 는 새 라우트가 준비될
 * 때까지 URL 을 바꾸지 않아서, 아직 컴파일되지 않은 화면을 고르면 3초 뒤에도 그대로였고
 * 30초가 지나서야 이동했다 — 사용자에겐 "선택해도 이동이 안 되는" 것으로 보인다.
 * 사이드바·탭바·탭 컨텍스트메뉴는 전부 navigateClientOnly(history.pushState) 를 쓰고,
 * 본문은 TabKeepAlive 가 경로별 작은 registry 만 import 해서 즉시 그린다.
 * 검색만 다른 길을 가면 같은 증상이 다시 난다.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, 'HeaderMenuSearch.tsx'), 'utf8');

test('헤더 검색은 router.push 로 이동하지 않는다', () => {
  assert.ok(
    !/router\.push\(/.test(source),
    'router.push 는 라우트 컴파일이 끝날 때까지 URL 을 바꾸지 않아 "이동 안 됨"으로 보인다',
  );
  assert.ok(!/useRouter/.test(source), 'useRouter 가 남아 있으면 다시 router.push 로 돌아가기 쉽다');
});

test('헤더 검색은 사이드바와 같이 addTab 후 navigateClientOnly 로 이동한다', () => {
  assert.match(source, /import \{ navigateClientOnly \} from "\.\/clientNavigation"/);
  assert.match(source, /useTabStore\(\(s\) => s\.addTab\)/);
  assert.match(source, /const opened = addTab\(\{[^}]*parentId: item\.parentCode[^}]*\}\)/s);
  // 탭 상한에 걸리면 이동도 막는다 — SidebarMenu.handleMenuClick 과 같은 규칙
  const addAt = source.indexOf('const opened = addTab(');
  const guardAt = source.indexOf('if (!opened) return;');
  const navAt = source.indexOf('navigateClientOnly(item.path)');
  assert.ok(addAt > 0 && addAt < guardAt && guardAt < navAt, 'addTab → 상한 가드 → 이동 순서여야 한다');
});

test('검색 결과는 탭 등록에 필요한 labelKey 와 부모 코드를 들고 있다', () => {
  assert.match(source, /labelKey: string;/);
  assert.match(source, /parentCode: string;/);
  // 최상위 단독 메뉴(DASHBOARD 등)는 자기 자신이 부모다 — SidebarMenu 와 같은 규칙
  assert.match(source, /parentCode: parentCode \|\| item\.code/);
});
