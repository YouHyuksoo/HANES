/**
 * @file src/architecture/menu-code-sources.spec.ts
 * @description 메뉴코드 4소스 정합성 — 같은 메뉴 코드가 네 곳에 수기로 중복 등록되는 구조라 한 곳만 빠지는 결함이 잠복한다
 *   (2026-09-03 현장 개선요청 09: PROD_INPUT_ASSEMBLY 즐겨찾기 오류 — 검증기 목록 누락).
 *   1. apps/frontend/src/config/menuConfig.ts        — 화면에 보이는 메뉴 트리(leaf = path 보유)
 *   2. apps/backend/src/modules/menu-categories/utils/menu-code-validator.ts — 서버 화이트리스트
 *   3. apps/backend/src/seeds/menu-config.json        — 메뉴 카테고리 seed(topMenuCodes/childMenuCodes)
 *   4. apps/frontend/src/components/layout/pageRegistry.generated.ts — 경로 → 페이지 컴포넌트(생성 파일)
 *   DB(MENU_CATEGORY_ITEMS)는 TXN-MENU-001 검증 규칙이 담당한다.
 */
import * as fs from 'fs';
import * as path from 'path';
import { listKnownMenuCodes } from '../modules/menu-categories/utils/menu-code-validator';

const repoRoot = path.resolve(__dirname, '..', '..', '..');
const menuConfigPath = path.join(repoRoot, 'frontend', 'src', 'config', 'menuConfig.ts');
const menuSeedPath = path.join(repoRoot, 'backend', 'src', 'seeds', 'menu-config.json');
const pageRegistryPath = path.join(repoRoot, 'frontend', 'src', 'components', 'layout', 'pageRegistry.generated.ts');

interface MenuLeaf { code: string; path: string }

/** menuConfig.ts에서 path를 가진 항목(leaf)만 추출 — 객체 리터럴 단위로 code/path 쌍을 읽는다 */
function parseMenuLeaves(source: string): MenuLeaf[] {
  const leaves: MenuLeaf[] = [];
  const objectPattern = /\{[^{}]*\}/g;
  for (const block of source.match(objectPattern) ?? []) {
    const code = block.match(/code:\s*"([A-Z0-9_]+)"/)?.[1];
    const leafPath = block.match(/path:\s*"([^"]+)"/)?.[1];
    if (code && leafPath) leaves.push({ code, path: leafPath });
  }
  return leaves;
}

function diff(a: Iterable<string>, b: Set<string>): string[] {
  return [...a].filter((x) => !b.has(x)).sort();
}

describe('menu code sources stay in sync', () => {
  const menuConfigSrc = fs.readFileSync(menuConfigPath, 'utf8');
  const leaves = parseMenuLeaves(menuConfigSrc);
  const leafCodes = new Set(leaves.map((l) => l.code));
  const validatorCodes = new Set(listKnownMenuCodes());
  const seed = JSON.parse(fs.readFileSync(menuSeedPath, 'utf8')) as {
    topMenuCodes: string[];
    childMenuCodes: Record<string, string[]>;
  };
  const seedChildCodes = new Set(Object.values(seed.childMenuCodes).flat());
  const seedAllCodes = new Set([...seed.topMenuCodes, ...seedChildCodes]);
  const pageRegistrySrc = fs.readFileSync(pageRegistryPath, 'utf8');

  it('menuConfig.ts leaf 파싱이 동작한다', () => {
    expect(leaves.length).toBeGreaterThan(100);
  });

  it('서버 메뉴코드 검증기(KNOWN_LEAF_CODES) == menuConfig.ts leaf 코드', () => {
    expect({
      validatorOnly: diff(validatorCodes, leafCodes),
      menuConfigOnly: diff(leafCodes, validatorCodes),
    }).toEqual({ validatorOnly: [], menuConfigOnly: [] });
  });

  it('menu-config.json(seed) childMenuCodes에 menuConfig.ts에 없는 유령 코드가 없다', () => {
    expect(diff(seedChildCodes, leafCodes)).toEqual([]);
  });

  it('menuConfig.ts leaf 코드는 전부 menu-config.json(seed)에 등록되어 있다', () => {
    expect(diff(leafCodes, seedAllCodes)).toEqual([]);
  });

  it('menuConfig.ts leaf 경로는 전부 pageRegistry.generated.ts에 등록되어 있다 (재생성 누락 감지)', () => {
    const missing = leaves
      .filter((l) => !pageRegistrySrc.includes(`case "${l.path}"`))
      .map((l) => `${l.code} ${l.path}`)
      .sort();
    expect(missing).toEqual([]);
  });
});
