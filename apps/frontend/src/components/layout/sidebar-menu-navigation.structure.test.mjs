import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// 사이드바·탭 동작은 @jisung/ui AppShell 이 고정하고(패키지 테스트가 검사한다),
// HANES 는 MainLayout 에서 메뉴 영역 구성과 도움말 링크를 넘긴다.
const layoutSource = readFileSync(new URL('./MainLayout.tsx', import.meta.url), 'utf8');
// 도움말 메뉴 제외 로직은 useMenuTree 훅에서 한 번에 처리한다
const useMenuTreeSource = readFileSync(new URL('../../hooks/useMenuTree.ts', import.meta.url), 'utf8');
const menuConfigSource = readFileSync(new URL('../../config/menuConfig.ts', import.meta.url), 'utf8');

function resolveTranslation(resource, key) {
  const nestedValue = key.split('.').reduce((obj, part) => obj?.[part], resource);
  if (nestedValue !== undefined) return nestedValue;

  const [root, ...rest] = key.split('.');
  return resource[root]?.[rest.join('.')];
}

test('HANES 앱 틀은 @jisung/ui AppShell 을 쓴다', () => {
  assert.match(layoutSource, /import \{ AppShell, HeaderMenuItem, type AppShellConfig \} from "@jisung\/ui";/);
  assert.match(layoutSource, /<AppShell config=\{config\}>\{children\}<\/AppShell>/);
});

test('sidebar keeps full help link in a fixed bottom area', () => {
  assert.match(layoutSource, /helpMenu: \{ code: "HELP_INDEX", labelKey: "help\.viewAll", path: "\/help", icon: BookOpen \}/);
  assert.match(useMenuTreeSource, /function excludeHelpMenuItems\(/, 'help menu items should be centrally excluded from the tree in the shared hook');
  assert.match(useMenuTreeSource, /excludeHelpMenuItems\(result\)/);
});

test('sidebar pins scenario + interface + system groups in their own bottom area above full help', () => {
  // 시나리오 런너는 업무 메뉴가 아니라 절차를 대신 실행하는 운영 도구라 이 영역에 둔다.
  // 영역 안 순서는 DB SORT_ORDER 가 정한다(SCENARIO 155 < INTERFACE 160).
  assert.match(layoutSource, /admin: \{ codes: \["SCENARIO", "INTERFACE", "SYSTEM"\], labelKeys: \["menu\.interface", "menu\.system"\] \}/);
  assert.match(layoutSource, /pinned: \{ codes: \["WORKFLOW", "MONITORING"\], labelKeys: \["menu\.workflow", "menu\.monitoring"\] \}/);
});

test('all sidebar menu label keys resolve in every locale', () => {
  const labelKeys = [...menuConfigSource.matchAll(/labelKey:\s*"([^"]+)"/g)].map((match) => match[1]);
  const localeFiles = ['ko', 'en', 'vi', 'zh'];

  for (const lang of localeFiles) {
    const resource = JSON.parse(readFileSync(new URL(`../../locales/${lang}.json`, import.meta.url), 'utf8'));
    const missing = labelKeys.filter((key) => resolveTranslation(resource, key) === undefined);
    assert.deepEqual(missing, [], `${lang} locale is missing sidebar menu labels`);
  }
});
