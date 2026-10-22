import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// TabKeepAlive 자체는 @jisheng/ui 로 옮겨졌다(패키지 테스트가 검사한다).
// HANES 는 생성된 페이지 레지스트리를 AppShell 설정(getPageComponent)으로 넘긴다.
const layoutSource = readFileSync(new URL('./MainLayout.tsx', import.meta.url), 'utf8');
const registrySource = readFileSync(new URL('./pageRegistry.generated.ts', import.meta.url), 'utf8');
const masterPartRegistrySource = readFileSync(new URL('./page-registries/master__part.generated.ts', import.meta.url), 'utf8');

test('HANES passes the lazily generated page registry to the shared keep-alive tabs', () => {
  assert.match(layoutSource, /import \{ getPageComponent \} from "\.\/pageRegistry\.generated";/);
  assert.match(layoutSource, /^\s*getPageComponent,$/m);
  assert.doesNotMatch(registrySource, /export const pageRegistry/);
  assert.doesNotMatch(registrySource, /next\/dynamic/);
  assert.doesNotMatch(registrySource, /@\/app\/\(authenticated\)\/master\/part\/page/);
  assert.match(registrySource, /const pageComponentCache = new Map<string, ComponentType>\(\)/);
  assert.match(registrySource, /const pageComponentPromiseCache = new Map<string, Promise<ComponentType \| null>>\(\)/);
  assert.match(registrySource, /export async function getPageComponent\(path: string\): Promise<ComponentType \| null>/);
  assert.match(registrySource, /case "\/master\/part": \{\s*const mod = await import\("\.\/page-registries\/master__part\.generated"\)/);
  assert.match(masterPartRegistrySource, /return dynamic\(\(\) => import\("@\/app\/\(authenticated\)\/master\/part\/page"\), \{ ssr: false \}\);/);
});
