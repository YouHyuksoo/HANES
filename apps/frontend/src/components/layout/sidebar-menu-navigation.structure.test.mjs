import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('./SidebarMenu.tsx', import.meta.url), 'utf8');

test('sidebar menu click explicitly navigates after opening the app tab', () => {
  assert.match(source, /useRouter/);
  assert.match(source, /const\s+router\s*=\s*useRouter\(\)/);
  assert.match(source, /addTab\(\{[\s\S]*path:\s*menuItem\.path[\s\S]*\}\);[\s\S]*router\.push\(menuItem\.path\)/);
});
