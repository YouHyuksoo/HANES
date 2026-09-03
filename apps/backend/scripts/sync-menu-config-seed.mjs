/**
 * @file apps/backend/scripts/sync-menu-config-seed.mjs
 * @description 프론트 menuConfig.ts(단일 출처)에서 역할 권한 seed용 menu-config.json을 재생성한다.
 *
 * 사용: node scripts/sync-menu-config-seed.mjs   (apps/backend에서 실행)
 * 검증: src/architecture/menu-code-sources.spec.ts 가 menuConfig.ts ↔ menu-config.json ↔ 검증기 ↔ pageRegistry 정합성을 강제한다.
 *
 * 규칙:
 * - topMenuCodes  = menuConfig.ts 최상위 항목 코드 전부(단독 메뉴 DASHBOARD/WORKFLOW 포함)
 * - childMenuCodes = 최상위 그룹별 leaf(path 보유) 코드, menuConfig.ts 등장 순서 유지
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const menuConfigPath = resolve(here, '../../frontend/src/config/menuConfig.ts');
const seedPath = resolve(here, '../src/seeds/menu-config.json');

const src = readFileSync(menuConfigPath, 'utf8');
const arrayStart = src.indexOf('export const menuConfig');
if (arrayStart < 0) throw new Error('menuConfig 배열을 찾을 수 없습니다');
const body = src.slice(src.indexOf('= [', arrayStart) + 3);

/** 최상위 객체 블록을 중괄호 깊이로 분리한다 */
const topBlocks = [];
let depth = 0;
let start = -1;
for (let i = 0; i < body.length; i += 1) {
  const ch = body[i];
  if (ch === '{') {
    if (depth === 0) start = i;
    depth += 1;
  } else if (ch === '}') {
    depth -= 1;
    if (depth === 0 && start >= 0) {
      topBlocks.push(body.slice(start, i + 1));
      start = -1;
    }
  } else if (ch === ']' && depth === 0) {
    break;
  }
}

const topMenuCodes = [];
const childMenuCodes = {};
for (const block of topBlocks) {
  const topCode = block.match(/code:\s*"([A-Z0-9_]+)"/)?.[1];
  if (!topCode) continue;
  topMenuCodes.push(topCode);
  const childrenStart = block.indexOf('children');
  if (childrenStart < 0) continue;
  const children = [];
  for (const leaf of block.slice(childrenStart).match(/\{[^{}]*\}/g) ?? []) {
    const code = leaf.match(/code:\s*"([A-Z0-9_]+)"/)?.[1];
    const path = leaf.match(/path:\s*"([^"]+)"/)?.[1];
    if (code && path) children.push(code);
  }
  if (children.length > 0) childMenuCodes[topCode] = children;
}

const out = {
  _comment: '메뉴 코드 설정 — 자동 생성 파일(직접 수정 금지). 출처: apps/frontend/src/config/menuConfig.ts, 재생성: node scripts/sync-menu-config-seed.mjs',
  topMenuCodes,
  childMenuCodes,
};
writeFileSync(seedPath, `${JSON.stringify(out, null, 2)}\n`, { encoding: 'utf8' });
console.log(`menu-config.json 재생성: top ${topMenuCodes.length}, leaf ${Object.values(childMenuCodes).flat().length}`);
