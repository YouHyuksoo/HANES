import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const source = readFileSync(new URL('./SidebarMenu.tsx', import.meta.url), 'utf8');
const tabBarSource = readFileSync(new URL('./TabBar.tsx', import.meta.url), 'utf8');
const tabContextMenuSource = readFileSync(new URL('./TabContextMenu.tsx', import.meta.url), 'utf8');
const navigationUrl = new URL('./clientNavigation.ts', import.meta.url);
const navigationSource = existsSync(navigationUrl) ? readFileSync(navigationUrl, 'utf8') : '';

test('layout tab navigation avoids Next Link/router route fetches', () => {
  assert.doesNotMatch(source, /next\/link/);
  assert.doesNotMatch(source, /useRouter/);
  assert.doesNotMatch(source, /router\.push/);
  assert.doesNotMatch(source, /<Link/);
  assert.match(source, /navigateClientOnly\(menuItem\.path\)/);

  assert.doesNotMatch(tabBarSource, /useRouter/);
  assert.doesNotMatch(tabBarSource, /router\.push/);
  assert.match(tabBarSource, /navigateClientOnly\(tab\.path\)/);
  assert.match(tabBarSource, /navigateClientOnly\(next\.path\)/);

  assert.doesNotMatch(tabContextMenuSource, /useRouter/);
  assert.doesNotMatch(tabContextMenuSource, /router\.push/);
  assert.match(tabContextMenuSource, /navigateClientOnly\(active\.path\)/);

  assert.match(navigationSource, /window\.history\.pushState\(null,\s*["']["'],\s*target\)/);
  assert.doesNotMatch(navigationSource, /next\/navigation/);
});
