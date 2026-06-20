import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('./TabKeepAlive.tsx', import.meta.url), 'utf8');
const registrySource = readFileSync(new URL('./pageRegistry.generated.ts', import.meta.url), 'utf8');
const masterPartRegistrySource = readFileSync(new URL('./page-registries/master__part.generated.ts', import.meta.url), 'utf8');

test('TabKeepAlive lazily keeps visited page components alive without importing every page up front', () => {
  assert.doesNotMatch(source, /import\s+\{\s*pageRegistry\s*\}/);
  assert.doesNotMatch(source, /dynamic\(/);
  assert.match(source, /import\s+\{\s*getPageComponent\s*\}\s+from\s+["']\.\/pageRegistry\.generated["']/);
  assert.match(source, /getPageComponent\(pathname\)\.then\(\(Component\) =>/);
  assert.match(source, /const cachedPage = pagesRef\.current\.get\(pathname\)/);
  assert.match(source, /cachedPage\.lastSeen = Date\.now\(\)/);
  assert.match(source, /pagesRef\.current\.set\(pathname/);
  assert.match(source, /Component: currentComponent/);
  assert.match(source, /<KeepAliveCell active=\{page\.path === pathname\} Component=\{page\.Component\}/);
  assert.match(source, /slice\(0,\s*MAX_TABS\)/);
  assert.match(source, /restoreTabPageState\(pathname,\s*rootsRef\.current\.get\(pathname\)/);
  assert.match(source, /saveTabPageState\(pathname,\s*rootsRef\.current\.get\(pathname\)/);
  assert.match(source, /saveTabPageState\(pathnameRef\.current,\s*rootsRef\.current\.get\(pathnameRef\.current\)/);
  assert.match(source, /data-tab-page-state-root/);
  assert.doesNotMatch(registrySource, /export const pageRegistry/);
  assert.doesNotMatch(registrySource, /next\/dynamic/);
  assert.doesNotMatch(registrySource, /@\/app\/\(authenticated\)\/master\/part\/page/);
  assert.match(registrySource, /const pageComponentCache = new Map<string, ComponentType>\(\)/);
  assert.match(registrySource, /const pageComponentPromiseCache = new Map<string, Promise<ComponentType \| null>>\(\)/);
  assert.match(registrySource, /export async function getPageComponent\(path: string\): Promise<ComponentType \| null>/);
  assert.match(registrySource, /case "\/master\/part": \{\s*const mod = await import\("\.\/page-registries\/master__part\.generated"\)/);
  assert.match(masterPartRegistrySource, /return dynamic\(\(\) => import\("@\/app\/\(authenticated\)\/master\/part\/page"\), \{ ssr: false \}\);/);
});
